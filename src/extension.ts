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
  vscode.window.registerTreeDataProvider("rakdevAi.view", treeProvider);

  // File watchers for both formats
  const rakdevWatcher = vscode.workspace.createFileSystemWatcher(
    "**/docs/{requirements,designs,tasks}/**/*.md",
  );
  rakdevWatcher.onDidCreate((uri) => handleChange(uri));
  rakdevWatcher.onDidChange((uri) => handleChange(uri));
  rakdevWatcher.onDidDelete((uri) => handleDelete(uri));
  context.subscriptions.push(rakdevWatcher);

  const speckitWatcher = vscode.workspace.createFileSystemWatcher(
    "**/specs/*/{spec,plan,tasks,constitution}.md",
  );
  speckitWatcher.onDidCreate((uri) => handleChange(uri));
  speckitWatcher.onDidChange((uri) => handleChange(uri));
  speckitWatcher.onDidDelete((uri) => handleDelete(uri));
  context.subscriptions.push(speckitWatcher);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("rakdevAi.newRequirement", () =>
      newFileCommand("requirement"),
    ),
    vscode.commands.registerCommand("rakdevAi.newDesign", () =>
      newFileCommand("design"),
    ),
    vscode.commands.registerCommand("rakdevAi.newTask", () =>
      newFileCommand("task"),
    ),
    vscode.commands.registerCommand("rakdevAi.validateWorkspace", () =>
      validateWorkspace(index, () =>
        validateAllOpen(index, diagnosticCollection, () =>
          updateStatusBar(index, diagnosticCollection),
        ),
      ),
    ),
    vscode.commands.registerCommand("rakdevAi.generateTaskBreakdown", () =>
      taskBreakdown(index),
    ),
    vscode.commands.registerCommand("rakdevAi.generateRequirementsDoc", () =>
      generateRequirementsDoc(),
    ),
    vscode.commands.registerCommand(
      "rakdevAi.generateDesignFromRequirement",
      () => generateDesignFromRequirement(index),
    ),
    vscode.commands.registerCommand("rakdevAi.generateTasksFromDesign", () =>
      generateTasksFromDesign(index, handleChange),
    ),
    vscode.commands.registerCommand(
      "rakdevAi.changeTaskStatus",
      (uri, taskId, status) =>
        changeTaskStatus(uri, taskId, status, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.startTask", (uri, taskId) =>
      startTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.completeTask", (uri, taskId) =>
      completeTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.blockTask", (uri, taskId) =>
      blockTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.reopenTask", (uri, taskId) =>
      reopenTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.unblockTask", (uri, taskId) =>
      unblockTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("rakdevAi.executeTask", (uri, taskId) =>
      executeTask(uri, taskId),
    ),
    vscode.commands.registerCommand("rakdevAi.viewTaskChanges", (uri, taskId) =>
      viewTaskChanges(uri, taskId),
    ),
  );

  // Diagnostics
  diagnosticCollection =
    vscode.languages.createDiagnosticCollection("rakdevAi");
  context.subscriptions.push(diagnosticCollection);
  await validateAllOpen(index, diagnosticCollection, () =>
    updateStatusBar(index, diagnosticCollection),
  );

  // Config change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((ev) => {
      if (["rakdevAi"].some((k) => ev.affectsConfiguration(k))) {
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

  // CodeLens for both rakdev tasks and speckit tasks.md
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", pattern: "**/docs/tasks/**/*.md" },
      new RakdevAiTaskCodeLensProvider(),
    ),
  );
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
    vscode.commands.registerCommand("rakdevAi.showFlowSummary", () =>
      showFlowSummary(index, diagnosticCollection),
    ),
  );
}

export function deactivate() {}
