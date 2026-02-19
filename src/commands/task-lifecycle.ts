import * as vscode from "vscode";
import * as path from "path";
import { parseFrontMatter } from "../indexer";
import { routeTaskToAgent } from "../agents/router";
import {
  isEverythingCopilotAvailable,
  routeToEverythingCopilot,
  suggestEverythingCopilot
} from "../agents/everything-copilot-router";
import {
  parseTaskDependencies,
  parseTaskStatuses,
  checkDependencies,
  getActiveInProgressTasks,
  getCurrentCommitHash,
  saveActiveTask,
  loadActiveTask,
  getFileChangesSince,
  ActiveTaskInfo
} from "../core/task-tracker";
import { showTaskReview } from "./task-review";

export type HandleChangeFn = (uri: vscode.Uri) => Promise<void>;

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Determine if the file is Spec Kit format
 */
function isSpecKitFormat(uri: vscode.Uri): boolean {
  return uri.fsPath.includes('/specs/') && uri.fsPath.endsWith('/tasks.md');
}

/**
 * Extract task content from a tasks.md document for Spec Kit format
 */
function extractSpecKitTask(text: string, taskId: string, uri: vscode.Uri): {
  taskTitle: string;
  taskContent: string;
  reqId: string;
  designId: string;
} {
  const lines = text.split(/\r?\n/);
  const taskNum = taskId.replace('TASK-', '');
  const taskPattern = new RegExp(`^##\\s+Task\\s+${taskNum}:\\s*(.+)$`, 'i');

  let startIdx = -1;
  let endIdx = lines.length;
  let taskTitle = taskId;

  for (let i = 0; i < lines.length; i++) {
    const titleMatch = lines[i].match(taskPattern);
    if (titleMatch) {
      startIdx = i;
      taskTitle = titleMatch[1];
    } else if (startIdx >= 0 && /^##\s+Task\s+\d+:/i.test(lines[i])) {
      endIdx = i;
      break;
    }
  }

  let taskContent = text;
  if (startIdx >= 0) {
    taskContent = lines.slice(startIdx, endIdx).join("\n");
  }

  const featureName = path.basename(path.dirname(uri.fsPath));
  return {
    taskTitle,
    taskContent,
    reqId: `spec-${featureName}`,
    designId: `plan-${featureName}`
  };
}

/**
 * Extract task content for legacy RakDev format
 */
function extractLegacyTask(text: string, taskId: string): {
  taskTitle: string;
  taskContent: string;
  reqId: string;
  designId: string;
} {
  const lines = text.split(/\r?\n/);
  const fm = parseFrontMatter(text);
  const reqId = fm.requirement || "unknown";
  const designId = fm.design || "unknown";
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;
  let taskContent = text;

  if (taskId.includes("-T")) {
    const taskNumber = taskId.split("-T")[1];
    const taskStartPattern = new RegExp(
      `^###\\s+Task\\s+${taskNumber}:\\s+`,
      "i",
    );

    let startIdx = -1;
    let endIdx = lines.length;

    for (let i = 0; i < lines.length; i++) {
      if (taskStartPattern.test(lines[i])) {
        startIdx = i;
      } else if (startIdx >= 0 && /^###\s+Task\s+\d+:/i.test(lines[i])) {
        endIdx = i;
        break;
      }
    }

    if (startIdx >= 0) {
      taskContent = lines.slice(startIdx, endIdx).join("\n");
    }
  }

  return { taskTitle, taskContent, reqId, designId };
}

/**
 * Validate dependencies before starting a task.
 * Returns true if the task can proceed, false if blocked.
 */
async function validateDependencies(uri: vscode.Uri, taskId: string): Promise<boolean> {
  if (!isSpecKitFormat(uri)) {
    return true; // Skip dependency check for legacy format
  }

  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  const dependencies = parseTaskDependencies(text);
  const statuses = parseTaskStatuses(text);
  const { canStart, blockers } = checkDependencies(taskId, dependencies, statuses);

  if (!canStart) {
    const blockerList = blockers
      .map(b => `  • ${b.taskId} (${b.status})`)
      .join('\n');

    const message = `Cannot start ${taskId} — the following dependency tasks are not yet done:\n\n${blockerList}`;

    const action = await vscode.window.showWarningMessage(
      message,
      { modal: true },
      'View Dependencies'
    );

    if (action === 'View Dependencies') {
      // Open tasks.md and scroll to the first blocker
      const editor = await vscode.window.showTextDocument(doc);
      const firstBlocker = blockers[0].taskId.replace('TASK-', '');
      const blockIdx = text.indexOf(`## Task ${firstBlocker}:`);
      if (blockIdx > -1) {
        const pos = doc.positionAt(blockIdx);
        editor.selection = new vscode.Selection(pos, pos);
        editor.revealRange(new vscode.Range(pos, pos), vscode.TextEditorRevealType.InCenter);
      }
    }

    return false;
  }

  return true;
}

/**
 * Validate that no other task is currently in progress.
 * Returns true if the task can proceed, false if another task is active.
 */
async function validateSingleActiveTask(uri: vscode.Uri, taskId: string): Promise<boolean> {
  if (!isSpecKitFormat(uri)) {
    return true; // Skip for legacy format
  }

  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const statuses = parseTaskStatuses(text);
  const activeTasks = getActiveInProgressTasks(statuses, taskId);

  if (activeTasks.length > 0) {
    const activeList = activeTasks.join(', ');

    const action = await vscode.window.showWarningMessage(
      `${activeList} ${activeTasks.length === 1 ? 'is' : 'are'} already in progress. Only one task should be active at a time.\n\nDo you want to start ${taskId} anyway?`,
      { modal: true },
      'Start Anyway',
      'Cancel'
    );

    return action === 'Start Anyway';
  }

  return true;
}

// ── Public Commands ──────────────────────────────────────────────────

export async function changeTaskStatus(
  uri: vscode.Uri,
  taskId: string,
  currentStatus: string,
  handleChange: HandleChangeFn,
) {
  const options = ["todo", "in-progress", "blocked", "done"];
  const newStatus = await vscode.window.showQuickPick(options, {
    placeHolder: `Change status from '${currentStatus}' to:`,
    title: `Task ${taskId}`,
  });

  if (newStatus && newStatus !== currentStatus) {
    // If changing to in-progress, validate dependencies and single-task rule
    if (newStatus === 'in-progress') {
      if (!await validateDependencies(uri, taskId)) return;
      if (!await validateSingleActiveTask(uri, taskId)) return;
    }
    await updateTaskStatus(uri, newStatus, handleChange, taskId);
  }
}

export async function startTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  // ── GATE 1: Check dependencies ──
  if (!await validateDependencies(uri, taskId)) {
    return;
  }

  // ── GATE 2: Only one task in progress at a time ──
  if (!await validateSingleActiveTask(uri, taskId)) {
    return;
  }

  // ── Update status to in-progress ──
  await updateTaskStatus(uri, "in-progress", handleChange, taskId);

  // ── GATE 3: Record git snapshot for change tracking ──
  const commitHash = getCurrentCommitHash();
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  const isSpecKit = isSpecKitFormat(uri);
  let taskTitle = taskId;

  if (isSpecKit) {
    const extracted = extractSpecKitTask(text, taskId, uri);
    taskTitle = extracted.taskTitle;
  }

  if (commitHash) {
    const activeTaskInfo: ActiveTaskInfo = {
      taskId,
      taskTitle,
      featurePath: path.dirname(uri.fsPath),
      tasksFileUri: uri.fsPath,
      startedAt: new Date().toISOString(),
      startCommitHash: commitHash,
      startFileSnapshot: []
    };
    await saveActiveTask(activeTaskInfo);
    vscode.window.showInformationMessage(
      `📸 Git snapshot recorded for ${taskId}. File changes will be tracked.`
    );
  }

  // ── Extract task data for agent routing ──
  let reqId = "unknown";
  let designId = "unknown";
  let taskContent = text;

  if (isSpecKit) {
    const extracted = extractSpecKitTask(text, taskId, uri);
    taskTitle = extracted.taskTitle;
    taskContent = extracted.taskContent;
    reqId = extracted.reqId;
    designId = extracted.designId;
  } else {
    const extracted = extractLegacyTask(text, taskId);
    taskTitle = extracted.taskTitle;
    taskContent = extracted.taskContent;
    reqId = extracted.reqId;
    designId = extracted.designId;
  }

  // Extract acceptance criteria from task content
  const acceptanceCriteria: string[] = [];
  const criteriaRegex = /- \[ \] (.+)/g;
  let match;
  while ((match = criteriaRegex.exec(taskContent)) !== null) {
    acceptanceCriteria.push(match[1]);
  }

  // ── Route to AI agent ──
  const hasEverythingCopilot = await isEverythingCopilotAvailable();

  if (hasEverythingCopilot) {
    const featureFolder = path.dirname(uri.fsPath);
    let spec: string | undefined;
    let plan: string | undefined;

    try {
      const specUri = vscode.Uri.file(path.join(featureFolder, 'spec.md'));
      const specContent = await vscode.workspace.fs.readFile(specUri);
      spec = Buffer.from(specContent).toString('utf8');
    } catch {
      // spec.md not found
    }

    try {
      const planUri = vscode.Uri.file(path.join(featureFolder, 'plan.md'));
      const planContent = await vscode.workspace.fs.readFile(planUri);
      plan = Buffer.from(planContent).toString('utf8');
    } catch {
      // plan.md not found
    }

    await routeToEverythingCopilot({
      taskId,
      taskTitle,
      taskContent,
      acceptanceCriteria,
      requirementId: reqId,
      designId: designId
    }, spec, plan);
  } else {
    await routeTaskToAgent({
      taskId,
      taskTitle,
      taskContent,
      requirementId: reqId,
      designId: designId,
      mode: "implement",
    });

    // Only suggest everything-copilot once (don't nag)
    const config = vscode.workspace.getConfiguration('speclens');
    const alreadySuggested = config.get<boolean>('_everythingCopilotSuggested', false);
    if (!alreadySuggested) {
      await suggestEverythingCopilot();
      // We don't persist this — it's per-session only
    }
  }
}

export async function completeTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  // ── Check if there's tracking data → show review panel ──
  const activeTask = await loadActiveTask();

  if (activeTask && activeTask.taskId === taskId) {
    // Show review panel with file changes
    const approved = await showTaskReview(uri, taskId, updateTaskStatus, handleChange);
    if (approved) {
      vscode.window.showInformationMessage(`🎉 Task ${taskId} reviewed and completed!`);
    }
    // If not approved, task stays in-progress
    return;
  }

  // No tracking data — show a simple review with confirmation
  const confirm = await vscode.window.showInformationMessage(
    `Mark task ${taskId} as complete?\n\n(No change tracking data available — task may have been started before tracking was enabled.)`,
    "Yes, Complete",
    "Cancel",
  );

  if (confirm === "Yes, Complete") {
    await updateTaskStatus(uri, "done", handleChange, taskId);
    vscode.window.showInformationMessage(
      `🎉 Task ${taskId} completed! Status: done`,
    );
  }
}

export async function blockTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  const reason = await vscode.window.showInputBox({
    prompt: "Why is this task blocked?",
    placeHolder: "e.g., Waiting for API credentials",
  });

  if (reason !== undefined) {
    await updateTaskStatus(uri, "blocked", handleChange, taskId);

    const doc = await vscode.workspace.openTextDocument(uri);
    const timestamp = new Date().toISOString();
    const blockerNote = `\n\n---\n**BLOCKED** (${timestamp}): ${reason}\n---\n`;

    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(doc.lineCount, 0), blockerNote);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showWarningMessage(`🚫 Task ${taskId} blocked: ${reason}`);
  }
}

export async function reopenTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  // When reopening, validate same rules as starting
  if (!await validateDependencies(uri, taskId)) return;
  if (!await validateSingleActiveTask(uri, taskId)) return;

  await updateTaskStatus(uri, "in-progress", handleChange, taskId);

  // Re-record git snapshot for change tracking
  const commitHash = getCurrentCommitHash();
  if (commitHash) {
    const activeTaskInfo: ActiveTaskInfo = {
      taskId,
      taskTitle: taskId,
      featurePath: path.dirname(uri.fsPath),
      tasksFileUri: uri.fsPath,
      startedAt: new Date().toISOString(),
      startCommitHash: commitHash,
      startFileSnapshot: []
    };
    await saveActiveTask(activeTaskInfo);
  }

  vscode.window.showInformationMessage(
    `🔄 Task ${taskId} reopened! Status: in-progress`,
  );
}

export async function unblockTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  // When unblocking, validate same rules
  if (!await validateDependencies(uri, taskId)) return;
  if (!await validateSingleActiveTask(uri, taskId)) return;

  await updateTaskStatus(uri, "in-progress", handleChange, taskId);

  // Re-record git snapshot
  const commitHash = getCurrentCommitHash();
  if (commitHash) {
    const activeTaskInfo: ActiveTaskInfo = {
      taskId,
      taskTitle: taskId,
      featurePath: path.dirname(uri.fsPath),
      tasksFileUri: uri.fsPath,
      startedAt: new Date().toISOString(),
      startCommitHash: commitHash,
      startFileSnapshot: []
    };
    await saveActiveTask(activeTaskInfo);
  }

  vscode.window.showInformationMessage(
    `✅ Task ${taskId} unblocked! Status: in-progress`,
  );
}

export async function executeTask(uri: vscode.Uri, taskId: string) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  const isSpecKit = isSpecKitFormat(uri);

  let reqId = "unknown";
  let designId = "unknown";
  let taskTitle = taskId;
  let taskContent = text;

  if (isSpecKit) {
    const extracted = extractSpecKitTask(text, taskId, uri);
    taskTitle = extracted.taskTitle;
    taskContent = extracted.taskContent;
    reqId = extracted.reqId;
    designId = extracted.designId;
  } else {
    const extracted = extractLegacyTask(text, taskId);
    taskTitle = extracted.taskTitle;
    taskContent = extracted.taskContent;
    reqId = extracted.reqId;
    designId = extracted.designId;
  }

  // Route to active AI agent (help mode)
  await routeTaskToAgent({
    taskId,
    taskTitle,
    taskContent,
    requirementId: reqId,
    designId: designId,
    mode: "help",
  });
}

export async function viewTaskChanges(uri: vscode.Uri, taskId: string) {
  // First try our built-in tracking data
  const activeTask = await loadActiveTask();

  if (activeTask && activeTask.taskId === taskId) {
    // Show our tracked changes in a review panel (read-only mode)
    const changes = getFileChangesSince(activeTask.startCommitHash);
    if (changes.totalChanges > 0) {
      await showTaskReview(uri, taskId, updateTaskStatus, async () => {});
      return;
    }
  }

  // Check history for completed tasks
  const { loadTaskHistory } = await import('../core/task-tracker');
  const history = await loadTaskHistory(taskId);
  if (history && history.totalChanges > 0) {
    await showTaskReview(uri, taskId, updateTaskStatus, async () => {});
    return;
  }

  // Fallback: ask Copilot to analyze changes
  try {
    const chatPrompt = `@workspace Show me all the files that were changed or created for task ${taskId}.

Please:
1. Search for files that reference "${taskId}" in comments or commits
2. Show me the git diff of recently modified files
3. List all files created/modified since this task started
4. Highlight the key changes related to this task

Use git history and file search to track all changes for this task.`;

    await vscode.commands.executeCommand("workbench.action.chat.open", {
      query: chatPrompt,
    });

    vscode.window.showInformationMessage(
      `📝 Analyzing changes for ${taskId}...`,
    );
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to view task changes: ${e.message}`);
  }
}

// ── Status Update Helpers ────────────────────────────────────────────

/**
 * Update task status in Spec Kit format tasks.md
 */
async function updateSpecKitTaskStatus(
  uri: vscode.Uri,
  taskId: string,
  newStatus: string,
  handleChange: HandleChangeFn
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(uri);
  let text = doc.getText();

  const taskNum = taskId.replace('TASK-', '');
  const taskRegex = new RegExp(`(## Task ${taskNum}:[\\s\\S]*?\\*\\*Status:\\*\\*)\\s*(Pending|In Progress|Blocked|Done|TODO|IN-PROGRESS|COMPLETED)`, 'i');

  // Map status to format used in tasks.md
  const statusMap: Record<string, string> = {
    'pending': 'Pending',
    'in-progress': 'In Progress',
    'blocked': 'Blocked',
    'done': 'Done',
    'todo': 'Pending'
  };

  const newStatusFormatted = statusMap[newStatus] || newStatus;

  if (taskRegex.test(text)) {
    text = text.replace(taskRegex, `$1 ${newStatusFormatted}`);

    const edit = new vscode.WorkspaceEdit();
    const fullRange = new vscode.Range(
      doc.positionAt(0),
      doc.positionAt(doc.getText().length)
    );
    edit.replace(uri, fullRange, text);

    await vscode.workspace.applyEdit(edit);
    await doc.save();
    await handleChange(uri);

    vscode.window.showInformationMessage(`Task ${taskNum} status updated to: ${newStatusFormatted}`);
  } else {
    vscode.window.showErrorMessage(`Could not find Task ${taskNum} or Status field`);
  }
}

/**
 * Main status update function - routes to the right format handler
 */
export async function updateTaskStatus(
  uri: vscode.Uri,
  newStatus: string,
  handleChange: HandleChangeFn,
  taskId?: string
) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  // Check if this is Spec Kit format (specs/*/tasks.md)
  if (isSpecKitFormat(uri)) {
    if (!taskId) {
      vscode.window.showErrorMessage("TaskId is required for Spec Kit format");
      return;
    }
    return updateSpecKitTaskStatus(uri, taskId, newStatus, handleChange);
  }

  // Legacy RakDev format: YAML front-matter
  const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);

  if (!fmMatch) {
    vscode.window.showErrorMessage("Could not find task front-matter");
    return;
  }

  const fmBody = fmMatch[1];
  let newFmBody = fmBody;

  if (/^status:/m.test(fmBody)) {
    newFmBody = fmBody.replace(/^status:.*$/m, `status: ${newStatus}`);
  } else {
    newFmBody = `status: ${newStatus}\n${fmBody}`;
  }

  const newFm = `---\n${newFmBody}\n---`;
  const edit = new vscode.WorkspaceEdit();
  const fmRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(fmMatch[0].length),
  );
  edit.replace(uri, fmRange, newFm);

  await vscode.workspace.applyEdit(edit);
  await doc.save();

  await handleChange(uri);
}
