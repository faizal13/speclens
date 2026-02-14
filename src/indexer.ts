import * as vscode from 'vscode';
import yaml from 'js-yaml';

export type FileKind = 'requirement' | 'design' | 'task';

export interface IndexedEntry {
  id: string;
  uri: vscode.Uri;
  kind: FileKind;
  data: any;
}

export class WorkspaceIndex {
  entries: Map<string, IndexedEntry> = new Map();
  byId: Map<string, IndexedEntry> = new Map();

  async update(uri: vscode.Uri) {
    const entry = await parseFile(uri);
    if (!entry) return;
    this.entries.set(uri.toString(), entry);
    this.byId.set(entry.id, entry);
  }
  remove(uri: vscode.Uri) {
    const key = uri.toString();
    const existing = this.entries.get(key);
    if (existing) this.byId.delete(existing.id);
    this.entries.delete(key);
  }
}

export async function indexWorkspace(): Promise<WorkspaceIndex> {
  const idx = new WorkspaceIndex();
  const files = await vscode.workspace.findFiles('docs/{requirements,designs,tasks}/**/*.md');
  for (const f of files) {
    await idx.update(f);
  }
  return idx;
}

async function parseFile(uri: vscode.Uri): Promise<IndexedEntry | undefined> {
  try {
    const docBytes = await vscode.workspace.fs.readFile(uri);
    const text = docBytes.toString();
    const fm = parseFrontMatter(text);
    if (!fm) return undefined;
    const kind = deriveKind(uri);
    return { id: fm.id || fm.ID || uri.path.split('/').pop()!.replace('.md',''), uri, kind, data: fm };
  } catch {
    return undefined;
  }
}

function deriveKind(uri: vscode.Uri): FileKind {
  if (uri.path.includes('/requirements/')) return 'requirement';
  if (uri.path.includes('/designs/')) return 'design';
  return 'task';
}

export function parseFrontMatter(text: string): any | undefined {
  const match = /^---\n([\s\S]*?)\n---/m.exec(text);
  if (!match) return undefined;
  try {
    return yaml.load(match[1]);
  } catch {
    return undefined;
  }
}
