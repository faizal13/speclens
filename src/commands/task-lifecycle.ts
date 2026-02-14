import * as vscode from 'vscode';
import { parseFrontMatter, WorkspaceIndex } from '../indexer';

export type HandleChangeFn = (uri: vscode.Uri) => Promise<void>;

export async function changeTaskStatus(uri: vscode.Uri, _taskId: string, currentStatus: string, handleChange: HandleChangeFn) {
  const options = ['todo', 'in-progress', 'blocked', 'done'];
  const newStatus = await vscode.window.showQuickPick(options, {
    placeHolder: `Change status from '${currentStatus}' to:`,
    title: `Task ${_taskId}`
  });

  if (newStatus && newStatus !== currentStatus) {
    await updateTaskStatus(uri, newStatus, handleChange);
  }
}

export async function startTask(uri: vscode.Uri, taskId: string, handleChange: HandleChangeFn) {
  await updateTaskStatus(uri, 'in-progress', handleChange);

  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);

  const reqId = fm.requirement || 'unknown';
  const designId = fm.design || 'unknown';
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  let taskContent = text;
  if (taskId.includes('-T')) {
    const lines = text.split(/\r?\n/);
    const taskNumber = taskId.split('-T')[1];
    const taskStartPattern = new RegExp(`^###\\s+Task\\s+${taskNumber}:\\s+`, 'i');

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
      taskContent = lines.slice(startIdx, endIdx).join('\n');
    }
  }

  const chatPrompt = `I need to implement this task. Please analyze the requirement and design, then create/edit files as needed.

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Requirement:** ${reqId}
**Design:** ${designId}

**Task Details:**
\`\`\`markdown
${taskContent}
\`\`\`

**ACTION REQUIRED:**
1. Read the requirement file \`${reqId}.md\` from docs/requirements/
2. Read the design file \`${designId}.md\` from docs/designs/
3. Analyze the task implementation steps and acceptance criteria above
4. Generate/modify code files to implement this task
5. Follow the design architecture and patterns

Please start implementing this task now. Create or edit files directly using @workspace agent mode.`;

  await vscode.commands.executeCommand('workbench.action.chat.openEditSession', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(`🚀 Task ${taskId} started! Copilot is implementing in Edit mode...`);
}

export async function completeTask(uri: vscode.Uri, taskId: string, handleChange: HandleChangeFn) {
  const confirm = await vscode.window.showInformationMessage(
    `Mark task ${taskId} as complete?`,
    'Yes', 'No'
  );

  if (confirm === 'Yes') {
    await updateTaskStatus(uri, 'done', handleChange);
    vscode.window.showInformationMessage(`🎉 Task ${taskId} completed! Status: done`);
  }
}

export async function blockTask(uri: vscode.Uri, taskId: string, handleChange: HandleChangeFn) {
  const reason = await vscode.window.showInputBox({
    prompt: 'Why is this task blocked?',
    placeHolder: 'e.g., Waiting for API credentials'
  });

  if (reason !== undefined) {
    await updateTaskStatus(uri, 'blocked', handleChange);

    const doc = await vscode.workspace.openTextDocument(uri);
    const timestamp = new Date().toISOString();
    const blockerNote = `\n\n---\n**BLOCKED** (${timestamp}): ${reason}\n---\n`;

    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(doc.lineCount, 0), blockerNote);
    await vscode.workspace.applyEdit(edit);

    vscode.window.showWarningMessage(`🚫 Task ${taskId} blocked: ${reason}`);
  }
}

export async function reopenTask(uri: vscode.Uri, taskId: string, handleChange: HandleChangeFn) {
  await updateTaskStatus(uri, 'in-progress', handleChange);
  vscode.window.showInformationMessage(`🔄 Task ${taskId} reopened! Status: in-progress`);
}

export async function unblockTask(uri: vscode.Uri, taskId: string, handleChange: HandleChangeFn) {
  await updateTaskStatus(uri, 'in-progress', handleChange);
  vscode.window.showInformationMessage(`✅ Task ${taskId} unblocked! Status: in-progress`);
}

export async function executeTask(uri: vscode.Uri, taskId: string) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);

  const reqId = fm.requirement || 'unknown';
  const designId = fm.design || 'unknown';
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  const chatPrompt = `@workspace I'm working on implementing this task:

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Requirement:** ${reqId}
**Design:** ${designId}

**Task Details:**
\`\`\`markdown
${text}
\`\`\`

I need help implementing this task. Please:

1. **Analyze the task requirements** from the Implementation Details section
2. **Review the requirement context** by reading ${reqId}
3. **Review the design decisions** by reading ${designId}
4. **Provide step-by-step guidance** for implementing this task
5. **Generate code** if applicable (following the design architecture)
6. **Help me verify** the acceptance criteria

What should I implement first for this task?`;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(
    `🤖 Copilot Chat opened with context for ${taskId}. Ask questions and get implementation help!`
  );
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

    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: chatPrompt
    });

    vscode.window.showInformationMessage(`📝 Copilot is analyzing changes for ${taskId}...`);
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to view task changes: ${e.message}`);
  }
}

async function updateTaskStatus(uri: vscode.Uri, newStatus: string, handleChange: HandleChangeFn) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);

  if (!fmMatch) {
    vscode.window.showErrorMessage('Could not find task front-matter');
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
    doc.positionAt(fmMatch[0].length)
  );
  edit.replace(uri, fmRange, newFm);

  await vscode.workspace.applyEdit(edit);
  await doc.save();

  await handleChange(uri);
}
