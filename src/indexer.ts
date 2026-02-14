import * as vscode from "vscode";
import yaml from "js-yaml";
import { FormatAdapter, ParsedDocument, DocumentType } from "./formats/adapter";
import { SpeckitFormatAdapter } from "./formats/speckit-parser";

// Legacy type for backward compatibility
export type FileKind = "requirement" | "design" | "task";

export interface IndexedEntry {
  id: string;
  uri: vscode.Uri;
  kind: FileKind;
  data: any;
  format?: "rakdev" | "speckit";
  documentType?: DocumentType;
}

export class WorkspaceIndex {
  entries: Map<string, IndexedEntry> = new Map();
  byId: Map<string, IndexedEntry> = new Map();
  private adapters: FormatAdapter[] = [];

  constructor(adapters: FormatAdapter[]) {
    this.adapters = adapters;
  }

  async update(uri: vscode.Uri) {
    const entry = await this.parseFile(uri);
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

  private async parseFile(uri: vscode.Uri): Promise<IndexedEntry | undefined> {
    // Try each adapter
    for (const adapter of this.adapters) {
      const parsed = await adapter.parseDocument(uri);
      if (parsed) {
        return this.convertToIndexedEntry(parsed);
      }
    }

    // Fallback: legacy parsing
    return parseLegacyFile(uri);
  }

  private convertToIndexedEntry(doc: ParsedDocument): IndexedEntry {
    // Map DocumentType to legacy FileKind
    const kind = this.mapToFileKind(doc.type);

    return {
      id: doc.id,
      uri: doc.uri,
      kind,
      data: doc.data,
      format: doc.format,
      documentType: doc.type,
    };
  }

  private mapToFileKind(type: DocumentType): FileKind {
    switch (type) {
      case "requirement":
      case "spec":
        return "requirement";
      case "design":
      case "plan":
        return "design";
      case "task":
        return "task";
      default:
        return "requirement"; // Fallback for constitution, etc.
    }
  }
}

export async function indexWorkspace(): Promise<WorkspaceIndex> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    return new WorkspaceIndex([]);
  }

  const adapters: FormatAdapter[] = [];

  // Only support Spec Kit format
  const speckitAdapter = new SpeckitFormatAdapter(ws.uri);
  if (await speckitAdapter.detect()) {
    adapters.push(speckitAdapter);
  }

  const idx = new WorkspaceIndex(adapters);

  // Index all Spec Kit documents
  for (const adapter of adapters) {
    const files = await adapter.listDocuments();
    for (const f of files) {
      await idx.update(f);
    }
  }

  return idx;
}

// Legacy parsing function for backward compatibility
async function parseLegacyFile(
  uri: vscode.Uri,
): Promise<IndexedEntry | undefined> {
  try {
    const docBytes = await vscode.workspace.fs.readFile(uri);
    const text = docBytes.toString();
    const fm = parseFrontMatter(text);
    if (!fm) return undefined;
    const kind = deriveKind(uri);
    return {
      id: fm.id || fm.ID || uri.path.split("/").pop()!.replace(".md", ""),
      uri,
      kind,
      data: fm,
    };
  } catch {
    return undefined;
  }
}

function deriveKind(uri: vscode.Uri): FileKind {
  if (uri.path.includes("/requirements/")) return "requirement";
  if (uri.path.includes("/designs/")) return "design";
  return "task";
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
