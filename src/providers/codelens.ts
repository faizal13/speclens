import * as vscode from 'vscode';
import { parseFrontMatter } from '../indexer';
import {
  parseTaskDependencies,
  parseTaskStatuses,
  checkDependencies,
  getActiveInProgressTasks
} from '../core/task-tracker';

/**
 * Normalise any status string variant → 'pending' | 'in-progress' | 'blocked' | 'done'
 * Handles emoji prefixes (e.g. "✅ Completed"), multi-word values, and case variations.
 */
function normaliseStatus(raw: string): string {
  const clean = raw.replace(/^[\s\u00a0\u2000-\u206f\u2e00-\u2e7f\ufeff\u{1f000}-\u{1ffff}\u{20000}-\u{2ffff}]+/u, '').trim().toLowerCase();
  if (clean.startsWith('done') || clean.startsWith('completed') || clean.startsWith('complete')) return 'done';
  if (clean.startsWith('in-progress') || clean.startsWith('in progress') || clean.startsWith('inprogress')) return 'in-progress';
  if (clean.startsWith('blocked')) return 'blocked';
  return 'pending';
}

export class RakdevAiTaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Spec Kit format: specs/*/tasks.md (no front-matter, uses ## Task N:)
    if (document.uri.fsPath.includes('/specs/') && document.uri.fsPath.endsWith('/tasks.md')) {
      return this.provideSpecKitTaskLenses(lines, document, text);
    }

    // Legacy RakDev format: docs/tasks/ (YAML front-matter)
    if (!document.uri.fsPath.includes('/docs/tasks/')) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];

    const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);
    if (!fmMatch) return [];

    const fm = parseFrontMatter(text);
    const docId = fm.id || 'unknown';

    const isTaskBreakdown = docId.startsWith('TASK-DOC-');

    if (isTaskBreakdown) {
      return this.provideBreakdownLenses(lines, docId, document);
    }

    return this.provideSingleTaskLenses(fm, fmMatch, document);
  }

  /**
   * Provide CodeLens for Spec Kit format tasks.md
   * Format: ## Task 1: Title
   *
   * Features:
   * - Dependency-aware: Shows warning if dependencies not met
   * - Single-task rule: Shows warning if another task is in-progress
   * - Change tracking: Shows file change count for active task
   */
  private provideSpecKitTaskLenses(lines: string[], document: vscode.TextDocument, text: string): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    // Parse all task dependencies and statuses upfront
    const dependencies = parseTaskDependencies(text);
    const statuses = parseTaskStatuses(text);
    const activeTasks = getActiveInProgressTasks(statuses);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match: ## Task 1: Setup Database Schema
      const taskMatch = line.match(/^##\s+Task\s+(\d+):\s*(.+?)$/i);
      if (!taskMatch) continue;

      const taskNumber = taskMatch[1];
      const taskTitle = taskMatch[2];
      const taskId = `TASK-${taskNumber}`;

      const taskRange = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));

      // Extract task content (everything until next ## Task or EOF)
      let taskContent = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^##\s+Task\s+\d+:/i)) break;
        if (lines[j].match(/^#\s+/)) break; // Stop at top-level heading
        taskContent += lines[j] + '\n';
      }

      // Extract status from **Status:** field — handles emojis, spaces, all variants
      const statusMatch = taskContent.match(/\*\*Status:\*\*\s*[^\w]*([\w][^\n]*)/i);
      let taskStatus: 'pending' | 'in-progress' | 'blocked' | 'done' = 'pending';
      if (statusMatch) {
        taskStatus = normaliseStatus(statusMatch[1]) as 'pending' | 'in-progress' | 'blocked' | 'done';
      }

      // Extract estimated time
      const hoursMatch = taskContent.match(/\*\*Estimated\s+Time:\*\*\s*(\d+)\s*hours?/i);
      const estimate = hoursMatch ? hoursMatch[1] : '?';

      // Count acceptance criteria checkboxes
      const totalChecks = (taskContent.match(/- \[[ x]\]/gi) || []).length;
      const completedChecks = (taskContent.match(/- \[x\]/gi) || []).length;
      const progressPct = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

      // Check dependency status
      const { canStart, blockers } = checkDependencies(taskId, dependencies, statuses);
      const deps = dependencies.get(taskId) || [];

      // ── Status line ──
      const statusEmoji = taskStatus === 'done' ? '✅' : taskStatus === 'in-progress' ? '🔵' : taskStatus === 'blocked' ? '🔴' : '🟡';
      let statusLine = `${statusEmoji} ${taskStatus.toUpperCase()} | ⏱️ ${estimate}h | 📊 ${progressPct}% (${completedChecks}/${totalChecks})`;

      // Show dependency info
      if (deps.length > 0) {
        const depStatus = canStart ? '✅ deps met' : `⛔ waiting: ${blockers.map(b => b.taskId).join(', ')}`;
        statusLine += ` | ${depStatus}`;
      }

      codeLenses.push(new vscode.CodeLens(taskRange, {
        title: statusLine,
        command: ''
      }));

      // ── Action buttons based on status ──
      if (taskStatus === 'pending') {
        if (!canStart) {
          // Dependencies not met — show disabled-looking start button with warning
          codeLenses.push(new vscode.CodeLens(taskRange, {
            title: '⛔ Start Task (deps not met)',
            command: 'speclens.startTask',
            arguments: [document.uri, taskId]
          }));
        } else {
          codeLenses.push(new vscode.CodeLens(taskRange, {
            title: '▶️ Start Task',
            command: 'speclens.startTask',
            arguments: [document.uri, taskId]
          }));
        }
      } else if (taskStatus === 'in-progress') {
        codeLenses.push(new vscode.CodeLens(taskRange, {
          title: '✅ Complete (Review & Approve)',
          command: 'speclens.completeTask',
          arguments: [document.uri, taskId]
        }));
        codeLenses.push(new vscode.CodeLens(taskRange, {
          title: '🚫 Block',
          command: 'speclens.blockTask',
          arguments: [document.uri, taskId]
        }));
      } else if (taskStatus === 'blocked') {
        codeLenses.push(new vscode.CodeLens(taskRange, {
          title: '▶️ Unblock',
          command: 'speclens.unblockTask',
          arguments: [document.uri, taskId]
        }));
      } else if (taskStatus === 'done') {
        codeLenses.push(new vscode.CodeLens(taskRange, {
          title: '🔄 Reopen',
          command: 'speclens.reopenTask',
          arguments: [document.uri, taskId]
        }));
      }

      // Always show "Get AI Help" button
      codeLenses.push(new vscode.CodeLens(taskRange, {
        title: '🤖 Get AI Help',
        command: 'speclens.executeTask',
        arguments: [document.uri, taskId]
      }));

      // View changes button for in-progress/done tasks
      if (taskStatus === 'in-progress' || taskStatus === 'done') {
        codeLenses.push(new vscode.CodeLens(taskRange, {
          title: '📝 View Changes',
          command: 'speclens.viewTaskChanges',
          arguments: [document.uri, taskId]
        }));
      }
    }

    return codeLenses;
  }

  private provideBreakdownLenses(lines: string[], docId: string, document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const taskMatch = line.match(/^###\s+Task\s+(\d+):\s+(.+?)(?:\s+\(Priority:\s*(high|medium|low)\s*\|\s*Est:\s*(\d+)h?\))?$/i);
      if (!taskMatch) continue;

      const taskNumber = taskMatch[1];
      const estimate = taskMatch[4] || '?';
      const virtualTaskId = `${docId}-T${taskNumber}`;

      const taskRange = new vscode.Range(new vscode.Position(i, 0), new vscode.Position(i, 0));

      // Extract task content
      let taskContent = '';
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].match(/^###\s+Task\s+\d+:/)) break;
        if (lines[j].match(/^##\s+/)) break;
        taskContent += lines[j] + '\n';
      }

      const statusMatch = taskContent.match(/\*\*Status:\*\*\s*.*?(TODO|IN-PROGRESS|DONE|BLOCKED)/i);
      const taskStatus = statusMatch ? statusMatch[1].toLowerCase().replace('in-progress', 'in-progress') : 'todo';

      const totalChecks = (taskContent.match(/- \[[ x]\]/gi) || []).length;
      const completedChecks = (taskContent.match(/- \[x\]/gi) || []).length;
      const progressPct = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;

      const statusEmoji = taskStatus === 'done' ? '✅' : taskStatus === 'in-progress' ? '🔵' : taskStatus === 'blocked' ? '🔴' : '🟡';
      codeLenses.push(new vscode.CodeLens(taskRange, {
        title: `${statusEmoji} ${taskStatus.toUpperCase()} | ⏱️ ${estimate}h | 📊 ${progressPct}% (${completedChecks}/${totalChecks})`,
        command: ''
      }));

      codeLenses.push(new vscode.CodeLens(taskRange, { title: '▶️ Start', command: 'speclens.startTask', arguments: [document.uri, virtualTaskId] }));
      codeLenses.push(new vscode.CodeLens(taskRange, { title: '✅ Complete', command: 'speclens.completeTask', arguments: [document.uri, virtualTaskId] }));
      codeLenses.push(new vscode.CodeLens(taskRange, { title: '🤖 Get Help', command: 'speclens.executeTask', arguments: [document.uri, virtualTaskId] }));
      codeLenses.push(new vscode.CodeLens(taskRange, { title: '📝 View Changes', command: 'speclens.viewTaskChanges', arguments: [document.uri, virtualTaskId] }));
    }

    return codeLenses;
  }

  private provideSingleTaskLenses(fm: any, fmMatch: RegExpExecArray, document: vscode.TextDocument): vscode.CodeLens[] {
    const codeLenses: vscode.CodeLens[] = [];
    const status = fm.status || 'todo';
    const taskId = fm.id || 'unknown';

    const fmEndLine = fmMatch[0].split('\n').length;
    const topRange = new vscode.Range(new vscode.Position(fmEndLine, 0), new vscode.Position(fmEndLine, 0));

    const statusEmoji = status === 'done' ? '✅' : status === 'in-progress' ? '🔄' : '⏳';
    codeLenses.push(new vscode.CodeLens(topRange, {
      title: `${statusEmoji} Status: ${status}`,
      command: 'speclens.changeTaskStatus',
      arguments: [document.uri, taskId, status]
    }));

    if (status === 'todo') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '▶️ Start Task', command: 'speclens.startTask', arguments: [document.uri, taskId] }));
    } else if (status === 'in-progress') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '✅ Complete Task', command: 'speclens.completeTask', arguments: [document.uri, taskId] }));
      codeLenses.push(new vscode.CodeLens(topRange, { title: '🚫 Block Task', command: 'speclens.blockTask', arguments: [document.uri, taskId] }));
    } else if (status === 'done') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '🔄 Reopen Task', command: 'speclens.reopenTask', arguments: [document.uri, taskId] }));
    } else if (status === 'blocked') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '▶️ Unblock Task', command: 'speclens.unblockTask', arguments: [document.uri, taskId] }));
    }

    codeLenses.push(new vscode.CodeLens(topRange, { title: '🤖 Get AI Help', command: 'speclens.executeTask', arguments: [document.uri, taskId] }));

    if (status === 'in-progress' || status === 'done') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '📝 View Changes', command: 'speclens.viewTaskChanges', arguments: [document.uri, taskId] }));
    }

    return codeLenses;
  }
}
