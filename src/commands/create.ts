import * as vscode from 'vscode';
import { FileKind } from '../indexer';

export async function newFileCommand(kind: FileKind) {
  const id = await vscode.window.showInputBox({ prompt: `Enter ${kind} ID (or leave to auto)`, value: '' });
  const folder = kind === 'requirement' ? 'requirements' : kind === 'design' ? 'designs' : 'tasks';
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return;
  const finalId = id && id.trim() ? id.trim() : generateId(kind);
  const filePath = vscode.Uri.joinPath(ws.uri, 'docs', folder, `${finalId}.md`);
  const template = templateFor(kind, finalId);
  await vscode.workspace.fs.writeFile(filePath, Buffer.from(template, 'utf8'));
  await vscode.window.showTextDocument(filePath);
}

export function generateId(kind: FileKind): string {
  const date = new Date();
  const year = date.getFullYear();
  const seq = Math.floor(Math.random() * 9000 + 1000);
  const prefix = kind === 'requirement' ? 'REQ' : kind === 'design' ? 'DES' : 'TASK';
  return `${prefix}-${year}-${seq}`;
}

function templateFor(kind: FileKind, id: string): string {
  if (kind === 'requirement') {
    return `---\nid: ${id}\nstatus: draft\nproblem: \nmetrics: []\nrisks: []\n---\n# ${id}\n`;
  }
  if (kind === 'design') {
    return `---\nid: ${id}\nrequirement: REQ-YYYY-XXXX\nstatus: draft\ndecisions: []\n---\n# ${id}\n`;
  }
  return `---\nid: ${id}\nrequirement: REQ-YYYY-XXXX\ndesign: DES-YYYY-XXXX\nstatus: todo\nacceptance: []\n---\n# ${id}\n`;
}

export async function validateWorkspace(
  index: { entries: Map<string, { id: string; kind: FileKind; data: any }> },
  validateAllOpen: () => Promise<void>
) {
  await validateAllOpen();
  const problems: string[] = [];
  for (const entry of index.entries.values()) {
    if (entry.kind === 'requirement' && !entry.data.problem) {
      problems.push(`${entry.id} missing problem`);
    }
    if (entry.kind === 'task' && (!Array.isArray(entry.data.acceptance) || entry.data.acceptance.length === 0)) {
      problems.push(`${entry.id} has no acceptance criteria`);
    }
  }
  if (problems.length === 0) {
    vscode.window.showInformationMessage('SpecLens: No validation issues.');
  } else {
    vscode.window.showWarningMessage(`SpecLens issues: \n${problems.join('\n')}`);
  }
}
