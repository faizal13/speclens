import * as vscode from "vscode";
import * as path from "path";
import { parseFrontMatter, WorkspaceIndex } from "../indexer";
import { routeTaskToAgent, TaskContext } from "../agents/router";
import {
  isEverythingCopilotAvailable,
  routeToEverythingCopilot,
  detectTaskType,
  getAgentInfo,
  suggestEverythingCopilot
} from "../agents/everything-copilot-router";

export type HandleChangeFn = (uri: vscode.Uri) => Promise<void>;

export async function changeTaskStatus(
  uri: vscode.Uri,
  _taskId: string,
  currentStatus: string,
  handleChange: HandleChangeFn,
) {
  const options = ["todo", "in-progress", "blocked", "done"];
  const newStatus = await vscode.window.showQuickPick(options, {
    placeHolder: `Change status from '${currentStatus}' to:`,
    title: `Task ${_taskId}`,
  });

  if (newStatus && newStatus !== currentStatus) {
    await updateTaskStatus(uri, newStatus, handleChange);
  }
}

export async function startTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  await updateTaskStatus(uri, "in-progress", handleChange, taskId);

  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);

  const reqId = fm.requirement || "unknown";
  const designId = fm.design || "unknown";
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  let taskContent = text;
  if (taskId.includes("-T")) {
    const lines = text.split(/\r?\n/);
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

  // Extract acceptance criteria from task content
  const acceptanceCriteria: string[] = [];
  const criteriaRegex = /- \[ \] (.+)/g;
  let match;
  while ((match = criteriaRegex.exec(taskContent)) !== null) {
    acceptanceCriteria.push(match[1]);
  }

  // Check if everything-copilot is available
  const hasEverythingCopilot = await isEverythingCopilotAvailable();

  if (hasEverythingCopilot) {
    // Route to specialized everything-copilot agent
    // Read spec.md and plan.md for context
    const featureFolder = path.dirname(uri.fsPath);
    let spec: string | undefined;
    let plan: string | undefined;

    try {
      const specUri = vscode.Uri.file(path.join(featureFolder, 'spec.md'));
      const specContent = await vscode.workspace.fs.readFile(specUri);
      spec = Buffer.from(specContent).toString('utf8');
    } catch {
      // spec.md not found, continue without it
    }

    try {
      const planUri = vscode.Uri.file(path.join(featureFolder, 'plan.md'));
      const planContent = await vscode.workspace.fs.readFile(planUri);
      plan = Buffer.from(planContent).toString('utf8');
    } catch {
      // plan.md not found, continue without it
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
    // Fallback to regular agent routing
    await routeTaskToAgent({
      taskId,
      taskTitle,
      taskContent,
      requirementId: reqId,
      designId: designId,
      mode: "implement",
    });

    // Suggest installing everything-copilot
    await suggestEverythingCopilot();
  }
}

export async function completeTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  const confirm = await vscode.window.showInformationMessage(
    `Mark task ${taskId} as complete?`,
    "Yes",
    "No",
  );

  if (confirm === "Yes") {
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
  await updateTaskStatus(uri, "in-progress", handleChange, taskId);
  vscode.window.showInformationMessage(
    `🔄 Task ${taskId} reopened! Status: in-progress`,
  );
}

export async function unblockTask(
  uri: vscode.Uri,
  taskId: string,
  handleChange: HandleChangeFn,
) {
  await updateTaskStatus(uri, "in-progress", handleChange, taskId);
  vscode.window.showInformationMessage(
    `✅ Task ${taskId} unblocked! Status: in-progress`,
  );
}

export async function executeTask(uri: vscode.Uri, taskId: string) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);

  const reqId = fm.requirement || "unknown";
  const designId = fm.design || "unknown";
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  // Route to active AI agent (help mode)
  await routeTaskToAgent({
    taskId,
    taskTitle,
    taskContent: text,
    requirementId: reqId,
    designId: designId,
    mode: "help",
  });
}

export async function viewTaskChanges(uri: vscode.Uri, taskId: string) {
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
      `📝 Copilot is analyzing changes for ${taskId}...`,
    );
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to view task changes: ${e.message}`);
  }
}

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

async function updateTaskStatus(
  uri: vscode.Uri,
  newStatus: string,
  handleChange: HandleChangeFn,
  taskId?: string
) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();

  // Check if this is Spec Kit format (specs/*/tasks.md)
  if (uri.fsPath.includes('/specs/') && uri.fsPath.endsWith('/tasks.md')) {
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
