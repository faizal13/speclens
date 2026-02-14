import * as vscode from 'vscode';
import { FileKind, WorkspaceIndex } from '../indexer';

let statusBarItem: vscode.StatusBarItem | undefined;

export function createStatusBar(context: vscode.ExtensionContext): vscode.StatusBarItem {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'rakdevAi.showFlowSummary';
  context.subscriptions.push(statusBarItem);
  return statusBarItem;
}

export function updateStatusBar(index: WorkspaceIndex, diagnosticCollection: vscode.DiagnosticCollection) {
  if (!statusBarItem) return;
  const counts = { requirement: 0, design: 0, task: 0 } as Record<FileKind, number>;
  for (const e of index.entries.values()) counts[e.kind]++;
  const diagTotal = diagCount(index, diagnosticCollection);
  statusBarItem.text = `RakDev AI (R:${counts.requirement} D:${counts.design} T:${counts.task} ⚠️${diagTotal})`;
  statusBarItem.tooltip = 'RakDev AI summary: Requirements / Designs / Tasks / Diagnostics';
  statusBarItem.show();
}

export function diagCount(index: WorkspaceIndex, diagnosticCollection: vscode.DiagnosticCollection): number {
  let total = 0;
  for (const file of index.entries.values()) {
    const diags = diagnosticCollection.get(file.uri);
    if (diags) total += diags.length;
  }
  return total;
}

export function showFlowSummary(index: WorkspaceIndex, diagnosticCollection: vscode.DiagnosticCollection) {
  const reqs: string[] = []; const designs: string[] = []; const tasks: string[] = [];
  for (const e of index.entries.values()) {
    if (e.kind === 'requirement') reqs.push(e.id); else if (e.kind === 'design') designs.push(e.id); else tasks.push(e.id);
  }
  const diagTotal = diagCount(index, diagnosticCollection);
  vscode.window.showInformationMessage(`RakDev AI Summary\nRequirements (${reqs.length})\nDesigns (${designs.length})\nTasks (${tasks.length})\nDiagnostics: ${diagTotal}`);
}
