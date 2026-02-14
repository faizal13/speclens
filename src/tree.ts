import * as vscode from 'vscode';
import { WorkspaceIndex, FileKind } from './indexer';

export class RakdevAiTreeDataProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChangeTreeData: vscode.EventEmitter<TreeNode | undefined | void> = new vscode.EventEmitter();
  readonly onDidChangeTreeData: vscode.Event<TreeNode | undefined | void> = this._onDidChangeTreeData.event;

  constructor(private index: WorkspaceIndex) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: TreeNode): vscode.TreeItem {
    return element;
  }
  getChildren(element?: TreeNode): Thenable<TreeNode[]> {
    if (!element) {
      return Promise.resolve(['requirement','design','task'].map(k => new GroupNode(k as FileKind)));
    }
    if (element instanceof GroupNode) {
      const entries = Array.from(this.index.entries.values()).filter(e => e.kind === element.kind).sort((a,b)=>a.id.localeCompare(b.id));
      return Promise.resolve(entries.map(e => new DocNode(e.id, e.uri)));
    }
    return Promise.resolve([]);
  }
}

class GroupNode extends vscode.TreeItem {
  constructor(public kind: FileKind) {
    super(kind.charAt(0).toUpperCase()+kind.slice(1)+'s', vscode.TreeItemCollapsibleState.Expanded);
    this.contextValue = 'group';
  }
}
class DocNode extends vscode.TreeItem {
  constructor(public id: string, public uri: vscode.Uri) {
    super(id, vscode.TreeItemCollapsibleState.None);
    this.command = { command: 'vscode.open', title: 'Open', arguments: [uri] };
    this.contextValue = 'doc';
    this.resourceUri = uri;
  }
}

type TreeNode = GroupNode | DocNode;
