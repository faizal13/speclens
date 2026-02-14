import * as vscode from 'vscode';

export type DocumentType = 'requirement' | 'design' | 'task' | 'spec' | 'plan' | 'constitution';

export interface ParsedDocument {
  id: string;
  type: DocumentType;
  uri: vscode.Uri;
  data: any;
  format: 'rakdev' | 'speckit';
}

export interface FormatAdapter {
  name: string;
  detect(workspaceUri: vscode.Uri): Promise<boolean>;
  listDocuments(): Promise<vscode.Uri[]>;
  parseDocument(uri: vscode.Uri): Promise<ParsedDocument | undefined>;
}

export async function detectFormats(workspaceUri: vscode.Uri): Promise<{ rakdev: boolean; speckit: boolean }> {
  const rakdevExists = await pathExists(vscode.Uri.joinPath(workspaceUri, 'docs'));
  const speckitExists = await pathExists(vscode.Uri.joinPath(workspaceUri, 'specs'));

  return { rakdev: rakdevExists, speckit: speckitExists };
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
