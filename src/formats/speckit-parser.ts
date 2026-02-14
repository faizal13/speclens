import * as vscode from 'vscode';
import { FormatAdapter, ParsedDocument, DocumentType } from './adapter';
import { parseFrontMatter } from '../indexer';

/**
 * Spec Kit format:
 * specs/[branch]/
 *   spec.md          - Main specification (requirement-like)
 *   plan.md          - Implementation plan (design-like)
 *   tasks.md         - Task breakdown (task-like)
 *   constitution.md  - Project rules/principles
 */
export class SpeckitFormatAdapter implements FormatAdapter {
  name = 'speckit';

  constructor(private workspaceUri: vscode.Uri) {}

  async detect(): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(vscode.Uri.joinPath(this.workspaceUri, 'specs'));
      return true;
    } catch {
      return false;
    }
  }

  async listDocuments(): Promise<vscode.Uri[]> {
    const files = await vscode.workspace.findFiles('specs/*/{spec,plan,tasks,constitution}.md');
    return files;
  }

  async parseDocument(uri: vscode.Uri): Promise<ParsedDocument | undefined> {
    try {
      const docBytes = await vscode.workspace.fs.readFile(uri);
      const text = docBytes.toString();

      // Spec Kit files may or may not have front-matter
      const fm = parseFrontMatter(text) || {};

      const pathParts = uri.path.split('/');
      const fileName = pathParts[pathParts.length - 1].replace('.md', '');
      const branchName = pathParts[pathParts.length - 2];

      const type = this.mapFileNameToType(fileName);
      const id = this.generateId(branchName, fileName);

      // Enhance data with Spec Kit metadata
      const data = {
        ...fm,
        branch: branchName,
        fileName,
        // Extract title from first heading if not in front-matter
        title: fm.title || this.extractTitle(text),
      };

      return {
        id,
        type,
        uri,
        data,
        format: 'speckit'
      };
    } catch {
      return undefined;
    }
  }

  private mapFileNameToType(fileName: string): DocumentType {
    switch (fileName) {
      case 'spec': return 'spec';
      case 'plan': return 'plan';
      case 'tasks': return 'task';
      case 'constitution': return 'constitution';
      default: return 'spec';
    }
  }

  private generateId(branchName: string, fileName: string): string {
    // Generate ID like: SPEC-branch-name or PLAN-branch-name
    const prefix = fileName.toUpperCase();
    const slug = branchName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    return `${prefix}-${slug}`;
  }

  private extractTitle(text: string): string {
    // Try to extract first heading
    const match = text.match(/^#\s+(.+)$/m);
    return match ? match[1].trim() : '';
  }
}
