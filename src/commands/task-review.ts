import * as vscode from 'vscode';
import {
  TaskChanges,
  loadActiveTask,
  getFileChangesSince,
  saveTaskCompletion,
  clearActiveTask,
  loadTaskHistory
} from '../core/task-tracker';

/**
 * Task Review Webview
 *
 * Shows all files changed/created during a task execution.
 * User must approve changes before the task is marked as done.
 */

/**
 * Show review panel for the current active task
 * Returns true if user approves, false if user rejects or cancels
 */
export async function showTaskReview(
  uri: vscode.Uri,
  taskId: string,
  updateStatusFn: (uri: vscode.Uri, newStatus: string, handleChange: (...args: any[]) => Promise<void>, taskId: string) => Promise<void>,
  handleChange: (...args: any[]) => Promise<void>
): Promise<boolean> {
  const activeTask = await loadActiveTask();

  let changes: TaskChanges;
  let startCommit: string;

  if (activeTask && activeTask.taskId === taskId) {
    // Active task — get changes since it started
    startCommit = activeTask.startCommitHash;
    changes = getFileChangesSince(startCommit);
  } else {
    // Try loading from history (task was already completed)
    const history = await loadTaskHistory(taskId);
    if (history) {
      return showHistoricalReview(taskId, history);
    }

    // No tracking data — fall back to showing a simple confirmation
    const confirm = await vscode.window.showInformationMessage(
      `No change tracking data for ${taskId}. Mark as complete anyway?`,
      'Yes, Complete',
      'Cancel'
    );
    if (confirm === 'Yes, Complete') {
      await updateStatusFn(uri, 'done', handleChange, taskId);
      vscode.window.showInformationMessage(`Task ${taskId} completed!`);
      return true;
    }
    return false;
  }

  if (changes.totalChanges === 0) {
    const confirm = await vscode.window.showInformationMessage(
      `No file changes detected for ${taskId}. The task may have been implemented before tracking started.\n\nMark as complete?`,
      'Yes, Complete',
      'Cancel'
    );
    if (confirm === 'Yes, Complete') {
      await updateStatusFn(uri, 'done', handleChange, taskId);
      await saveTaskCompletion(taskId, changes);
      await clearActiveTask();
      vscode.window.showInformationMessage(`Task ${taskId} completed!`);
      return true;
    }
    return false;
  }

  // Show review webview
  return new Promise<boolean>((resolve) => {
    const panel = vscode.window.createWebviewPanel(
      'speclensTaskReview',
      `Review: ${taskId}`,
      vscode.ViewColumn.One,
      { enableScripts: true }
    );

    panel.webview.html = getReviewWebviewContent(taskId, changes, startCommit);

    panel.webview.onDidReceiveMessage(
      async message => {
        if (message.command === 'approve') {
          await updateStatusFn(uri, 'done', handleChange, taskId);
          await saveTaskCompletion(taskId, changes);
          await clearActiveTask();
          vscode.window.showInformationMessage(`Task ${taskId} approved and completed!`);
          panel.dispose();
          resolve(true);
        } else if (message.command === 'reject') {
          vscode.window.showInformationMessage(
            `Task ${taskId} review rejected. Task remains in progress — continue working on it.`
          );
          panel.dispose();
          resolve(false);
        } else if (message.command === 'viewFile') {
          // Open the file in the editor
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root) {
            const fileUri = vscode.Uri.file(`${root}/${message.filePath}`);
            try {
              const doc = await vscode.workspace.openTextDocument(fileUri);
              await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
            } catch {
              vscode.window.showErrorMessage(`Could not open file: ${message.filePath}`);
            }
          }
        } else if (message.command === 'viewDiff') {
          // Show diff for a specific file
          const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
          if (root) {
            try {
              await vscode.commands.executeCommand('vscode.diff',
                vscode.Uri.parse(`git://${message.filePath}?${startCommit}`),
                vscode.Uri.file(`${root}/${message.filePath}`),
                `${message.filePath} (Task ${taskId} changes)`
              );
            } catch {
              // If git diff command fails, try opening the file directly
              const fileUri = vscode.Uri.file(`${root}/${message.filePath}`);
              try {
                const doc = await vscode.workspace.openTextDocument(fileUri);
                await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
              } catch {
                vscode.window.showErrorMessage(`Could not open file: ${message.filePath}`);
              }
            }
          }
        }
      },
      undefined
    );

    // If panel is closed without action, treat as rejection
    panel.onDidDispose(() => {
      resolve(false);
    });
  });
}

/**
 * Show historical review (read-only view of completed task changes)
 */
async function showHistoricalReview(taskId: string, changes: TaskChanges): Promise<boolean> {
  const panel = vscode.window.createWebviewPanel(
    'speclensTaskHistory',
    `History: ${taskId}`,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  panel.webview.html = getHistoryWebviewContent(taskId, changes);

  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'viewFile') {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (root) {
          const fileUri = vscode.Uri.file(`${root}/${message.filePath}`);
          try {
            const doc = await vscode.workspace.openTextDocument(fileUri);
            await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside);
          } catch {
            vscode.window.showErrorMessage(`Could not open file: ${message.filePath}`);
          }
        }
      }
    }
  );

  return false; // Historical view doesn't change status
}

/**
 * Generate review webview content for active task
 */
function getReviewWebviewContent(taskId: string, changes: TaskChanges, startCommit: string): string {
  const renderFileList = (files: string[], icon: string, category: string) => {
    if (files.length === 0) return '';
    return `
      <div class="file-category">
        <h3>${icon} ${category} (${files.length})</h3>
        <div class="file-list">
          ${files.map(f => `
            <div class="file-item">
              <span class="file-path">${f}</span>
              <div class="file-actions">
                <button class="btn-small" onclick="viewFile('${escapeHtml(f)}')">Open</button>
                ${category !== 'Deleted' ? `<button class="btn-small btn-diff" onclick="viewDiff('${escapeHtml(f)}')">Diff</button>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task Review</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 { color: var(--vscode-editor-foreground); margin-bottom: 5px; }
    .subtitle { opacity: 0.7; margin-bottom: 20px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 12px;
      margin: 20px 0;
    }
    .summary-card {
      background: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 6px;
      text-align: center;
    }
    .summary-value {
      font-size: 24px;
      font-weight: bold;
    }
    .summary-label {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.7;
      margin-top: 4px;
    }
    .modified { color: #e2b93d; }
    .added { color: #28a745; }
    .deleted { color: #cb2431; }
    .untracked { color: #6f42c1; }
    .file-category {
      margin: 20px 0;
    }
    .file-category h3 {
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .file-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 13px;
    }
    .file-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .file-actions {
      display: flex;
      gap: 6px;
    }
    .btn-small {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .btn-small:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }
    .btn-diff {
      background: var(--vscode-textLink-foreground);
      color: white;
    }
    .action-bar {
      position: sticky;
      bottom: 0;
      background: var(--vscode-editor-background);
      padding: 20px 0;
      border-top: 2px solid var(--vscode-panel-border);
      margin-top: 30px;
      display: flex;
      gap: 12px;
      justify-content: center;
    }
    .btn-approve {
      background: #28a745;
      color: white;
      border: none;
      padding: 12px 30px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 15px;
      font-weight: bold;
    }
    .btn-approve:hover { background: #22863a; }
    .btn-reject {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 12px 30px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 15px;
    }
    .btn-reject:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .info-box {
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-left: 4px solid var(--vscode-textLink-foreground);
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 0 6px 6px 0;
    }
  </style>
</head>
<body>
  <h1>Review Changes: ${taskId}</h1>
  <p class="subtitle">Review all changes made during this task before marking it as complete.</p>

  <div class="info-box">
    Approve to mark the task as <strong>Done</strong>, or reject to keep working on it.
    You can click on any file to view it or see the diff.
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="summary-value modified">${changes.modifiedFiles.length}</div>
      <div class="summary-label">Modified</div>
    </div>
    <div class="summary-card">
      <div class="summary-value added">${changes.addedFiles.length}</div>
      <div class="summary-label">Added</div>
    </div>
    <div class="summary-card">
      <div class="summary-value deleted">${changes.deletedFiles.length}</div>
      <div class="summary-label">Deleted</div>
    </div>
    <div class="summary-card">
      <div class="summary-value untracked">${changes.untrackedFiles.length}</div>
      <div class="summary-label">Untracked</div>
    </div>
    <div class="summary-card">
      <div class="summary-value">${changes.totalChanges}</div>
      <div class="summary-label">Total Changes</div>
    </div>
  </div>

  ${renderFileList(changes.modifiedFiles, '✏️', 'Modified')}
  ${renderFileList(changes.addedFiles, '➕', 'Added')}
  ${renderFileList(changes.deletedFiles, '🗑️', 'Deleted')}
  ${renderFileList(changes.untrackedFiles, '❓', 'Untracked (New Files)')}

  <div class="action-bar">
    <button class="btn-approve" onclick="approve()">✅ Approve & Complete Task</button>
    <button class="btn-reject" onclick="reject()">↩️ Continue Working</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();

    function approve() {
      vscode.postMessage({ command: 'approve' });
    }

    function reject() {
      vscode.postMessage({ command: 'reject' });
    }

    function viewFile(filePath) {
      vscode.postMessage({ command: 'viewFile', filePath: filePath });
    }

    function viewDiff(filePath) {
      vscode.postMessage({ command: 'viewDiff', filePath: filePath });
    }
  </script>
</body>
</html>`;
}

/**
 * Generate historical review webview content (read-only)
 */
function getHistoryWebviewContent(taskId: string, changes: TaskChanges): string {
  const renderFileList = (files: string[], icon: string, category: string) => {
    if (files.length === 0) return '';
    return `
      <div class="file-category">
        <h3>${icon} ${category} (${files.length})</h3>
        <div class="file-list">
          ${files.map(f => `
            <div class="file-item">
              <span class="file-path">${f}</span>
              <button class="btn-small" onclick="viewFile('${escapeHtml(f)}')">Open</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Task History</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 { color: var(--vscode-editor-foreground); }
    .file-category { margin: 20px 0; }
    .file-category h3 {
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .file-list { display: flex; flex-direction: column; gap: 4px; }
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 4px;
      font-family: monospace;
      font-size: 13px;
    }
    .btn-small {
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
    }
    .badge {
      display: inline-block;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <h1>📜 Task History: ${taskId}</h1>
  <p><span class="badge">Completed</span> This is a read-only view of changes made during this task.</p>

  ${renderFileList(changes.modifiedFiles, '✏️', 'Modified')}
  ${renderFileList(changes.addedFiles, '➕', 'Added')}
  ${renderFileList(changes.deletedFiles, '🗑️', 'Deleted')}
  ${renderFileList(changes.untrackedFiles, '❓', 'Untracked')}

  ${changes.totalChanges === 0 ? '<p><em>No file changes were tracked for this task.</em></p>' : ''}

  <script>
    const vscode = acquireVsCodeApi();
    function viewFile(filePath) {
      vscode.postMessage({ command: 'viewFile', filePath: filePath });
    }
  </script>
</body>
</html>`;
}

/**
 * Escape HTML for safe rendering in webview
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
