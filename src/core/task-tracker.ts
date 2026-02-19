import * as vscode from 'vscode';
import * as path from 'path';
import * as child_process from 'child_process';

/**
 * Task Tracker - Tracks file changes per task using git
 *
 * When a task starts:
 * - Records the current git HEAD commit hash
 * - Saves to .speclens/active-task.json
 *
 * When reviewing a task:
 * - Compares current state with the saved commit hash
 * - Shows all files changed/created since the task started
 *
 * When completing a task:
 * - Requires review approval before marking done
 * - Clears active task tracking
 */

export interface ActiveTaskInfo {
  taskId: string;
  taskTitle: string;
  featurePath: string;
  tasksFileUri: string;
  startedAt: string;
  startCommitHash: string;
  startFileSnapshot: string[];  // List of tracked files at start
}

export interface TaskChanges {
  modifiedFiles: string[];
  addedFiles: string[];
  deletedFiles: string[];
  untrackedFiles: string[];
  totalChanges: number;
}

/**
 * Parse task dependencies from tasks.md content
 * Returns a map of taskId -> dependency taskIds
 */
export function parseTaskDependencies(tasksText: string): Map<string, string[]> {
  const deps = new Map<string, string[]>();
  const sections = tasksText.split(/^##\s+Task\s+(\d+):/gm);

  for (let i = 1; i < sections.length; i += 2) {
    const taskNum = sections[i];
    const taskContent = sections[i + 1] || '';
    const taskId = `TASK-${taskNum}`;

    const depMatch = taskContent.match(/\*\*Dependencies:\*\*\s*(.+)/i);
    if (depMatch) {
      const depText = depMatch[1].trim();
      if (depText.toLowerCase() !== 'none') {
        // Parse "Task 1, Task 2" or "Task 1" format
        const depIds = depText.split(',').map(d => {
          const trimmed = d.trim();
          const numMatch = trimmed.match(/(?:Task\s+)?(\d+)/i);
          return numMatch ? `TASK-${numMatch[1]}` : trimmed;
        }).filter(d => d.startsWith('TASK-'));
        deps.set(taskId, depIds);
      } else {
        deps.set(taskId, []);
      }
    } else {
      deps.set(taskId, []);
    }
  }

  return deps;
}

/**
 * Normalise any status string variant → 'pending' | 'in-progress' | 'blocked' | 'done'
 * Handles emoji prefixes (e.g. "✅ Completed"), multi-word values, and case variations.
 */
function normaliseStatus(raw: string): string {
  // Strip leading/trailing emojis, whitespace and punctuation
  const clean = raw.replace(/^[\s\u00a0\u2000-\u206f\u2e00-\u2e7f\ufeff\u{1f000}-\u{1ffff}\u{20000}-\u{2ffff}]+/u, '').trim().toLowerCase();
  if (clean.startsWith('done') || clean.startsWith('completed') || clean.startsWith('complete')) return 'done';
  if (clean.startsWith('in-progress') || clean.startsWith('in progress') || clean.startsWith('inprogress')) return 'in-progress';
  if (clean.startsWith('blocked')) return 'blocked';
  if (clean.startsWith('todo') || clean.startsWith('pending') || clean.startsWith('not started')) return 'pending';
  return 'pending';
}

/**
 * Parse task statuses from tasks.md content
 */
export function parseTaskStatuses(tasksText: string): Map<string, string> {
  const statuses = new Map<string, string>();
  const sections = tasksText.split(/^##\s+Task\s+(\d+):/gm);

  for (let i = 1; i < sections.length; i += 2) {
    const taskNum = sections[i];
    const taskContent = sections[i + 1] || '';
    const taskId = `TASK-${taskNum}`;

    const statusMatch = taskContent.match(/\*\*Status:\*\*\s*[^\w]*([\w][^\n]*)/i);
    if (statusMatch) {
      statuses.set(taskId, normaliseStatus(statusMatch[1]));
    } else {
      statuses.set(taskId, 'pending');
    }
  }

  return statuses;
}

/**
 * Check if a task's dependencies are all completed
 * Returns { canStart, blockers } where blockers lists incomplete dependency tasks
 */
export function checkDependencies(
  taskId: string,
  dependencies: Map<string, string[]>,
  statuses: Map<string, string>
): { canStart: boolean; blockers: Array<{ taskId: string; status: string }> } {
  const deps = dependencies.get(taskId) || [];
  const blockers: Array<{ taskId: string; status: string }> = [];

  for (const depId of deps) {
    const depStatus = statuses.get(depId) || 'pending';
    if (depStatus !== 'done') {
      blockers.push({ taskId: depId, status: depStatus });
    }
  }

  return {
    canStart: blockers.length === 0,
    blockers
  };
}

/**
 * Check if any other task is currently in progress
 */
export function getActiveInProgressTasks(
  statuses: Map<string, string>,
  excludeTaskId?: string
): string[] {
  const active: string[] = [];
  for (const [taskId, status] of statuses) {
    if (status === 'in-progress' && taskId !== excludeTaskId) {
      active.push(taskId);
    }
  }
  return active;
}

/**
 * Get the workspace root folder
 */
function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath;
}

/**
 * Get the .speclens tracking directory path
 */
function getTrackingDir(): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;
  return path.join(root, '.speclens');
}

/**
 * Run a git command in the workspace root
 */
function runGitCommand(args: string[]): string | undefined {
  const root = getWorkspaceRoot();
  if (!root) return undefined;

  try {
    const result = child_process.execSync(`git ${args.join(' ')}`, {
      cwd: root,
      encoding: 'utf8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return result.trim();
  } catch (e: any) {
    console.log(`[SpecLens] Git command failed: git ${args.join(' ')} - ${e.message}`);
    return undefined;
  }
}

/**
 * Get current git HEAD commit hash
 */
export function getCurrentCommitHash(): string | undefined {
  return runGitCommand(['rev-parse', 'HEAD']);
}

/**
 * Get list of tracked files at current state
 */
function getTrackedFiles(): string[] {
  const result = runGitCommand(['ls-files']);
  return result ? result.split('\n').filter(f => f.length > 0) : [];
}

/**
 * Get files changed since a specific commit
 */
export function getFileChangesSince(commitHash: string): TaskChanges {
  const changes: TaskChanges = {
    modifiedFiles: [],
    addedFiles: [],
    deletedFiles: [],
    untrackedFiles: [],
    totalChanges: 0
  };

  // Get diff of tracked files since the commit
  const diffResult = runGitCommand(['diff', '--name-status', commitHash, 'HEAD']);
  if (diffResult) {
    for (const line of diffResult.split('\n')) {
      if (!line.trim()) continue;
      const [status, ...fileParts] = line.split('\t');
      const file = fileParts.join('\t');
      if (!file) continue;

      switch (status[0]) {
        case 'M': changes.modifiedFiles.push(file); break;
        case 'A': changes.addedFiles.push(file); break;
        case 'D': changes.deletedFiles.push(file); break;
        case 'R': changes.modifiedFiles.push(file); break;
      }
    }
  }

  // Also get staged but uncommitted changes
  const stagedResult = runGitCommand(['diff', '--name-status', '--cached']);
  if (stagedResult) {
    for (const line of stagedResult.split('\n')) {
      if (!line.trim()) continue;
      const [status, ...fileParts] = line.split('\t');
      const file = fileParts.join('\t');
      if (!file) continue;

      switch (status[0]) {
        case 'M':
          if (!changes.modifiedFiles.includes(file)) changes.modifiedFiles.push(file);
          break;
        case 'A':
          if (!changes.addedFiles.includes(file)) changes.addedFiles.push(file);
          break;
        case 'D':
          if (!changes.deletedFiles.includes(file)) changes.deletedFiles.push(file);
          break;
      }
    }
  }

  // Get unstaged changes
  const unstagedResult = runGitCommand(['diff', '--name-status']);
  if (unstagedResult) {
    for (const line of unstagedResult.split('\n')) {
      if (!line.trim()) continue;
      const [status, ...fileParts] = line.split('\t');
      const file = fileParts.join('\t');
      if (!file) continue;

      switch (status[0]) {
        case 'M':
          if (!changes.modifiedFiles.includes(file)) changes.modifiedFiles.push(file);
          break;
        case 'A':
          if (!changes.addedFiles.includes(file)) changes.addedFiles.push(file);
          break;
        case 'D':
          if (!changes.deletedFiles.includes(file)) changes.deletedFiles.push(file);
          break;
      }
    }
  }

  // Get untracked files
  const untrackedResult = runGitCommand(['ls-files', '--others', '--exclude-standard']);
  if (untrackedResult) {
    changes.untrackedFiles = untrackedResult.split('\n').filter(f => f.trim().length > 0);
  }

  changes.totalChanges = changes.modifiedFiles.length + changes.addedFiles.length +
    changes.deletedFiles.length + changes.untrackedFiles.length;

  return changes;
}

/**
 * Save active task info to .speclens/active-task.json
 */
export async function saveActiveTask(info: ActiveTaskInfo): Promise<void> {
  const trackingDir = getTrackingDir();
  if (!trackingDir) return;

  const dirUri = vscode.Uri.file(trackingDir);
  try {
    await vscode.workspace.fs.stat(dirUri);
  } catch {
    await vscode.workspace.fs.createDirectory(dirUri);
  }

  const filePath = path.join(trackingDir, 'active-task.json');
  const content = JSON.stringify(info, null, 2);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(content, 'utf8')
  );

  // Add .speclens to .gitignore if not already there
  await ensureGitignore(trackingDir);
}

/**
 * Load active task info
 */
export async function loadActiveTask(): Promise<ActiveTaskInfo | undefined> {
  const trackingDir = getTrackingDir();
  if (!trackingDir) return undefined;

  const filePath = path.join(trackingDir, 'active-task.json');
  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    return JSON.parse(Buffer.from(content).toString('utf8'));
  } catch {
    return undefined;
  }
}

/**
 * Clear active task tracking
 */
export async function clearActiveTask(): Promise<void> {
  const trackingDir = getTrackingDir();
  if (!trackingDir) return;

  const filePath = path.join(trackingDir, 'active-task.json');
  try {
    await vscode.workspace.fs.delete(vscode.Uri.file(filePath));
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Save completed task record for history
 */
export async function saveTaskCompletion(taskId: string, changes: TaskChanges): Promise<void> {
  const trackingDir = getTrackingDir();
  if (!trackingDir) return;

  const historyDir = path.join(trackingDir, 'history');
  const historyDirUri = vscode.Uri.file(historyDir);
  try {
    await vscode.workspace.fs.stat(historyDirUri);
  } catch {
    await vscode.workspace.fs.createDirectory(historyDirUri);
  }

  const record = {
    taskId,
    completedAt: new Date().toISOString(),
    changes: {
      modified: changes.modifiedFiles,
      added: changes.addedFiles,
      deleted: changes.deletedFiles,
      untracked: changes.untrackedFiles
    }
  };

  const filePath = path.join(historyDir, `${taskId}.json`);
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(JSON.stringify(record, null, 2), 'utf8')
  );
}

/**
 * Load completed task changes from history
 */
export async function loadTaskHistory(taskId: string): Promise<TaskChanges | undefined> {
  const trackingDir = getTrackingDir();
  if (!trackingDir) return undefined;

  const filePath = path.join(trackingDir, 'history', `${taskId}.json`);
  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
    const record = JSON.parse(Buffer.from(content).toString('utf8'));
    return {
      modifiedFiles: record.changes.modified || [],
      addedFiles: record.changes.added || [],
      deletedFiles: record.changes.deleted || [],
      untrackedFiles: record.changes.untracked || [],
      totalChanges: (record.changes.modified?.length || 0) + (record.changes.added?.length || 0) +
        (record.changes.deleted?.length || 0) + (record.changes.untracked?.length || 0)
    };
  } catch {
    return undefined;
  }
}

/**
 * Ensure .speclens/ is in .gitignore
 */
async function ensureGitignore(trackingDir: string): Promise<void> {
  const root = getWorkspaceRoot();
  if (!root) return;

  const gitignorePath = path.join(root, '.gitignore');
  try {
    const content = await vscode.workspace.fs.readFile(vscode.Uri.file(gitignorePath));
    const text = Buffer.from(content).toString('utf8');
    if (!text.includes('.speclens/') && !text.includes('.speclens\n')) {
      const newContent = text.trimEnd() + '\n\n# SpecLens tracking data\n.speclens/\n';
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(gitignorePath),
        Buffer.from(newContent, 'utf8')
      );
    }
  } catch {
    // No .gitignore, create one
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(gitignorePath),
      Buffer.from('# SpecLens tracking data\n.speclens/\n', 'utf8')
    );
  }
}

/**
 * Get a diff summary for a specific file since the start commit
 */
export function getFileDiff(commitHash: string, filePath: string): string | undefined {
  return runGitCommand(['diff', commitHash, '--', filePath]);
}
