import * as vscode from "vscode";
import { indexWorkspace, WorkspaceIndex } from "./indexer";
import { SpecLensTreeDataProvider } from "./tree";
import { validateUri, validateAllOpen } from "./core/validator";
import { SpecLensCodeActionProvider } from "./providers/codeactions";
import { SpecLensCodeLensProvider } from "./providers/codelens";
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
  restartTask,
} from "./commands/task-lifecycle";
import { elaborateSpec } from "./commands/elaborate-spec";
import { generatePlanFromSpec } from "./commands/generate-plan";
import { generateTasksFromPlan } from "./commands/generate-tasks";
import { documentBugFix } from "./commands/document-bugfix";
import { createSkillFromSpec } from "./commands/create-skill";
import { showValidationReport } from "./commands/show-validation-report";
import { showTraceabilityMatrix } from "./commands/show-traceability-matrix";
import { showKanbanBoard } from "./commands/show-kanban-board";
import { detectSpecDrift } from "./commands/detect-spec-drift";

let index: WorkspaceIndex;
let treeProvider: SpecLensTreeDataProvider;
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
  treeProvider = new SpecLensTreeDataProvider(index);
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
    vscode.commands.registerCommand("speclens.restartTask", (uri, taskId) =>
      restartTask(uri, taskId, handleChange),
    ),
    vscode.commands.registerCommand("speclens.elaborateSpec", () =>
      elaborateSpec(),
    ),
    vscode.commands.registerCommand("speclens.generatePlan", () =>
      generatePlanFromSpec(),
    ),
    vscode.commands.registerCommand("speclens.generateTasks", () =>
      generateTasksFromPlan(),
    ),
    vscode.commands.registerCommand("speclens.documentBugFix", () =>
      documentBugFix(),
    ),
    vscode.commands.registerCommand("speclens.createSkill", () =>
      createSkillFromSpec(),
    ),
    vscode.commands.registerCommand("speclens.showValidationReport", () =>
      showValidationReport(),
    ),
    vscode.commands.registerCommand("speclens.showTraceabilityMatrix", () =>
      showTraceabilityMatrix(),
    ),
    vscode.commands.registerCommand("speclens.showKanbanBoard", () =>
      showKanbanBoard(),
    ),
    vscode.commands.registerCommand("speclens.detectSpecDrift", () =>
      detectSpecDrift(),
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
      new SpecLensCodeActionProvider(),
      { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] },
    ),
  );

  // CodeLens for Spec Kit tasks.md
  const codeLensProvider = new SpecLensCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", pattern: "**/specs/*/tasks.md" },
      codeLensProvider,
    ),
    // Also register for legacy docs/tasks/ format
    vscode.languages.registerCodeLensProvider(
      { language: "markdown", pattern: "**/docs/tasks/**/*.md" },
      codeLensProvider,
    ),
  );

  // Refresh CodeLens when tasks.md files change
  const codeLensWatcher = vscode.workspace.createFileSystemWatcher(
    "**/{specs/*/tasks.md,docs/tasks/**/*.md}",
  );
  codeLensWatcher.onDidChange(() => codeLensProvider.refresh());
  context.subscriptions.push(codeLensWatcher);

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
