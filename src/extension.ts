import * as vscode from 'vscode';
import { parseFrontMatter, FileKind, indexWorkspace, WorkspaceIndex } from './indexer';
import { RakdevAiTreeDataProvider } from './tree';

// Allowed statuses per type
const STATUS: Record<FileKind, string[]> = {
  requirement: ['draft','review','approved','implemented'],
  design: ['draft','review','approved'],
  task: ['todo','in-progress','done']
};

const REQUIRED_KEYS: Record<FileKind,string[]> = {
  requirement: ['problem','metrics','risks'],
  design: ['requirement','decisions'],
  task: ['requirement','design','acceptance']
};

let index: WorkspaceIndex;
let treeProvider: RakdevAiTreeDataProvider;
let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
  index = await indexWorkspace();
  treeProvider = new RakdevAiTreeDataProvider(index);
  vscode.window.registerTreeDataProvider('rakdevAi.view', treeProvider);

  const watcher = vscode.workspace.createFileSystemWatcher('**/docs/{requirements,designs,tasks}/**/*.md');
  watcher.onDidCreate(uri => handleChange(uri));
  watcher.onDidChange(uri => handleChange(uri));
  watcher.onDidDelete(uri => handleDelete(uri));
  context.subscriptions.push(watcher);

  context.subscriptions.push(
    vscode.commands.registerCommand('rakdevAi.newRequirement', () => newFileCommand('requirement')),
    vscode.commands.registerCommand('rakdevAi.newDesign', () => newFileCommand('design')),
    vscode.commands.registerCommand('rakdevAi.newTask', () => newFileCommand('task')),
    vscode.commands.registerCommand('rakdevAi.validateWorkspace', () => validateWorkspace()),
    vscode.commands.registerCommand('rakdevAi.generateTaskBreakdown', () => taskBreakdown()),
    vscode.commands.registerCommand('rakdevAi.generateRequirementsDoc', () => generateRequirementsDoc()),
    vscode.commands.registerCommand('rakdevAi.generateDesignFromRequirement', () => generateDesignFromRequirement()),
    vscode.commands.registerCommand('rakdevAi.generateTasksFromDesign', () => generateTasksFromDesign()),
    vscode.commands.registerCommand('rakdevAi.changeTaskStatus', (uri, taskId, status) => changeTaskStatus(uri, taskId, status)),
    vscode.commands.registerCommand('rakdevAi.startTask', (uri, taskId) => startTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.completeTask', (uri, taskId) => completeTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.blockTask', (uri, taskId) => blockTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.reopenTask', (uri, taskId) => reopenTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.unblockTask', (uri, taskId) => unblockTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.executeTask', (uri, taskId) => executeTask(uri, taskId)),
    vscode.commands.registerCommand('rakdevAi.viewTaskChanges', (uri, taskId) => viewTaskChanges(uri, taskId))
  );

  diagnosticCollection = vscode.languages.createDiagnosticCollection('rakdevAi');
  context.subscriptions.push(diagnosticCollection);
  await validateAllOpen();

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(ev => {
      if (['rakdevAi'].some(k => ev.affectsConfiguration(k))) {
        validateAllOpen();
      }
    })
  );

  context.subscriptions.push(
    vscode.languages.registerCodeActionsProvider({ language: 'markdown', scheme: 'file' }, new RakdevAiCodeActionProvider(), { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] })
  );

  // Register CodeLens provider for interactive task buttons
  const codeLensProvider = new RakdevAiTaskCodeLensProvider();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider({ language: 'markdown', pattern: '**/docs/tasks/**/*.md' }, codeLensProvider)
  );

  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'rakdevAi.showFlowSummary';
  context.subscriptions.push(statusBarItem);
  updateStatusBar();
  context.subscriptions.push(vscode.commands.registerCommand('rakdevAi.showFlowSummary', () => showFlowSummary()));
}

async function handleChange(uri: vscode.Uri) {
  await index.update(uri);
  await validateAllOpen();
  treeProvider.refresh();
}
async function handleDelete(uri: vscode.Uri) {
  index.remove(uri);
  diagnosticCollection.delete(uri);
  await validateAllOpen();
  treeProvider.refresh();
}
function showFlowSummary() {
  const reqs: string[] = []; const designs: string[] = []; const tasks: string[] = [];
  for (const e of index.entries.values()) {
    if (e.kind === 'requirement') reqs.push(e.id); else if (e.kind === 'design') designs.push(e.id); else tasks.push(e.id);
  }
  const diagTotal = diagCount();
  vscode.window.showInformationMessage(`RakDev AI Summary\nRequirements (${reqs.length})\nDesigns (${designs.length})\nTasks (${tasks.length})\nDiagnostics: ${diagTotal}`);
}

function diagCount(): number {
  let total = 0;
  for (const file of index.entries.values()) {
    const diags = diagnosticCollection.get(file.uri);
    if (diags) total += diags.length;
  }
  return total;
}

function updateStatusBar() {
  if (!statusBarItem) {
    // Status bar not initialized yet
    return;
  }
  const counts = { requirement: 0, design: 0, task: 0 } as Record<FileKind, number>;
  for (const e of index.entries.values()) counts[e.kind]++;
  const diagTotal = diagCount();
  statusBarItem.text = `RakDev AI (R:${counts.requirement} D:${counts.design} T:${counts.task} ⚠️${diagTotal})`;
  statusBarItem.tooltip = 'RakDev AI summary: Requirements / Designs / Tasks / Diagnostics';
  statusBarItem.show();
}

async function validateAllOpen() {
  const files = await vscode.workspace.findFiles('docs/{requirements,designs,tasks}/**/*.md');
  for (const f of files) await validateUri(f);
  updateStatusBar();
}

function lineRangeFor(line: number): vscode.Range {
  return new vscode.Range(new vscode.Position(line,0), new vscode.Position(line, 120));
}

function pushDiag(diags: vscode.Diagnostic[], uri: vscode.Uri, msg: string, line: number, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning) {
  const d = new vscode.Diagnostic(lineRangeFor(line), msg, severity);
  d.source = 'RakDev AI';
  diags.push(d);
}

async function validateUri(uri: vscode.Uri) {
  const entry = index.entries.get(uri.toString());
  if (!entry) { diagnosticCollection.delete(uri); return; }
  const diagnostics: vscode.Diagnostic[] = [];
  const cfg = vscode.workspace.getConfiguration();
  const enforceApproved = cfg.get<boolean>('rakdevAi.enforceApprovedDesignBeforeTask', true);

  // Generic status validation
  const status = (entry.data.status || '').toString();
  if (status && !STATUS[entry.kind].includes(status)) {
    pushDiag(diagnostics, uri, `${entry.kind} has unknown status '${status}'`, 0);
  }

  if (entry.kind === 'requirement') {
    if (!entry.data.problem) pushDiag(diagnostics, uri, 'Requirement missing problem', 1);
    if (!Array.isArray(entry.data.metrics) || entry.data.metrics.length === 0) pushDiag(diagnostics, uri, 'Requirement missing metrics[]', 2);
  }

  if (entry.kind === 'design') {
    const reqId = entry.data.requirement;
    if (!reqId) {
      pushDiag(diagnostics, uri, 'Design missing requirement link', 1, vscode.DiagnosticSeverity.Error);
    } else if (!index.byId.get(reqId)) {
      pushDiag(diagnostics, uri, `Design references unknown requirement '${reqId}'`, 1, vscode.DiagnosticSeverity.Error);
    } else {
      const req = index.byId.get(reqId);
      if (req && req.data.status === 'draft') {
        pushDiag(diagnostics, uri, `Requirement '${reqId}' still draft`, 0);
      }
    }
  }

  if (entry.kind === 'task') {
    const reqId = entry.data.requirement;
    if (!reqId) {
      pushDiag(diagnostics, uri, 'Task missing requirement link', 1, vscode.DiagnosticSeverity.Error);
    } else if (!index.byId.get(reqId)) {
      pushDiag(diagnostics, uri, `Task references unknown requirement '${reqId}'`, 1, vscode.DiagnosticSeverity.Error);
    }
    const designId = entry.data.design;
    if (designId) {
      const designEntry = index.byId.get(designId);
      if (!designEntry) {
        pushDiag(diagnostics, uri, `Task references unknown design '${designId}'`, 1, vscode.DiagnosticSeverity.Error);
      } else if (enforceApproved && designEntry.data.status !== 'approved') {
        pushDiag(diagnostics, uri, `Design '${designId}' not approved (status=${designEntry.data.status})`, 0, vscode.DiagnosticSeverity.Warning);
      }
    } else if (enforceApproved) {
      pushDiag(diagnostics, uri, 'Task missing design link (enforced)', 0);
    }
    if (!Array.isArray(entry.data.acceptance) || entry.data.acceptance.length === 0) {
      pushDiag(diagnostics, uri, 'Task has no acceptance criteria', 2, vscode.DiagnosticSeverity.Error);
    }
  }
  diagnosticCollection.set(uri, diagnostics);
}

async function newFileCommand(kind: FileKind) {
  const id = await vscode.window.showInputBox({ prompt: `Enter ${kind} ID (or leave to auto)`, value: '' });
  const folder = kind === 'requirement' ? 'requirements' : kind === 'design' ? 'designs' : 'tasks';
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) return;
  const finalId = id && id.trim() ? id.trim() : generateId(kind);
  const filePath = vscode.Uri.joinPath(ws.uri, 'docs', folder, `${finalId}.md`);
  const template = templateFor(kind, finalId);
  await vscode.workspace.fs.writeFile(filePath, Buffer.from(template, 'utf8'));
  await vscode.window.showTextDocument(filePath);
}

function generateId(kind: FileKind): string {
  const date = new Date();
  const year = date.getFullYear();
  const seq = Math.floor(Math.random() * 9000 + 1000); // placeholder simple
  const prefix = kind === 'requirement' ? 'REQ' : kind === 'design' ? 'DES' : 'TASK';
  return `${prefix}-${year}-${seq}`;
}

function templateFor(kind: FileKind, id: string): string {
  if (kind === 'requirement') {
    return `---\nid: ${id}\nstatus: draft\nproblem: \nmetrics: []\nrisks: []\n---\n# ${id}\n`;
  }
  if (kind === 'design') {
    return `---\nid: ${id}\nrequirement: REQ-YYYY-XXXX\nstatus: draft\ndecisions: []\n---\n# ${id}\n`;
  }
  return `---\nid: ${id}\nrequirement: REQ-YYYY-XXXX\ndesign: DES-YYYY-XXXX\nstatus: todo\nacceptance: []\n---\n# ${id}\n`;
}

async function validateWorkspace() {
  await validateAllOpen();
  const problems: string[] = [];
  for (const entry of index.entries.values()) {
    if (entry.kind === 'requirement' && !entry.data.problem) {
      problems.push(`${entry.id} missing problem`);
    }
    if (entry.kind === 'task' && (!Array.isArray(entry.data.acceptance) || entry.data.acceptance.length === 0)) {
      problems.push(`${entry.id} has no acceptance criteria`);
    }
  }
  if (problems.length === 0) {
    vscode.window.showInformationMessage('RakDev AI: No validation issues.');
  } else {
    vscode.window.showWarningMessage(`RakDev AI issues: \n${problems.join('\n')}`);
  }
}

async function taskBreakdown() {
  const designId = await vscode.window.showInputBox({ prompt: 'Design ID to breakdown' });
  if (!designId) return;
  const design = index.byId.get(designId.trim());
  if (!design || design.kind !== 'design') {
    vscode.window.showErrorMessage('Design not found.');
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const includeQuality = cfg.get<boolean>('rakdevAi.breakdown.includeQualityTasks', true);
  const maxTasks = cfg.get<number>('rakdevAi.breakdown.maxTasks', 40);
  const textDoc = await vscode.workspace.openTextDocument(design.uri);
  const text = textDoc.getText();
  const sections = extractSections(text);
  const decisions: string[] = Array.isArray(design.data.decisions) ? design.data.decisions : [];

  const tasks: string[] = [];
  // Decision-based implementation tasks
  decisions.forEach((d, i) => tasks.push(`Implementation: ${trimSentence(d)}`));

  // Section-derived tasks
  if (sections['Risks']) {
    tasks.push('Mitigation Plan: address listed risks');
  }
  if (sections['Test Strategy']) {
    tasks.push('Test Plan: translate strategy to concrete test cases');
  }
  if (sections['Context']) {
    tasks.push('Documentation: update README / architecture references');
  }

  // Quality tasks
  if (includeQuality) {
    tasks.push('Observability: metrics/logs/traces additions');
    tasks.push('Security Review: threat model / dependency scan');
    tasks.push('Performance Benchmark: baseline critical paths');
  }

  // De-duplicate
  const uniq: string[] = [];
  for (const t of tasks) if (!uniq.includes(t)) uniq.push(t);

  const limited = uniq.slice(0, maxTasks);
  const content = `# Advanced Task Breakdown for ${designId}\n` + limited.map((t,i)=>`- [ ] ${t}`).join('\n');
  const doc = await vscode.workspace.openTextDocument({ content });
  await vscode.window.showTextDocument(doc);
}

function extractSections(markdown: string): Record<string,string> {
  const lines = markdown.split(/\r?\n/);
  const sections: Record<string,string> = {};
  let current: string | null = null; let buf: string[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line.trim());
    if (m) {
      if (current) sections[current] = buf.join('\n').trim();
      current = m[1].trim(); buf = []; continue;
    }
    if (current) buf.push(line);
  }
  if (current) sections[current] = buf.join('\n').trim();
  return sections;
}

function trimSentence(s: string): string { return s.replace(/^[*\-\s]+/, '').replace(/\.$/,'').slice(0,120); }

class RakdevAiCodeActionProvider implements vscode.CodeActionProvider {
  provideCodeActions(doc: vscode.TextDocument, _range: vscode.Range | vscode.Selection): vscode.CodeAction[] | undefined {
    if (!doc.uri.fsPath.includes('/docs/')) return;
    const kind = doc.uri.fsPath.includes('/requirements/') ? 'requirement' : doc.uri.fsPath.includes('/designs/') ? 'design' : doc.uri.fsPath.includes('/tasks/') ? 'task' : undefined;
    if (!kind) return;
    const text = doc.getText();
    const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);
    if (!fmMatch) return;
    const fmBody = fmMatch[1];
    const present = new Set(
      fmBody.split(/\n+/).map(l=>l.split(':')[0].trim()).filter(k=>k)
    );
    const missing = REQUIRED_KEYS[kind].filter(k=>!present.has(k));
    if (missing.length === 0) return;
    const insertPos = new vscode.Position(fmMatch[0].split('\n').length - 1, 0); // before closing --- line
    return missing.map(k => this.makeAddKeyAction(k, doc, insertPos));
  }
  private makeAddKeyAction(key: string, doc: vscode.TextDocument, pos: vscode.Position): vscode.CodeAction {
    const title = `Add front-matter key: ${key}`;
    const action = new vscode.CodeAction(title, vscode.CodeActionKind.QuickFix);
    const edit = new vscode.WorkspaceEdit();
    const valueTemplate = key === 'metrics' || key === 'risks' || key === 'decisions' || key === 'acceptance' ? `${key}: []\n` : `${key}: \n`;
    edit.insert(doc.uri, pos, valueTemplate);
    action.edit = edit;
    action.diagnostics = []; // rely on re-parse after apply
    return action;
  }
}

class RakdevAiTaskCodeLensProvider implements vscode.CodeLensProvider {
  private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
    if (!document.uri.fsPath.includes('/docs/tasks/')) {
      return [];
    }

    const codeLenses: vscode.CodeLens[] = [];
    const text = document.getText();
    const lines = text.split(/\r?\n/);

    // Find front-matter
    const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);
    if (!fmMatch) return [];

    const fm = parseFrontMatter(text);
    const docId = fm.id || 'unknown';

    // Check if this is a consolidated task breakdown document (TASK-DOC-YYYY-XXXX)
    const isTaskBreakdown = docId.startsWith('TASK-DOC-');

    if (isTaskBreakdown) {
      // Parse individual tasks from the document (### Task N: ... format)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Match task headings: ### Task 1: Setup Architecture (Priority: high | Est: 6h)
        const taskMatch = line.match(/^###\s+Task\s+(\d+):\s+(.+?)(?:\s+\(Priority:\s*(high|medium|low)\s*\|\s*Est:\s*(\d+)h?\))?$/i);
        if (taskMatch) {
          const taskNumber = taskMatch[1];
          const taskTitle = taskMatch[2].trim();
          const priority = taskMatch[3] || 'medium';
          const estimate = taskMatch[4] || '?';
          
          // Virtual task ID for this section
          const virtualTaskId = `${docId}-T${taskNumber}`;
          
          // Position for CodeLens (at the task heading line)
          const taskPosition = new vscode.Position(i, 0);
          const taskRange = new vscode.Range(taskPosition, taskPosition);
          
          // Extract task content (from this heading to next ### or end)
          let taskContent = '';
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].match(/^###\s+Task\s+\d+:/)) break;
            if (lines[j].match(/^##\s+/)) break; // Stop at next major section
            taskContent += lines[j] + '\n';
          }
          
          // Check if task has status marker in content
          const statusMatch = taskContent.match(/\*\*Status:\*\*\s*.*?(TODO|IN-PROGRESS|DONE|BLOCKED)/i);
          const taskStatus = statusMatch ? statusMatch[1].toLowerCase().replace('in-progress', 'in-progress') : 'todo';
          
          // Count completed checkboxes vs total
          const totalChecks = (taskContent.match(/- \[[ x]\]/gi) || []).length;
          const completedChecks = (taskContent.match(/- \[x\]/gi) || []).length;
          const progressPct = totalChecks > 0 ? Math.round((completedChecks / totalChecks) * 100) : 0;
          
          // Add status/progress indicator
          const statusEmoji = taskStatus === 'done' ? '✅' : taskStatus === 'in-progress' ? '🔵' : taskStatus === 'blocked' ? '🔴' : '🟡';
          const progressLens = new vscode.CodeLens(taskRange, {
            title: `${statusEmoji} ${taskStatus.toUpperCase()} | ⏱️ ${estimate}h | 📊 ${progressPct}% (${completedChecks}/${totalChecks})`,
            command: '' // Non-clickable status display
          });
          codeLenses.push(progressLens);
          
          // Add action buttons
          const startLens = new vscode.CodeLens(taskRange, {
            title: '▶️ Start',
            command: 'rakdevAi.startTask',
            arguments: [document.uri, virtualTaskId]
          });
          codeLenses.push(startLens);
          
          const completeLens = new vscode.CodeLens(taskRange, {
            title: '✅ Complete',
            command: 'rakdevAi.completeTask',
            arguments: [document.uri, virtualTaskId]
          });
          codeLenses.push(completeLens);
          
          const helpLens = new vscode.CodeLens(taskRange, {
            title: '🤖 Get Help',
            command: 'rakdevAi.executeTask',
            arguments: [document.uri, virtualTaskId]
          });
          codeLenses.push(helpLens);
          
          const viewLens = new vscode.CodeLens(taskRange, {
            title: '📝 View Changes',
            command: 'rakdevAi.viewTaskChanges',
            arguments: [document.uri, virtualTaskId]
          });
          codeLenses.push(viewLens);
        }
      }
      
      return codeLenses;
    }

    // Original behavior for individual task files
    const status = fm.status || 'todo';
    const taskId = fm.id || 'unknown';

    // Add action buttons at the top of the file (after front-matter)
    const fmEndLine = fmMatch[0].split('\n').length;
    const topPosition = new vscode.Position(fmEndLine, 0);
    const topRange = new vscode.Range(topPosition, topPosition);

    // Status indicator
    const statusEmoji = status === 'done' ? '✅' : status === 'in-progress' ? '🔄' : '⏳';
    const statusLens = new vscode.CodeLens(topRange, {
      title: `${statusEmoji} Status: ${status}`,
      command: 'rakdevAi.changeTaskStatus',
      arguments: [document.uri, taskId, status]
    });
    codeLenses.push(statusLens);

    // Action buttons based on status
    if (status === 'todo') {
      const startLens = new vscode.CodeLens(topRange, {
        title: '▶️ Start Task',
        command: 'rakdevAi.startTask',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(startLens);
    } else if (status === 'in-progress') {
      const completeLens = new vscode.CodeLens(topRange, {
        title: '✅ Complete Task',
        command: 'rakdevAi.completeTask',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(completeLens);

      const blockLens = new vscode.CodeLens(topRange, {
        title: '🚫 Block Task',
        command: 'rakdevAi.blockTask',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(blockLens);
    } else if (status === 'done') {
      const reopenLens = new vscode.CodeLens(topRange, {
        title: '🔄 Reopen Task',
        command: 'rakdevAi.reopenTask',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(reopenLens);
    } else if (status === 'blocked') {
      const unblockLens = new vscode.CodeLens(topRange, {
        title: '▶️ Unblock Task',
        command: 'rakdevAi.unblockTask',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(unblockLens);
    }

    // View execution button - opens Copilot Chat for implementation help
    const executeLens = new vscode.CodeLens(topRange, {
      title: '🤖 Get Copilot Help',
      command: 'rakdevAi.executeTask',
      arguments: [document.uri, taskId]
    });
    codeLenses.push(executeLens);

    // View changes button (if task has been worked on)
    if (status === 'in-progress' || status === 'done') {
      const changesLens = new vscode.CodeLens(topRange, {
        title: '📝 View Changes',
        command: 'rakdevAi.viewTaskChanges',
        arguments: [document.uri, taskId]
      });
      codeLenses.push(changesLens);
    }

    return codeLenses;
  }
}

async function changeTaskStatus(uri: vscode.Uri, taskId: string, currentStatus: string) {
  const options = ['todo', 'in-progress', 'blocked', 'done'];
  const newStatus = await vscode.window.showQuickPick(options, {
    placeHolder: `Change status from '${currentStatus}' to:`,
    title: `Task ${taskId}`
  });

  if (newStatus && newStatus !== currentStatus) {
    await updateTaskStatus(uri, newStatus);
  }
}

async function startTask(uri: vscode.Uri, taskId: string) {
  // Update status first
  await updateTaskStatus(uri, 'in-progress');
  
  // Read task content
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);
  
  const reqId = fm.requirement || 'unknown';
  const designId = fm.design || 'unknown';
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  // Extract task details from consolidated document if this is a virtual task ID
  let taskContent = text;
  if (taskId.includes('-T')) {
    // This is a virtual task from consolidated document - extract just this task section
    const lines = text.split(/\r?\n/);
    const taskNumber = taskId.split('-T')[1];
    const taskStartPattern = new RegExp(`^###\\s+Task\\s+${taskNumber}:\\s+`, 'i');
    
    let startIdx = -1;
    let endIdx = lines.length;
    
    for (let i = 0; i < lines.length; i++) {
      if (taskStartPattern.test(lines[i])) {
        startIdx = i;
      } else if (startIdx >= 0 && /^###\s+Task\s+\d+:/i.test(lines[i])) {
        endIdx = i;
        break;
      }
    }
    
    if (startIdx >= 0) {
      taskContent = lines.slice(startIdx, endIdx).join('\n');
    }
  }

  // Open Copilot Chat in EDIT MODE (not Ask mode) to START implementing
  const chatPrompt = `I need to implement this task. Please analyze the requirement and design, then create/edit files as needed.

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Requirement:** ${reqId}
**Design:** ${designId}

**Task Details:**
\`\`\`markdown
${taskContent}
\`\`\`

**ACTION REQUIRED:**
1. Read the requirement file \`${reqId}.md\` from docs/requirements/
2. Read the design file \`${designId}.md\` from docs/designs/
3. Analyze the task implementation steps and acceptance criteria above
4. Generate/modify code files to implement this task
5. Follow the design architecture and patterns

Please start implementing this task now. Create or edit files directly using @workspace agent mode.`;

  // Open Copilot Chat in EDIT mode (this forces agent mode)
  await vscode.commands.executeCommand('workbench.action.chat.openEditSession', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(`🚀 Task ${taskId} started! Copilot is implementing in Edit mode...`);
}

async function completeTask(uri: vscode.Uri, taskId: string) {
  const confirm = await vscode.window.showInformationMessage(
    `Mark task ${taskId} as complete?`,
    'Yes', 'No'
  );
  
  if (confirm === 'Yes') {
    await updateTaskStatus(uri, 'done');
    vscode.window.showInformationMessage(`🎉 Task ${taskId} completed! Status: done`);
  }
}

async function blockTask(uri: vscode.Uri, taskId: string) {
  const reason = await vscode.window.showInputBox({
    prompt: 'Why is this task blocked?',
    placeHolder: 'e.g., Waiting for API credentials'
  });
  
  if (reason !== undefined) {
    await updateTaskStatus(uri, 'blocked');
    
    // Add blocker note to the file
    const doc = await vscode.workspace.openTextDocument(uri);
    const text = doc.getText();
    const timestamp = new Date().toISOString();
    const blockerNote = `\n\n---\n**BLOCKED** (${timestamp}): ${reason}\n---\n`;
    
    const edit = new vscode.WorkspaceEdit();
    edit.insert(uri, new vscode.Position(doc.lineCount, 0), blockerNote);
    await vscode.workspace.applyEdit(edit);
    
    vscode.window.showWarningMessage(`🚫 Task ${taskId} blocked: ${reason}`);
  }
}

async function reopenTask(uri: vscode.Uri, taskId: string) {
  await updateTaskStatus(uri, 'in-progress');
  vscode.window.showInformationMessage(`🔄 Task ${taskId} reopened! Status: in-progress`);
}

async function unblockTask(uri: vscode.Uri, taskId: string) {
  await updateTaskStatus(uri, 'in-progress');
  vscode.window.showInformationMessage(`✅ Task ${taskId} unblocked! Status: in-progress`);
}

async function updateTaskStatus(uri: vscode.Uri, newStatus: string) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fmMatch = /^---\n([\s\S]*?)\n---/m.exec(text);
  
  if (!fmMatch) {
    vscode.window.showErrorMessage('Could not find task front-matter');
    return;
  }

  const fmBody = fmMatch[1];
  let newFmBody = fmBody;

  // Update or add status field
  if (/^status:/m.test(fmBody)) {
    newFmBody = fmBody.replace(/^status:.*$/m, `status: ${newStatus}`);
  } else {
    newFmBody = `status: ${newStatus}\n${fmBody}`;
  }

  const newFm = `---\n${newFmBody}\n---`;
  const edit = new vscode.WorkspaceEdit();
  const fmRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(fmMatch[0].length)
  );
  edit.replace(uri, fmRange, newFm);
  
  await vscode.workspace.applyEdit(edit);
  await doc.save();
  
  // Refresh index and diagnostics
  await handleChange(uri);
}

async function executeTask(uri: vscode.Uri, taskId: string) {
  const doc = await vscode.workspace.openTextDocument(uri);
  const text = doc.getText();
  const fm = parseFrontMatter(text);
  
  const reqId = fm.requirement || 'unknown';
  const designId = fm.design || 'unknown';
  const taskTitle = text.match(/^# Task: (.+)$/m)?.[1] || taskId;

  // Build comprehensive prompt for Copilot with task context
  const chatPrompt = `@workspace I'm working on implementing this task:

**Task ID:** ${taskId}
**Title:** ${taskTitle}
**Requirement:** ${reqId}
**Design:** ${designId}

**Task Details:**
\`\`\`markdown
${text}
\`\`\`

I need help implementing this task. Please:

1. **Analyze the task requirements** from the Implementation Details section
2. **Review the requirement context** by reading ${reqId}
3. **Review the design decisions** by reading ${designId}
4. **Provide step-by-step guidance** for implementing this task
5. **Generate code** if applicable (following the design architecture)
6. **Help me verify** the acceptance criteria

What should I implement first for this task?`;

  // Open Copilot Chat with the task context
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(
    `🤖 Copilot Chat opened with context for ${taskId}. Ask questions and get implementation help!`
  );
}

async function viewTaskChanges(uri: vscode.Uri, taskId: string) {
  try {
    // Open Copilot Chat to show changed files (smart file tracking)
    const chatPrompt = `@workspace Show me all the files that were changed or created for task ${taskId}. 

Please:
1. Search for files that reference "${taskId}" in comments or commits
2. Show me the git diff of recently modified files
3. List all files created/modified since this task started
4. Highlight the key changes related to this task

Use git history and file search to track all changes for this task.`;

    await vscode.commands.executeCommand('workbench.action.chat.open', {
      query: chatPrompt
    });

    vscode.window.showInformationMessage(`📝 Copilot is analyzing changes for ${taskId}...`);
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to view task changes: ${e.message}`);
  }
}

async function readTemplate(relPath: string): Promise<string> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) throw new Error('No workspace');
  const uri = vscode.Uri.joinPath(ws.uri, relPath);
  const bytes = await vscode.workspace.fs.readFile(uri);
  return bytes.toString();
}

async function generateRequirementsDoc() {
  try {
    const project = await vscode.window.showInputBox({ prompt: 'Project/Product name', placeHolder: 'Kidzilla' });
    if (!project) return;
    const intro = await vscode.window.showInputBox({ prompt: 'Introduction (leave blank to paste later)', value: '' }) || 'TBD';
    const sampleReq = await vscode.window.showQuickPick(['Yes','No'], { placeHolder: 'Include interactive prompts for individual requirements?' });
    let reqBlocks = '';
    if (sampleReq === 'Yes') {
      const reqCountStr = await vscode.window.showInputBox({ prompt: 'How many requirements?', value: '3' }) || '0';
      const reqCount = Math.min(50, Math.max(0, parseInt(reqCountStr,10)||0));
      for (let i=1;i<=reqCount;i++) {
        const story = await vscode.window.showInputBox({ prompt: `User Story ${i} (As a ...)`, value: '' }) || 'TBD user story';
        reqBlocks += `### Requirement ${i}\n\n**User Story:** ${story}\n\n#### Acceptance Criteria\n\n1. TBD\n\n`;
      }
    } else {
      const bulk = await vscode.window.showInputBox({ prompt: 'Paste requirements block (optional)', value: '' });
      if (bulk) reqBlocks = bulk + (bulk.endsWith('\n')?'':'\n');
    }
    if (!reqBlocks) {
      reqBlocks = '### Requirement 1\n\n**User Story:** TBD\n\n#### Acceptance Criteria\n\n1. TBD\n';
    }
    const tpl = await readTemplate('templates/requirements-doc.tpl.md');
    const content = tpl
      .replace('{{PROJECT_NAME}}', project)
      .replace('{{INTRO}}', intro)
      .replace('{{REQUIREMENTS_BLOCK}}', reqBlocks.trimEnd());

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const slug = project.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const year = new Date().getFullYear();
    const fileName = `REQ-DOC-${year}-${Math.floor(Math.random()*9000+1000)}-${slug}.md`;
    const targetDir = vscode.Uri.joinPath(ws.uri,'docs','requirements');
    await vscode.workspace.fs.createDirectory(targetDir);
    const fileUri = vscode.Uri.joinPath(targetDir,fileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content,'utf8'));
    await vscode.window.showTextDocument(fileUri);
  } catch (e:any) {
    vscode.window.showErrorMessage(`Requirements doc generation failed: ${e.message}`);
  }
}

async function generateDesignFromRequirement() {
  try {
    const reqId = await vscode.window.showInputBox({ prompt: 'Requirement ID (e.g., REQ-2025-1043)', placeHolder: 'REQ-YYYY-####' });
    if (!reqId) return;
    
    const reqEntry = index.byId.get(reqId.trim());
    if (!reqEntry || reqEntry.kind !== 'requirement') {
      vscode.window.showErrorMessage(`Requirement '${reqId}' not found. Ensure file exists in docs/requirements/.`);
      return;
    }

    const reqDoc = await vscode.workspace.openTextDocument(reqEntry.uri);
    const reqText = reqDoc.getText();
    
    const title = reqEntry.data.title || reqId;
    const year = new Date().getFullYear();
    const designId = `DES-${year}-${Math.floor(Math.random()*9000+1000)}`;

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const designDir = vscode.Uri.joinPath(ws.uri, 'docs', 'designs');
    await vscode.workspace.fs.createDirectory(designDir);
    const designFile = vscode.Uri.joinPath(designDir, `${designId}.md`);
    
    const placeholder = `---
id: ${designId}
requirement: ${reqId}
status: draft
decisions: []
---
# Design: ${title}

## Overview
[Copilot will generate this section...]

## Architecture
[Copilot will generate this section...]

## Technical Decisions
[Copilot will generate this section...]

## Data Models
[Copilot will generate this section...]

## API Design
[Copilot will generate this section...]

## Security Considerations
[Copilot will generate this section...]

## Error Handling
[Copilot will generate this section...]

## Testing Strategy
[Copilot will generate this section...]

## Deployment
[Copilot will generate this section...]

`;
    await vscode.workspace.fs.writeFile(designFile, Buffer.from(placeholder, 'utf8'));
    
    // Open the file first
    const doc = await vscode.workspace.openTextDocument(designFile);
    const editor = await vscode.window.showTextDocument(doc);

    // Try to use Language Model API if available - prefer Claude Sonnet 4
    try {
      // Try Claude Sonnet 4 first (latest and best for technical content)
      let models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-sonnet-4' });
      
      // Fallback to Claude Sonnet 3.5
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-3.5-sonnet' });
      }
      
      // Fallback to any Anthropic Claude model
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
      }
      
      // Fallback to Copilot GPT-4 if Claude not available
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4' });
      }
      
      if (models && models.length > 0) {
        // Use streaming API to generate content
        await generateDesignWithLanguageModel(models[0], reqText, reqId, designId, title, designFile, editor);
        
        // Open Copilot Chat for iterative changes
        await openCopilotChatForIterativeEditing(designFile, designId, reqId, reqText);
        return;
      }
    } catch (e) {
      // Language Model API not available, fall back to chat
      console.log('Language Model API not available, using chat fallback');
    }

    // Fallback: Language Model API not available
    vscode.window.showWarningMessage(
      `⚠️ Design generation requires Language Model API (Claude or GPT-4).\n\n` +
      `The API is not available in your VS Code installation.\n\n` +
      `A placeholder file has been created. You can:\n` +
      `1. Manually fill in the design sections\n` +
      `2. Install GitHub Copilot Chat extension for AI assistance\n` +
      `3. Use inline chat to get help with specific sections`,
      'View File',
      'Install Copilot Chat'
    ).then(selection => {
      if (selection === 'View File') {
        vscode.window.showTextDocument(designFile);
      } else if (selection === 'Install Copilot Chat') {
        vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
      }
    });

  } catch (e: any) {
    vscode.window.showErrorMessage(`Design generation failed: ${e.message}`);
  }
}

async function generateTasksFromDesign() {
  try {
    const designId = await vscode.window.showInputBox({ 
      prompt: 'Design ID (e.g., DES-2025-1234)', 
      placeHolder: 'DES-YYYY-####' 
    });
    if (!designId) return;
    
    const designEntry = index.byId.get(designId.trim());
    if (!designEntry || designEntry.kind !== 'design') {
      vscode.window.showErrorMessage(`Design '${designId}' not found. Ensure file exists in docs/designs/.`);
      return;
    }

    const designDoc = await vscode.workspace.openTextDocument(designEntry.uri);
    const designText = designDoc.getText();

    const reqId = designEntry.data.requirement;
    if (!reqId) {
      vscode.window.showErrorMessage(`Design ${designId} has no linked requirement. Please add 'requirement: REQ-YYYY-####' to front-matter.`);
      return;
    }

    const reqEntry = index.byId.get(reqId);
    if (!reqEntry || reqEntry.kind !== 'requirement') {
      vscode.window.showErrorMessage(`Linked requirement '${reqId}' not found.`);
      return;
    }

    const reqDoc = await vscode.workspace.openTextDocument(reqEntry.uri);
    const reqText = reqDoc.getText();

    const reqTitle = reqEntry.data.title || reqId;
    const designTitle = designEntry.data.title || designId;

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const tasksDir = vscode.Uri.joinPath(ws.uri, 'docs', 'tasks');
    await vscode.workspace.fs.createDirectory(tasksDir);

    // Try to use Language Model API if available - prefer Claude Sonnet 4
    try {
      // Try Claude Sonnet 4 first (latest and best for technical content)
      let models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-sonnet-4' });
      
      // Fallback to Claude Sonnet 3.5
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-3.5-sonnet' });
      }
      
      // Fallback to any Anthropic Claude model
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
      }
      
      // Fallback to Copilot GPT-4 if Claude not available
      if (!models || models.length === 0) {
        models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4' });
      }
      
      if (models && models.length > 0) {
        console.log(`[Task Generation] Using model: ${models[0].vendor}/${models[0].family}`);
        await generateTasksWithLanguageModel(models[0], reqText, designText, reqId, designId, reqTitle, designTitle, tasksDir);
        // Task generation complete - openCopilotChatForReview is called inside generateTasksWithLanguageModel
        return;
      } else {
        console.log('[Task Generation] No language models found');
      }
    } catch (e: any) {
      console.error('[Task Generation] Language Model API error:', e);
      // This is a generation error, show specific error and return
      vscode.window.showErrorMessage(`Task generation failed: ${e.message}`);
      return;
    }

    // Fallback: Language Model API not available
    console.log('[Task Generation] Falling back - no models available');
    vscode.window.showWarningMessage(
      `⚠️ Task generation requires Language Model API (Claude or GPT-4).\n\n` +
      `The API is not available in your VS Code installation.\n\n` +
      `Please ensure GitHub Copilot Chat extension is installed and you have access to Claude or GPT-4 models.`,
      'Install Copilot Chat',
      'Learn More'
    ).then(selection => {
      if (selection === 'Install Copilot Chat') {
        vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/copilot/copilot-chat'));
      }
    });

    // Still show helpful message about manual workflow if needed
    const selection = await vscode.window.showInformationMessage(
      `� Alternative: Manual Task Creation\n\n` +
      `You can manually create task files in: ${tasksDir.fsPath}\n\n` +
      `Each task file should follow the standard structure with:\n` +
      `- Front-matter (id, design, requirement, status, priority, estimatedHours)\n` +
      `- Task sections (Overview, Requirements, Design Reference, Implementation, Acceptance Criteria)`,
      'Open Tasks Folder',
      'Show Example',
      'Got it'
    );

    if (selection === 'Open Tasks Folder') {
      vscode.commands.executeCommand('revealInExplorer', tasksDir);
    } else if (selection === 'Show Example') {
      const example = `Example task file: docs/tasks/TASK-2025-5001-setup-architecture.md

---
id: TASK-2025-5001
design: ${designId}
requirement: ${reqId}
status: todo
priority: high
estimatedHours: 6
---

# Task: Setup Core Architecture

## Overview
[Content from Copilot Chat]

[... rest of sections ...]`;
      
      const panel = vscode.window.createWebviewPanel(
        'taskExample',
        'Task File Example',
        vscode.ViewColumn.Beside,
        {}
      );
      panel.webview.html = `<pre>${example}</pre>`;
    }

  } catch (e: any) {
    vscode.window.showErrorMessage(`Task generation failed: ${e.message}`);
  }
}

async function generateDesignWithLanguageModel(
  model: vscode.LanguageModelChat,
  reqText: string,
  reqId: string,
  designId: string,
  title: string,
  designFile: vscode.Uri,
  editor: vscode.TextEditor
) {
  // SOLUTION: Multi-stage generation to avoid token limits
  // Generate document in sections, then combine
  
  const sections = [
    {
      name: 'Overview & Architecture',
      prompt: `Analyze this requirement and generate ONLY these sections:

## Overview
- Complete high-level technical approach addressing ALL requirements
- Key technologies and architectural patterns
- Success criteria mapped to metrics

## Architecture
- Detailed system components and responsibilities
- Data flow and interactions (include mermaid diagrams)
- How each component addresses specific requirements
- Scalability and performance considerations

**REQUIREMENT (${reqId}):**
${reqText}

Generate complete, detailed content. Use mermaid diagrams. Be thorough.`
    },
    {
      name: 'Technical Decisions & Data Models',
      prompt: `Based on this requirement, generate ONLY these sections:

## Technical Decisions
- Complete technology choices with detailed rationale
- Why each decision addresses specific requirements
- Trade-offs and alternatives considered

## Data Models
- Complete entity definitions and schemas with examples
- Relationships and constraints
- How models support requirement use cases

**REQUIREMENT (${reqId}):**
${reqText}

Generate complete, detailed content with code examples.`
    },
    {
      name: 'API Design & Security',
      prompt: `Based on this requirement, generate ONLY these sections:

## API Design
- All endpoints needed for requirements
- Complete request/response formats with examples
- Authentication and authorization approach

## Security Considerations
- Auth mechanisms addressing requirement risks
- Data protection strategies
- Security measures for each risk identified

**REQUIREMENT (${reqId}):**
${reqText}

Generate complete, detailed content with code examples.`
    },
    {
      name: 'Error Handling, Testing & Deployment',
      prompt: `Based on this requirement, generate ONLY these sections:

## Error Handling
- All error scenarios from requirements
- Graceful degradation strategies
- User feedback mechanisms

## Testing Strategy
- How to verify each acceptance criterion
- Unit, integration, and E2E test approach
- Performance testing for metrics

## Deployment & Operations
- Infrastructure requirements
- CI/CD pipeline
- Monitoring for requirement metrics
- Rollback strategies

**REQUIREMENT (${reqId}):**
${reqText}

Generate complete, detailed content.`
    }
  ];

  try {
    let fullContent = '';
    
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Generating design ${designId}...`,
      cancellable: false
    }, async (progress) => {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        progress.report({ 
          message: `Generating ${section.name} (${i + 1}/${sections.length})...`,
          increment: (100 / sections.length)
        });

        const messages = [vscode.LanguageModelChatMessage.User(section.prompt)];
        const chatRequest = await model.sendRequest(messages, {
          justification: 'Generating design document section'
        }, new vscode.CancellationTokenSource().token);

        let sectionContent = '';
        for await (const fragment of chatRequest.text) {
          sectionContent += fragment;
        }

        // Strip code blocks if present
        sectionContent = sectionContent.trim();
        sectionContent = sectionContent.replace(/^```(?:markdown)?\s*\n?/i, '');
        sectionContent = sectionContent.replace(/\n?```\s*$/i, '');
        sectionContent = sectionContent.trim();

        fullContent += '\n\n' + sectionContent;
        
        progress.report({ 
          message: `Completed ${section.name} (${fullContent.length} chars)` 
        });
      }
    });

    const generatedContent = fullContent.trim();

    if (generatedContent) {
      // Preserve front-matter, replace content
      const doc = editor.document;
      const text = doc.getText();
      const fmMatch = /^---\n[\s\S]*?\n---\n/m.exec(text);
      
      let newContent;
      if (fmMatch) {
        newContent = fmMatch[0] + '\n# Design: ' + title + '\n\n' + generatedContent;
      } else {
        newContent = `---
id: ${designId}
requirement: ${reqId}
status: draft
decisions: []
---

# Design: ${title}

${generatedContent}`;
      }

      const edit = new vscode.WorkspaceEdit();
      edit.replace(designFile, new vscode.Range(0, 0, doc.lineCount, 0), newContent);
      await vscode.workspace.applyEdit(edit);
      await doc.save();

      // Show success message with options
      const action = await vscode.window.showInformationMessage(
        `✅ Design ${designId} generated successfully! (${generatedContent.length} characters)`,
        'View File',
        'Review with Copilot'
      );
      
      if (action === 'View File') {
        await vscode.window.showTextDocument(designFile);
      } else if (action === 'Review with Copilot') {
        // Open Copilot Chat with review prompt
        await openCopilotChatForReview(designFile, designId, reqId, generatedContent);
      }
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to generate with Language Model: ${error.message}`);
    throw error;
  }
}

async function generateTasksWithLanguageModel(
  model: vscode.LanguageModelChat,
  reqText: string,
  designText: string,
  reqId: string,
  designId: string,
  reqTitle: string,
  designTitle: string,
  tasksDir: vscode.Uri
) {
  // Generate a single consolidated task breakdown document
  // Similar to design generation - one file with sections
  
  try {
    const year = new Date().getFullYear();
    const taskDocId = `TASK-DOC-${year}-${Math.floor(Math.random()*9000+1000)}`;
    const taskFile = vscode.Uri.joinPath(tasksDir, `${taskDocId}-${designId}-tasks.md`);
    
    // Generate comprehensive task breakdown in one document
    const taskPrompt = `Generate a comprehensive task breakdown document for implementing this design.

**REQUIREMENT (${reqId}):**
${reqText}

**DESIGN (${designId}):**
${designText}

**INSTRUCTIONS:**
Create a complete task breakdown document with:

1. **Front-matter** (YAML):
   - id: ${taskDocId}
   - design: ${designId}
   - requirement: ${reqId}
   - status: draft

2. **# Task Breakdown: ${designTitle}** (main heading)

3. **## Overview**
   - Summary of what needs to be implemented
   - Link to requirement and design
   - Total estimated effort

4. **## Implementation Tasks** (organize as sections and subsections)
   
   For each major area (5-8 tasks total), create:
   
   ### Task N: [Task Title] (Priority: high/medium/low | Est: Xh)
   
   **Requirements Coverage:**
   - Quote specific parts from ${reqId}
   
   **Design Reference:**
   - Reference specific design decisions from ${designId}
   
   **Implementation Steps:**
   1. Detailed step with code examples
   2. Next step with specifics
   3. Continue with thorough guidance
   
   **Acceptance Criteria:**
   - [ ] Specific, testable criterion 1
   - [ ] Specific, testable criterion 2
   - [ ] Specific, testable criterion 3
   
   **Dependencies:** List any task dependencies
   
   ---

5. **## Task Summary**
   - Table or list of all tasks with ID, priority, estimate
   - Recommended implementation order

6. **## Testing Strategy**
   - How to test each task
   - Integration testing approach

7. **## Notes**
   - Additional considerations
   - Risks or gotchas

**FORMAT:**
Output ONLY the markdown content (including front-matter).
Be thorough and detailed - this is production-ready documentation.
Include code examples and specific technical guidance for each task.`;

    let generatedContent = '';

    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Generating task breakdown for ${designId}...`,
      cancellable: false
    }, async (progress) => {
      try {
        console.log('[Task Generation] Sending prompt to AI...');
        progress.report({ message: 'Sending request to AI model...' });
        
        const messages = [vscode.LanguageModelChatMessage.User(taskPrompt)];
        
        console.log('[Task Generation] Calling model.sendRequest...');
        const chatRequest = await model.sendRequest(messages, {
          justification: 'Generating task breakdown document'
        }, new vscode.CancellationTokenSource().token);

        console.log('[Task Generation] chatRequest received:', chatRequest ? 'valid' : 'null/undefined');
        
        if (!chatRequest) {
          throw new Error('Chat request returned null or undefined');
        }

        progress.report({ message: 'Receiving AI response...' });
        
        console.log('[Task Generation] Starting to read text stream...');
        for await (const fragment of chatRequest.text) {
          generatedContent += fragment;
        }

        console.log('[Task Generation] AI response received, length:', generatedContent.length);
      } catch (error: any) {
        console.error('[Task Generation] Error in progress callback:', error);
        throw error;
      }
    });

    if (!generatedContent || generatedContent.length < 100) {
      vscode.window.showErrorMessage('Failed to generate task breakdown. No content generated.');
      return;
    }

    // Strip code blocks if present
    generatedContent = generatedContent.trim();
    generatedContent = generatedContent.replace(/^```(?:markdown)?\s*\n?/i, '');
    generatedContent = generatedContent.replace(/\n?```\s*$/i, '');
    generatedContent = generatedContent.trim();

    // Write the task breakdown document
    console.log(`[Task Generation] Writing task file: ${taskFile.fsPath}`);
    await vscode.workspace.fs.writeFile(taskFile, Buffer.from(generatedContent, 'utf8'));
    
    // Trigger file watcher to enable CodeLens buttons
    await handleChange(taskFile);
    
    console.log(`[Task Generation] Task breakdown written successfully`);
    
    // Show success message with action buttons (matching design generation behavior)
    const selection = await vscode.window.showInformationMessage(
      `✅ Task breakdown generated successfully! (${generatedContent.length} characters)`,
      'View File',
      'Review with Copilot',
      'Open Tasks Folder'
    );
    
    if (selection === 'View File') {
      await vscode.window.showTextDocument(taskFile);
    } else if (selection === 'Review with Copilot') {
      // Open Copilot Chat with review prompt (just like design generation)
      await openCopilotChatForReview(taskFile, taskDocId, reqId, generatedContent);
    } else if (selection === 'Open Tasks Folder') {
      vscode.commands.executeCommand('revealInExplorer', tasksDir);
    }

  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to generate task breakdown with Language Model: ${error.message}`);
    throw error;
  }
}

function parseTaskOutline(outlineText: string): Array<{
  id: string;
  title: string;
  priority: string;
  hours: number;
  reqSections: string[];
  designSections: string[];
}> {
  const tasks: Array<any> = [];
  
  console.log('[parseTaskOutline] Raw outline text:', outlineText.substring(0, 500));
  
  // Look for task outline format: "1. TASK-2025-5001 | Title | priority | Xh | Req: ... | Design: ..."
  const lines = outlineText.split('\n');
  
  for (const line of lines) {
    const match = line.match(/\d+\.\s+(TASK-\d{4}-\d{4})\s*\|\s*(.+?)\s*\|\s*(high|medium|low)\s*\|\s*(\d+)h?\s*\|\s*Req:\s*(.+?)\s*\|\s*Design:\s*(.+?)$/i);
    if (match) {
      tasks.push({
        id: match[1],
        title: match[2].trim(),
        priority: match[3].toLowerCase(),
        hours: parseInt(match[4], 10),
        reqSections: match[5].split(',').map(s => s.trim()),
        designSections: match[6].split(',').map(s => s.trim())
      });
    }
  }
  
  console.log(`[parseTaskOutline] Structured format found ${tasks.length} tasks`);
  
  // Fallback: Parse alternative format "TASK-2025-5001-title.md - Description"
  if (tasks.length === 0) {
    console.log('[parseTaskOutline] Trying alternative format...');
    
    for (const line of lines) {
      // Match: "TASK-2025-5001-setup-database-schema.md - Database setup for age ranges"
      const fileMatch = line.match(/(TASK-\d{4}-\d{4})-([a-z0-9-]+)\.md\s*-\s*(.+)/i);
      if (fileMatch) {
        const id = fileMatch[1];
        const slug = fileMatch[2];
        const description = fileMatch[3].trim();
        
        // Convert slug to title (e.g., "setup-database-schema" → "Setup Database Schema")
        const title = slug.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        
        tasks.push({
          id,
          title,
          priority: 'medium',
          hours: 6,
          reqSections: ['All requirements'],
          designSections: ['All design sections']
        });
      }
    }
    
    console.log(`[parseTaskOutline] Alternative format found ${tasks.length} tasks`);
  }
  
  // Last resort: Extract unique TASK IDs
  if (tasks.length === 0) {
    console.log('[parseTaskOutline] Using fallback TASK-ID extraction...');
    const taskIdMatches = outlineText.match(/TASK-\d{4}-\d{4}/g);
    if (taskIdMatches) {
      // Remove duplicates
      const uniqueIds = Array.from(new Set(taskIdMatches));
      console.log(`[parseTaskOutline] Found ${uniqueIds.length} unique task IDs:`, uniqueIds);
      
      uniqueIds.forEach((id, index) => {
        tasks.push({
          id,
          title: `Implementation Task ${index + 1}`,
          priority: 'medium',
          hours: 6,
          reqSections: ['All requirements'],
          designSections: ['All design sections']
        });
      });
    }
  }
  
  console.log(`[parseTaskOutline] Final task count: ${tasks.length}`);
  return tasks;
}

async function openCopilotChatForReview(
  fileUri: vscode.Uri,
  docId: string,
  reqId: string,
  content: string
) {
  // Open Copilot Chat with request for improvement suggestions and gap analysis
  const fileName = fileUri.fsPath.split('/').pop();
  const docType = docId.startsWith('DES-') ? 'design' : docId.startsWith('TASK-') ? 'task' : 'document';
  
  // Extract preview of content (first 2000 chars for better context)
  const contentPreview = content.substring(0, 2000);
  const hasMore = content.length > 2000;
  
  const chatPrompt = `@workspace I've generated a ${docType} document (${docId}) based on requirement ${reqId}.

**Generated Document:**
- **ID:** ${docId}
- **File:** \`${fileName}\`
- **Location:** \`${fileUri.fsPath}\`
- **Requirement:** ${reqId}
- **Size:** ${content.length} characters

---

### 📄 Generated Content

\`\`\`markdown
${contentPreview}${hasMore ? '\n\n... (content continues - total ' + content.length + ' chars)' : ''}
\`\`\`

---

### 🔍 Please Review and Analyze

Please analyze this generated ${docType} and provide feedback on:

1. **Completeness Check:**
   - What sections or details are missing?
   - Are all aspects of the requirement ${reqId} addressed?
   - For ${docType === 'design' ? 'designs: Are architecture, security, testing, and deployment covered?' : 'tasks: Are implementation steps, acceptance criteria, and dependencies clear?'}

2. **Quality Assessment:**
   - Is the content specific and actionable?
   - Are there vague statements that need more detail?
   - Are code examples, diagrams, or technical specifics needed?

3. **Improvement Suggestions:**
   - What could be added to make this ${docType} better?
   - Are there best practices or patterns that should be included?
   - What risks or edge cases might be overlooked?

4. **Structure & Clarity:**
   - Is the document well-organized?
   - Are any sections unclear or confusing?
   - Should anything be reorganized or expanded?

**Please provide specific, actionable suggestions for improvement.**`;

  // Open Copilot Chat with the review request
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  // Show notification with action
  vscode.window.showInformationMessage(
    `🔍 ${docType.charAt(0).toUpperCase() + docType.slice(1)} generated. Copilot is reviewing for improvements...`,
    'Open File',
    'View in Editor'
  ).then(selection => {
    if (selection === 'Open File' || selection === 'View in Editor') {
      vscode.window.showTextDocument(fileUri);
    }
  });
}

async function openCopilotChatForIterativeEditing(
  fileUri: vscode.Uri,
  docId: string,
  reqId: string,
  content: string
) {
  // Open Copilot Chat with context for iterative editing
  const fileName = fileUri.fsPath.split('/').pop();
  const docType = docId.startsWith('DES-') ? 'design' : docId.startsWith('TASK-') ? 'task' : 'document';
  
  const chatPrompt = `@workspace I've just generated ${docType} document ${docId} (${fileName}).

**Context:**
- Document ID: ${docId}
- Requirement: ${reqId}
- File: ${fileUri.fsPath}

**Current Content Preview:**
\`\`\`markdown
${content.substring(0, 1000)}${content.length > 1000 ? '\n...(truncated)' : ''}
\`\`\`

The ${docType} has been created and saved. I'm now ready to make iterative improvements.

**You can help me:**
- Refine or expand any section
- Add more technical details
- Improve clarity or structure
- Add diagrams or examples
- Review for completeness
- Suggest improvements

**To edit the file, use:**
- \`@workspace /edit ${fileUri.fsPath}\` to make changes
- Ask me to read specific sections: "Show me the Architecture section"
- Request additions: "Add a Security section"
- Request refinements: "Expand the API Design section with more examples"

What would you like to improve or discuss about this ${docType}?`;

  // Open Copilot Chat with context
  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  // Show informational message
  vscode.window.showInformationMessage(
    `💬 Copilot Chat opened for ${docId}. You can now make iterative improvements!`,
    'View File',
    'Got it'
  ).then(selection => {
    if (selection === 'View File') {
      vscode.window.showTextDocument(fileUri);
    }
  });
}

export function deactivate() {}
