import * as vscode from 'vscode';
import { parseFrontMatter } from '../indexer';

export class RakdevAiTaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(document: vscode.TextDocument, _token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.uri.fsPath.includes('/docs/tasks/')) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

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

    codeLenses.push(new vscode.CodeLens(topRange, { title: '🤖 Get Copilot Help', command: 'speclens.executeTask', arguments: [document.uri, taskId] }));

    if (status === 'in-progress' || status === 'done') {
      codeLenses.push(new vscode.CodeLens(topRange, { title: '📝 View Changes', command: 'speclens.viewTaskChanges', arguments: [document.uri, taskId] }));
    }

    return codeLenses;
  }
}
