import * as vscode from 'vscode';
import { FormatAdapter, ParsedDocument, DocumentType } from './adapter';
import { parseFrontMatter } from '../indexer';

export class RakdevFormatAdapter implements FormatAdapter {
  name = 'rakdev';

  constructor(private workspaceUri: vscode.Uri) {}

  async detect(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(this.workspaceUri, 'docs'));
      return true;
    } catch {
      return false;
    }
  }

  async listDocuments(): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('docs/{requirements,designs,tasks}/**/*.md');
    return files;
  }

  async parseDocument(uri: vscode.Uri): Promise<ParsedDocument | undefined> {
    try {
      const docBytes = await vscode.workspace.fs.readFile(uri);
      const text = docBytes.toString();
      const fm = parseFrontMatter(text);
      if (!fm) return undefined;

      const type = this.deriveType(uri);
      const id = fm.id || fm.ID || uri.path.split('/').pop()!.replace('.md', '');

      return {
        id,
        type,
        uri,
        data: fm,
        format: 'rakdev'
      };
    } catch {
      return undefined;
    }
  }

  private deriveType(uri: vscode.Uri): DocumentType {
    if (uri.path.includes('/requirements/')) return 'requirement';
    if (uri.path.includes('/designs/')) return 'design';
    if (uri.path.includes('/tasks/')) return 'task';
    return 'requirement'; // fallback
  }
}
