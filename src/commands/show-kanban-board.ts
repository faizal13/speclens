import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Kanban Task Board - Visual task management
 *
 * Interactive drag-and-drop board for managing tasks
 * Supports: Pending → In Progress → Blocked → Done
 */

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'done';
  description: string;
  acceptanceCriteria: string[];
  estimatedHours: number;
  dependencies: string[];
  tags: string[];
}

interface KanbanBoard {
  featureName: string;
  featurePath: string;
  tasks: Task[];
  columns: {
    pending: Task[];
    inProgress: Task[];
    blocked: Task[];
    done: Task[];
  };
  metrics: {
    totalTasks: number;
    totalHours: number;
    completedHours: number;
    remainingHours: number;
    velocity: number; // tasks completed per day (if tracking)
  };
}

/**
 * Show Kanban board for a feature
 */
export async function showKanbanBoard(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Find all tasks.md files
  const taskFiles = await vscode.workspace.findFiles('specs/*/tasks.md');

  if (taskFiles.length === 0) {
    vscode.window.showErrorMessage('No tasks found. Create tasks first.');
    return;
  }

  // Let user select which feature to view
  let selectedTaskUri: vscode.Uri;

  if (taskFiles.length === 1) {
    selectedTaskUri = taskFiles[0];
  } else {
    const items = taskFiles.map(uri => {
      const featureName = path.basename(path.dirname(uri.fsPath));
      return {
        label: featureName,
        description: uri.fsPath,
        uri: uri
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a feature to view Kanban board',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedTaskUri = selected.uri;
  }

  const featurePath = path.dirname(selectedTaskUri.fsPath);
  const featureName = path.basename(featurePath);

  // Build Kanban board
  const board = await buildKanbanBoard(featurePath, featureName);

  // Show board in webview panel
  showKanbanBoardPanel(board);
}

/**
 * Build Kanban board from tasks.md
 */
async function buildKanbanBoard(featurePath: string, featureName: string): Promise<KanbanBoard> {
  const tasks: Task[] = [];

  try {
    const tasksUri = vscode.Uri.file(path.join(featurePath, 'tasks.md'));
    const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
    const tasksText = Buffer.from(tasksContent).toString('utf8');

    // Split into task sections
    const taskSections = tasksText.split(/^##\s+Task\s+(\d+):/gm);

    for (let i = 1; i < taskSections.length; i += 2) {
      const taskNum = taskSections[i];
      const taskContent = taskSections[i + 1];

      // Extract title
      const titleMatch = taskContent.match(/^(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : `Task ${taskNum}`;

      // Extract description
      const descMatch = taskContent.match(/\*\*Description:\*\*\s*(.+)/);
      const description = descMatch ? descMatch[1].trim() : '';

      // Extract status — handles emojis, spaces, all variants
      const statusMatch = taskContent.match(/\*\*Status:\*\*\s*[^\w]*([\w][^\n]*)/i);
      let status: 'pending' | 'in-progress' | 'blocked' | 'done' = 'pending';
      if (statusMatch) {
        const s = statusMatch[1].replace(/^[\s\u00a0\u2000-\u206f\u2e00-\u2e7f\ufeff\u{1f000}-\u{1ffff}\u{20000}-\u{2ffff}]+/u, '').trim().toLowerCase();
        if (s.startsWith('done') || s.startsWith('completed') || s.startsWith('complete')) status = 'done';
        else if (s.startsWith('in-progress') || s.startsWith('in progress') || s.startsWith('inprogress')) status = 'in-progress';
        else if (s.startsWith('blocked')) status = 'blocked';
      }

      // Extract estimated hours
      const hoursMatch = taskContent.match(/\*\*Estimated\s+Time:\*\*\s*(\d+)\s*hours?/i);
      const estimatedHours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;

      // Extract acceptance criteria
      const acceptanceCriteria: string[] = [];
      const acSection = taskContent.match(/\*\*Acceptance\s+Criteria:\*\*([\s\S]*?)(?=\*\*|$)/i);
      if (acSection) {
        const criteriaMatches = acSection[1].matchAll(/[-*]\s+(.+)/g);
        for (const match of criteriaMatches) {
          acceptanceCriteria.push(match[1].trim());
        }
      }

      // Extract dependencies
      const dependencies: string[] = [];
      const depMatch = taskContent.match(/\*\*Dependencies:\*\*\s*(.+)/i);
      if (depMatch) {
        const depText = depMatch[1].trim();
        if (depText.toLowerCase() !== 'none') {
          dependencies.push(...depText.split(',').map(d => d.trim()));
        }
      }

      // Extract tags (from title or description)
      const tags: string[] = [];
      if (title.toLowerCase().includes('api')) tags.push('API');
      if (title.toLowerCase().includes('database') || title.toLowerCase().includes('schema')) tags.push('Database');
      if (title.toLowerCase().includes('test')) tags.push('Testing');
      if (title.toLowerCase().includes('security')) tags.push('Security');
      if (title.toLowerCase().includes('ui') || title.toLowerCase().includes('frontend')) tags.push('Frontend');
      if (title.toLowerCase().includes('backend')) tags.push('Backend');

      tasks.push({
        id: `TASK-${taskNum}`,
        title,
        status,
        description,
        acceptanceCriteria,
        estimatedHours,
        dependencies,
        tags
      });
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error reading tasks: ${error}`);
  }

  // Organize into columns
  const columns = {
    pending: tasks.filter(t => t.status === 'pending'),
    inProgress: tasks.filter(t => t.status === 'in-progress'),
    blocked: tasks.filter(t => t.status === 'blocked'),
    done: tasks.filter(t => t.status === 'done')
  };

  // Calculate metrics
  const totalTasks = tasks.length;
  const totalHours = tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
  const completedHours = tasks.filter(t => t.status === 'done').reduce((sum, t) => sum + t.estimatedHours, 0);
  const remainingHours = totalHours - completedHours;

  return {
    featureName,
    featurePath,
    tasks,
    columns,
    metrics: {
      totalTasks,
      totalHours,
      completedHours,
      remainingHours,
      velocity: 0 // TODO: calculate from task completion timestamps
    }
  };
}

/**
 * Create and show Kanban board webview
 */
function showKanbanBoardPanel(board: KanbanBoard): void {
  const panel = vscode.window.createWebviewPanel(
    'speclensKanban',
    `Kanban: ${board.featureName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(board);

  // Handle status update messages from webview
  panel.webview.onDidReceiveMessage(
    async message => {
      if (message.command === 'updateStatus') {
        await updateTaskStatus(board.featurePath, message.taskId, message.newStatus);
        // Refresh board
        const updatedBoard = await buildKanbanBoard(board.featurePath, board.featureName);
        panel.webview.html = getWebviewContent(updatedBoard);
        vscode.window.showInformationMessage(`Task ${message.taskId} moved to ${message.newStatus}`);
      } else if (message.command === 'viewTask') {
        // Open tasks.md at the specific task
        const tasksUri = vscode.Uri.file(path.join(board.featurePath, 'tasks.md'));
        const doc = await vscode.workspace.openTextDocument(tasksUri);
        const editor = await vscode.window.showTextDocument(doc);

        // Find task position and scroll to it
        const text = doc.getText();
        const taskIndex = text.indexOf(`## Task ${message.taskId.replace('TASK-', '')}:`);
        if (taskIndex > -1) {
          const position = doc.positionAt(taskIndex);
          editor.selection = new vscode.Selection(position, position);
          editor.revealRange(new vscode.Range(position, position), vscode.TextEditorRevealType.InCenter);
        }
      }
    },
    undefined
  );
}

/**
 * Update task status in tasks.md
 */
async function updateTaskStatus(featurePath: string, taskId: string, newStatus: string): Promise<void> {
  const tasksUri = vscode.Uri.file(path.join(featurePath, 'tasks.md'));
  const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
  let tasksText = Buffer.from(tasksContent).toString('utf8');

  const taskNum = taskId.replace('TASK-', '');
  const taskRegex = new RegExp(`(## Task ${taskNum}:[\\s\\S]*?\\*\\*Status:\\*\\*)\\s*\\w+`, 'i');

  // Map status to format used in tasks.md
  const statusMap: Record<string, string> = {
    'pending': 'Pending',
    'in-progress': 'In Progress',
    'blocked': 'Blocked',
    'done': 'Done'
  };

  tasksText = tasksText.replace(taskRegex, `$1 ${statusMap[newStatus] || newStatus}`);

  await vscode.workspace.fs.writeFile(tasksUri, Buffer.from(tasksText, 'utf8'));
}

/**
 * Generate HTML content for Kanban board
 */
function getWebviewContent(board: KanbanBoard): string {
  const renderTask = (task: Task) => `
    <div class="task-card" draggable="true" data-task-id="${task.id}" data-status="${task.status}">
      <div class="task-header">
        <span class="task-id">${task.id}</span>
        ${task.tags.map(tag => `<span class="task-tag">${tag}</span>`).join('')}
      </div>
      <div class="task-title">${task.title}</div>
      ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
      ${task.estimatedHours > 0 ? `<div class="task-estimate">⏱️ ${task.estimatedHours}h</div>` : ''}
      ${task.dependencies.length > 0 ? `
        <div class="task-dependencies">
          🔗 Depends on: ${task.dependencies.join(', ')}
        </div>
      ` : ''}
      <div class="task-criteria-count">
        ✓ ${task.acceptanceCriteria.length} acceptance criteria
      </div>
      <button class="view-task-btn" onclick="viewTask('${task.id}')">View Details</button>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kanban Board</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      margin: 0;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 {
      color: var(--vscode-editor-foreground);
      border-bottom: 2px solid var(--vscode-panel-border);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    .metric-value {
      font-size: 28px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 5px;
    }
    .board {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 20px;
      margin-top: 30px;
    }
    .column {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-radius: 8px;
      padding: 15px;
      min-height: 400px;
    }
    .column-header {
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .column-count {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-radius: 50%;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }
    .task-card {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 10px;
      cursor: move;
      transition: all 0.2s;
    }
    .task-card:hover {
      box-shadow: 0 4px 8px rgba(0,0,0,0.2);
      transform: translateY(-2px);
    }
    .task-card.dragging {
      opacity: 0.5;
    }
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .task-id {
      font-size: 11px;
      font-weight: bold;
      color: var(--vscode-descriptionForeground);
    }
    .task-tag {
      display: inline-block;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 3px;
      margin-left: 4px;
    }
    .task-title {
      font-weight: 600;
      margin-bottom: 6px;
      font-size: 14px;
    }
    .task-description {
      font-size: 12px;
      opacity: 0.8;
      margin-bottom: 8px;
    }
    .task-estimate {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 6px;
    }
    .task-dependencies {
      font-size: 11px;
      color: #f0ad4e;
      margin-bottom: 6px;
    }
    .task-criteria-count {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .view-task-btn {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      width: 100%;
    }
    .view-task-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    .column.drag-over {
      background-color: var(--vscode-list-hoverBackground);
      border: 2px dashed var(--vscode-textLink-foreground);
    }
    .progress-bar {
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      height: 24px;
      margin: 20px 0;
      overflow: hidden;
      position: relative;
    }
    .progress-fill {
      background-color: #28a745;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
  </style>
</head>
<body>
  <h1>📋 Kanban Board: ${board.featureName}</h1>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value">${board.metrics.totalTasks}</div>
      <div class="metric-label">Total Tasks</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #28a745">${board.columns.done.length}</div>
      <div class="metric-label">Done</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${board.metrics.totalHours}h</div>
      <div class="metric-label">Total Hours</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #f0ad4e">${board.metrics.remainingHours}h</div>
      <div class="metric-label">Remaining</div>
    </div>
  </div>

  <div class="progress-bar">
    <div class="progress-fill" style="width: ${board.metrics.totalTasks > 0 ? Math.round((board.columns.done.length / board.metrics.totalTasks) * 100) : 0}%">
      ${board.metrics.totalTasks > 0 ? Math.round((board.columns.done.length / board.metrics.totalTasks) * 100) : 0}% Complete
    </div>
  </div>

  <div class="board">
    <div class="column" data-status="pending">
      <div class="column-header">
        ⏸️ Pending
        <span class="column-count">${board.columns.pending.length}</span>
      </div>
      ${board.columns.pending.map(renderTask).join('')}
    </div>

    <div class="column" data-status="in-progress">
      <div class="column-header">
        🔄 In Progress
        <span class="column-count">${board.columns.inProgress.length}</span>
      </div>
      ${board.columns.inProgress.map(renderTask).join('')}
    </div>

    <div class="column" data-status="blocked">
      <div class="column-header">
        🚫 Blocked
        <span class="column-count">${board.columns.blocked.length}</span>
      </div>
      ${board.columns.blocked.map(renderTask).join('')}
    </div>

    <div class="column" data-status="done">
      <div class="column-header">
        ✅ Done
        <span class="column-count">${board.columns.done.length}</span>
      </div>
      ${board.columns.done.map(renderTask).join('')}
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let draggedTask = null;

    // Drag and drop handlers
    document.querySelectorAll('.task-card').forEach(card => {
      card.addEventListener('dragstart', (e) => {
        draggedTask = e.target;
        e.target.classList.add('dragging');
      });

      card.addEventListener('dragend', (e) => {
        e.target.classList.remove('dragging');
        draggedTask = null;
      });
    });

    document.querySelectorAll('.column').forEach(column => {
      column.addEventListener('dragover', (e) => {
        e.preventDefault();
        column.classList.add('drag-over');
      });

      column.addEventListener('dragleave', () => {
        column.classList.remove('drag-over');
      });

      column.addEventListener('drop', (e) => {
        e.preventDefault();
        column.classList.remove('drag-over');

        if (draggedTask) {
          const newStatus = column.dataset.status;
          const taskId = draggedTask.dataset.taskId;
          const oldStatus = draggedTask.dataset.status;

          if (newStatus !== oldStatus) {
            // Send update to extension
            vscode.postMessage({
              command: 'updateStatus',
              taskId: taskId,
              newStatus: newStatus
            });
          }
        }
      });
    });

    function viewTask(taskId) {
      vscode.postMessage({
        command: 'viewTask',
        taskId: taskId
      });
    }
  </script>
</body>
</html>`;
}
