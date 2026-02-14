import * as vscode from "vscode";
import { indexWorkspace, WorkspaceIndex } from "./indexer";
import { RakdevAiTreeDataProvider } from "./tree";
import { validateUri, validateAllOpen } from "./core/validator";
import { RakdevAiCodeActionProvider } from "./providers/codeactions";
import { RakdevAiTaskCodeLensProvider } from "./providers/codelens";
import {
  createStatusBar,
  updateStatusBar,
  showFlowSummary,
} from "./providers/statusbar";
import { newFileCommand, validateWorkspace } from "./commands/create";
import {
  taskBreakdown,
  generateRequirementsDoc,
  generateDesignFromRequirement,
  generateTasksFromDesign,
} from "./commands/generate";
import {
  changeTaskStatus,
  startTask,
  completeTask,
  blockTask,
  reopenTask,
  unblockTask,
  executeTask,
  viewTaskChanges,
} from "./commands/task-lifecycle";

let index: WorkspaceIndex;
let treeProvider: RakdevAiTreeDataProvider;
let diagnosticCollection: vscode.DiagnosticCollection;

async function handleChange(uri: vscode.Uri) {
  await index.update(uri);
  await validateAllOpen(index, diagnosticCollection, () =>
    updateStatusBar(index, diagnosticCollection),
  );
  treeProvider.refresh();
}

async function handleDelete(uri: vscode.Uri) {
  index.remove(uri);
  diagnosticCollection.delete(uri);
  await validateAllOpen(index, diagnosticCollection, () =>
    updateStatusBar(index, diagnosticCollection),
  );
  treeProvider.refresh();
}

export async function activate(context: vscode.ExtensionContext) {
  index = await indexWorkspace();
  treeProvider = new RakdevAiTreeDataProvider(index);
  vscode.window.registerTreeDataProvider("speclens.view", treeProvider);

  // File watcher for Spec Kit format
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/specs/*/{spec,plan,tasks,constitution}.md",
  );
  watcher.onDidCreate((uri) => handleChange(uri));
  watcher.onDidChange((uri) => handleChange(uri));
  watcher.onDidDelete((uri) => handleDelete(uri));
  context.subscriptions.push(watcher);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("speclens.newRequirement", () =>
      newFileCommand("requirement"),
    ),
    vscode.commands.registerCommand("speclens.newDesign", () =>
      newFileCommand("design"),
    ),
    vscode.commands.registerCommand("speclens.newTask", () =>
      newFileCommand("task"),
    ),
    vscode.commands.registerCommand("speclens.validateWorkspace", () =>
      validateWorkspace(index, () =>
        validateAllOpen(index, diagnosticCollection, () =>
          updateStatusBar(index, diagnosticCollection),
        ),
      ),
    ),
    vscode.commands.registerCommand("speclens.generateTaskBreakdown", () =>
      taskBreakdown(index),
    ),
    vscode.commands.registerCommand("speclens.generateRequirementsDoc", () =>
      generateRequirementsDoc(),
    ),
    vscode.commands.registerCommand(
      "speclens.generateDesignFromRequirement",
      () => generateDesignFromRequirement(index),
    ),
    vscode.commands.registerCommand("speclens.generateTasksFromDesign", () =>
      generateTasksFromDesign(index, handleChange),
    ),
    vscode.commands.registerCommand(
      "speclens.changeTaskStatus",
      (uri, taskId, status) =>
        changeTaskStatus(uri, taskId, status, handleChange),
    ),
    vscode.commands.registerCommand("speclens.startTask", (uri, taskId) =>
      startTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.completeTask", (uri, taskId) =>
      completeTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.blockTask", (uri, taskId) =>
      blockTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.reopenTask", (uri, taskId) =>
      reopenTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.unblockTask", (uri, taskId) =>
      unblockTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.executeTask", (uri, taskId) =>
      executeTask(uri, taskId),
    ),
    vscode.commands.registerCommand("speclens.viewTaskChanges", (uri, taskId) =>
      viewTaskChanges(uri, taskId),
    ),
  );

  // Diagnostics
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("speclens");
  context.subscriptions.push(diagnosticCollection);
  await validateAllOpen(index, diagnosticCollection, () =>
    updateStatusBar(index, diagnosticCollection),
  );

  // Config change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (["speclens"].some((k) => ev.affectsConfiguration(k))) {
        validateAllOpen(index, diagnosticCollection, () =>
          updateStatusBar(index, diagnosticCollection),
        );
      }
    }),
  );

  // Providers
  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider(
      { language: "markdown", scheme: "file" },
      new RakdevAiCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // CodeLens for Spec Kit tasks.md
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", pattern: "**/specs/*/tasks.md" },
      new RakdevAiTaskCodeLensProvider(),
    ),
  );

  // Status bar
  createStatusBar(context);
  updateStatusBar(index, diagnosticCollection);
  context.subscriptions.push(
    vscode.commands.registerCommand("speclens.showFlowSummary", () =>
      showFlowSummary(index, diagnosticCollection),
    ),
  );
}

export function deactivate() {}
