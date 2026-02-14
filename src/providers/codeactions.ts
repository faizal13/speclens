import * as vscode from 'vscode';
import { REQUIRED_KEYS } from '../core/validator';

export class RakdevAiCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, _range: vscode.Range | vscode.Selection): vscode.CodeAction[] | undefined {
    if (!doc.uri.fsPath.includes('/docs/')) return;
    const kind = doc.uri.fsPath.includes('/requirements/') ? 'requirement' : doc.uri.fsPath.includes('/designs/') ? 'design' : doc.uri.fsPath.includes('/tasks/') ? 'task' : undefined;
    if (!kind) return;
    const text = doc.getText();
    const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);
    if (!fmMatch) return;
    const fmBody = fmMatch[1];
    const present = new Set(
      fmBody.split(/\n+/).map(l => l.split(':')[0].trim()).filter(k => k)
    );
    const missing = REQUIRED_KEYS[kind].filter(k => !present.has(k));
    if (missing.length === 0) return;
    const insertPos = new vscode.Position(fmMatch[0].split('\n').length - 1, 0);
    return missing.map(k => this.makeAddKeyAction(k, doc, insertPos));
  }
  private makeAddKeyAction(key: string, doc: vscode.TextDocument, pos: vscode.Position): vscode.CodeAction {
    const title = `Add front-matter key: ${key}`;
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const valueTemplate = key === 'metrics' || key === 'risks' || key === 'decisions' || key === 'acceptance' ? `${key}: []\n` : `${key}: \n`;
    edit.insert(doc.uri, pos, valueTemplate);
    action.edit = edit;
    action.diagnostics = [];
    return action;
  }
}
