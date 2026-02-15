import * as vscode from 'vscode';
import * as path from 'path';
import { generateValidationReport, ValidationReport } from '../core/enhanced-validation';

/**
 * Show validation report for a feature
 */
export async function showValidationReport(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Find all spec.md files
  const specFiles = await vscode.workspace.findFiles('specs/*/spec.md');

  if (specFiles.length === 0) {
    vscode.window.showErrorMessage('No specs found. Create a spec first.');
    return;
  }

  // Let user select which feature to validate
  let selectedSpecUri: vscode.Uri;

  if (specFiles.length === 1) {
    selectedSpecUri = specFiles[0];
  } else {
    const items = specFiles.map(uri => {
      const featureName = path.basename(path.dirname(uri.fsPath));
      return {
        label: featureName,
        description: uri.fsPath,
        uri: uri
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a feature to validate',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedSpecUri = selected.uri;
  }

  const featurePath = path.dirname(selectedSpecUri.fsPath);
  const featureName = path.basename(featurePath);

  // Generate validation report
  const report = await generateValidationReport(featurePath);

  // Show report in webview panel
  showValidationReportPanel(featureName, report);
}

/**
 * Create and show validation report webview
 */
function showValidationReportPanel(featureName: string, report: ValidationReport): void {
  const panel = vscode.window.createWebviewPanel(
    'speclensValidation',
    `Validation: ${featureName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(featureName, report);
}

/**
 * Generate HTML content for validation report
 */
function getWebviewContent(featureName: string, report: ValidationReport): string {
  const healthColor = {
    'Excellent': '#28a745',
    'Good': '#5cb85c',
    'Fair': '#f0ad4e',
    'Poor': '#d9534f'
  }[report.overallHealth];

  const gradeColor = (grade: string) => {
    switch (grade) {
      case 'A': return '#28a745';
      case 'B': return '#5cb85c';
      case 'C': return '#f0ad4e';
      case 'D': return '#d9534f';
      case 'F': return '#c9302c';
      default: return '#999';
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Validation Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      padding: 20px;
      line-height: 1.6;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
    }
    h1 {
      color: var(--vscode-editor-foreground);
      border-bottom: 2px solid var(--vscode-panel-border);
      padding-bottom: 10px;
    }
    h2 {
      color: var(--vscode-editor-foreground);
      margin-top: 30px;
      margin-bottom: 15px;
    }
    .health-badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 18px;
      color: white;
      background-color: ${healthColor};
      margin-bottom: 20px;
    }
    .score-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-left: 4px solid var(--vscode-textLink-foreground);
      padding: 15px;
      margin: 15px 0;
      border-radius: 4px;
    }
    .score-value {
      font-size: 48px;
      font-weight: bold;
      margin: 10px 0;
    }
    .grade-badge {
      display: inline-block;
      padding: 10px 20px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 32px;
      color: white;
      margin-left: 20px;
    }
    .progress-bar {
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      height: 24px;
      margin: 10px 0;
      overflow: hidden;
      position: relative;
    }
    .progress-fill {
      background-color: var(--vscode-button-background);
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
    }
    .checklist {
      list-style: none;
      padding: 0;
    }
    .checklist li {
      padding: 8px 0;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    .checklist li:before {
      content: '✓ ';
      color: #28a745;
      font-weight: bold;
      margin-right: 8px;
    }
    .checklist li.missing:before {
      content: '✗ ';
      color: #d9534f;
    }
    .issue {
      background-color: rgba(217, 83, 79, 0.1);
      border-left: 4px solid #d9534f;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .recommendation {
      background-color: rgba(240, 173, 78, 0.1);
      border-left: 4px solid #f0ad4e;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .stat-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      color: var(--vscode-textLink-foreground);
    }
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 5px;
    }
  </style>
</head>
<body>
  <h1>📊 Validation Report: ${featureName}</h1>

  <div class="health-badge">Overall Health: ${report.overallHealth}</div>

  ${report.criticalIssues.length > 0 ? `
    <h2>🚨 Critical Issues</h2>
    ${report.criticalIssues.map(issue => `<div class="issue">❌ ${issue}</div>`).join('')}
  ` : ''}

  ${report.specScore ? `
    <h2>📝 Spec Completeness</h2>
    <div class="score-card">
      <div style="display: flex; align-items: center;">
        <div>
          <div class="score-value">${report.specScore.totalScore}%</div>
          <div>Completeness Score</div>
        </div>
        <span class="grade-badge" style="background-color: ${gradeColor(report.specScore.grade)}">
          Grade ${report.specScore.grade}
        </span>
      </div>

      <h3>Requirements Checklist</h3>
      <ul class="checklist">
        <li class="${report.specScore.breakdown.hasOverview ? '' : 'missing'}">Overview Section</li>
        <li class="${report.specScore.breakdown.hasGoals ? '' : 'missing'}">Goals Section</li>
        <li class="${report.specScore.breakdown.hasUserStories ? '' : 'missing'}">User Stories</li>
        <li class="${report.specScore.breakdown.hasSuccessMetrics ? '' : 'missing'}">Success Metrics</li>
        <li class="${report.specScore.breakdown.hasTechnicalRequirements ? '' : 'missing'}">Technical Requirements</li>
        <li class="${report.specScore.breakdown.hasDataModel ? '' : 'missing'}">Data Model</li>
        <li class="${report.specScore.breakdown.hasOutOfScope ? '' : 'missing'}">Out of Scope</li>
        <li class="${report.specScore.breakdown.hasSecurityConsiderations ? '' : 'missing'}">Security Considerations</li>
      </ul>
    </div>
  ` : '<div class="issue">⚠️ spec.md not found</div>'}

  ${report.traceability ? `
    <h2>🔗 Plan-to-Spec Traceability</h2>
    <div class="score-card">
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.traceability.alignment}%">
          ${report.traceability.alignment}% Aligned
        </div>
      </div>

      <h3>Coverage Analysis</h3>
      <ul class="checklist">
        <li class="${report.traceability.coverage.techStackDefined ? '' : 'missing'}">Tech Stack Defined</li>
        <li class="${report.traceability.coverage.architectureDescribed ? '' : 'missing'}">Architecture Described</li>
        <li class="${report.traceability.coverage.dataModelsMatch ? '' : 'missing'}">Data Models Match Spec</li>
        <li class="${report.traceability.coverage.securityAddressed ? '' : 'missing'}">Security Requirements Addressed</li>
        <li class="${report.traceability.coverage.performanceAddressed ? '' : 'missing'}">Performance Requirements Addressed</li>
      </ul>

      ${report.traceability.gaps.length > 0 ? `
        <h3>Gaps Found</h3>
        ${report.traceability.gaps.map(gap => `<div class="issue">⚠️ ${gap}</div>`).join('')}
      ` : ''}
    </div>
  ` : ''}

  ${report.taskCoverage ? `
    <h2>✅ Task Coverage</h2>
    <div class="score-card">
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${report.taskCoverage.totalTasks}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #28a745">${report.taskCoverage.completedTasks}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #5cb85c">${report.taskCoverage.inProgressTasks}</div>
          <div class="stat-label">In Progress</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #d9534f">${report.taskCoverage.blockedTasks}</div>
          <div class="stat-label">Blocked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #999">${report.taskCoverage.pendingTasks}</div>
          <div class="stat-label">Pending</div>
        </div>
      </div>

      <h3>Progress</h3>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${report.taskCoverage.coveragePercentage}%; background-color: #28a745">
          ${report.taskCoverage.coveragePercentage}% Complete
        </div>
      </div>

      <div class="progress-bar" style="margin-top: 5px">
        <div class="progress-fill" style="width: ${report.taskCoverage.progressPercentage}%; background-color: #5cb85c">
          ${report.taskCoverage.progressPercentage}% Started
        </div>
      </div>

      <h3>Time Estimates</h3>
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-value">${report.taskCoverage.estimatedHoursTotal}h</div>
          <div class="stat-label">Total Estimated</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #28a745">${report.taskCoverage.estimatedHoursCompleted}h</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card">
          <div class="stat-value" style="color: #f0ad4e">${report.taskCoverage.estimatedHoursRemaining}h</div>
          <div class="stat-label">Remaining</div>
        </div>
      </div>
    </div>
  ` : ''}

  ${report.recommendations.length > 0 ? `
    <h2>💡 Recommendations</h2>
    ${report.recommendations.map(rec => `<div class="recommendation">💡 ${rec}</div>`).join('')}
  ` : ''}

  <div style="margin-top: 40px; padding: 20px; background-color: var(--vscode-editor-inactiveSelectionBackground); border-radius: 4px;">
    <h3>Next Steps</h3>
    <p>
      ${report.overallHealth === 'Excellent' ? '🎉 Your spec-driven development is in great shape! Keep executing tasks and monitoring progress.' :
        report.overallHealth === 'Good' ? '👍 You\'re on the right track. Address the recommendations above to reach excellent status.' :
        report.overallHealth === 'Fair' ? '⚠️ There are some gaps to address. Focus on completing your spec and plan first.' :
        '🚨 Critical issues need attention. Start by addressing the issues above.'}
    </p>
  </div>
</body>
</html>`;
}
