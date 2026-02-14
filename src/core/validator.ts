import * as vscode from 'vscode';
import { FileKind, WorkspaceIndex, parseFrontMatter } from '../indexer';

// Allowed statuses per type
export const STATUS: Record<FileKind, string[]> = {
  requirement: ['draft', 'review', 'approved', 'implemented'],
  design: ['draft', 'review', 'approved'],
  task: ['todo', 'in-progress', 'done']
};

export const REQUIRED_KEYS: Record<FileKind, string[]> = {
  requirement: ['problem', 'metrics', 'risks'],
  design: ['requirement', 'decisions'],
  task: ['requirement', 'design', 'acceptance']
};

function lineRangeFor(line: number): vscode.Range {
  return new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 120));
}

function pushDiag(diags: vscode.Diagnostic[], uri: vscode.Uri, msg: string, line: number, severity: vscode.DiagnosticSeverity = vscode.DiagnosticSeverity.Warning) {
  const d = new vscode.Diagnostic(lineRangeFor(line), msg, severity);
  d.source = 'RakDev AI';
  diags.push(d);
}

export async function validateUri(uri: vscode.Uri, index: WorkspaceIndex, diagnosticCollection: vscode.DiagnosticCollection) {
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

export async function validateAllOpen(index: WorkspaceIndex, diagnosticCollection: vscode.DiagnosticCollection, onComplete?: () => void) {
  const files = await vscode.workspace.findFiles('docs/{requirements,designs,tasks}/**/*.md');
  for (const f of files) await validateUri(f, index, diagnosticCollection);
  if (onComplete) onComplete();
}
