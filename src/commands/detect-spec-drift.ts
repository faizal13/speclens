import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Spec Drift Detection - Detect when implementation diverges from approved spec
 *
 * Analyzes:
 * 1. Code files vs spec requirements
 * 2. Database schema vs data models in spec
 * 3. API routes vs API contracts in spec
 * 4. Security implementation vs security requirements
 */

interface DriftIssue {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: 'feature-mismatch' | 'missing-implementation' | 'extra-implementation' | 'security-gap' | 'data-model-drift' | 'api-contract-drift';
  title: string;
  description: string;
  specReference: string;
  codeReference?: string;
  recommendation: string;
}

interface DriftReport {
  featureName: string;
  specPath: string;
  codebasePath: string;
  scannedFiles: number;
  issues: DriftIssue[];
  overallDriftScore: number; // 0-100 (0 = perfect alignment, 100 = complete drift)
  lastAnalyzed: Date;
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

/**
 * Detect spec drift for a feature
 */
export async function detectSpecDrift(): Promise<void> {
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

  // Let user select which feature to analyze
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
      placeHolder: 'Select a feature to detect spec drift',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedSpecUri = selected.uri;
  }

  const featurePath = path.dirname(selectedSpecUri.fsPath);
  const featureName = path.basename(featurePath);

  // Ask user for codebase path to scan
  const codebasePath = await vscode.window.showInputBox({
    prompt: 'Enter the path to scan for implementation (e.g., src/auth/ or src/)',
    placeHolder: 'src/',
    value: 'src/',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please provide a codebase path';
      }
      return undefined;
    }
  });

  if (!codebasePath) {
    return; // User cancelled
  }

  // Show progress indicator
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Analyzing spec drift for ${featureName}...`,
    cancellable: false
  }, async (progress) => {
    progress.report({ increment: 20, message: 'Reading spec...' });

    // Build drift report
    const report = await buildDriftReport(featurePath, featureName, codebasePath);

    progress.report({ increment: 80, message: 'Generating report...' });

    // Show report in webview
    showDriftReportPanel(report);
  });
}

/**
 * Build drift report by analyzing spec vs codebase
 */
async function buildDriftReport(
  featurePath: string,
  featureName: string,
  codebasePath: string
): Promise<DriftReport> {
  const issues: DriftIssue[] = [];
  let scannedFiles = 0;

  // Read spec.md
  let specContent = '';
  try {
    const specUri = vscode.Uri.file(path.join(featurePath, 'spec.md'));
    const specContentBuffer = await vscode.workspace.fs.readFile(specUri);
    specContent = Buffer.from(specContentBuffer).toString('utf8');
  } catch {
    issues.push({
      severity: 'critical',
      category: 'missing-implementation',
      title: 'Spec file not found',
      description: 'spec.md is missing or unreadable',
      specReference: 'spec.md',
      recommendation: 'Create a spec.md file for this feature'
    });
  }

  // Extract spec requirements
  const specRequirements = extractSpecRequirements(specContent);

  // Scan codebase files
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (ws) {
    const codebaseUri = vscode.Uri.joinPath(ws.uri, codebasePath);

    try {
      // Find all code files in the codebase path
      const pattern = new vscode.RelativePattern(codebaseUri, '**/*.{ts,js,tsx,jsx,py,go,java,prisma,sql}');
      const codeFiles = await vscode.workspace.findFiles(pattern);
      scannedFiles = codeFiles.length;

      // Analyze each code file
      for (const fileUri of codeFiles) {
        await analyzeDrift(fileUri, specRequirements, issues);
      }
    } catch (error) {
      issues.push({
        severity: 'high',
        category: 'missing-implementation',
        title: 'Codebase path not found',
        description: `Could not access ${codebasePath}`,
        specReference: 'N/A',
        recommendation: 'Verify the codebase path exists'
      });
    }
  }

  // Check for missing implementations
  checkMissingImplementations(specRequirements, issues);

  // Calculate drift score (0-100)
  const criticalCount = issues.filter(i => i.severity === 'critical').length;
  const highCount = issues.filter(i => i.severity === 'high').length;
  const mediumCount = issues.filter(i => i.severity === 'medium').length;
  const lowCount = issues.filter(i => i.severity === 'low').length;

  const overallDriftScore = Math.min(100, (criticalCount * 25) + (highCount * 15) + (mediumCount * 8) + (lowCount * 3));

  return {
    featureName,
    specPath: path.join(featurePath, 'spec.md'),
    codebasePath,
    scannedFiles,
    issues,
    overallDriftScore,
    lastAnalyzed: new Date(),
    summary: {
      critical: criticalCount,
      high: highCount,
      medium: mediumCount,
      low: lowCount
    }
  };
}

/**
 * Extract requirements from spec
 */
function extractSpecRequirements(specContent: string): {
  apis: string[];
  dataModels: string[];
  securityRequirements: string[];
  features: string[];
} {
  const apis: string[] = [];
  const dataModels: string[] = [];
  const securityRequirements: string[] = [];
  const features: string[] = [];

  // Extract API endpoints
  const apiMatches = specContent.matchAll(/(?:POST|GET|PUT|DELETE|PATCH)\s+([\/\w-]+)/gi);
  for (const match of apiMatches) {
    apis.push(match[0]);
  }

  // Extract data models (TypeScript interfaces, SQL tables)
  const interfaceMatches = specContent.matchAll(/interface\s+(\w+)/g);
  for (const match of interfaceMatches) {
    dataModels.push(match[1]);
  }

  const tableMatches = specContent.matchAll(/CREATE\s+TABLE\s+(\w+)/gi);
  for (const match of tableMatches) {
    dataModels.push(match[1]);
  }

  // Extract security requirements
  const securitySection = specContent.match(/##\s+Security.*?([\s\S]*?)(?=##|$)/i);
  if (securitySection) {
    const secMatches = securitySection[1].matchAll(/[-*]\s+(.+)/g);
    for (const match of secMatches) {
      securityRequirements.push(match[1].trim());
    }
  }

  // Extract feature list from user stories
  const userStoriesSection = specContent.match(/##\s+User\s+Stories([\s\S]*?)(?=##|$)/i);
  if (userStoriesSection) {
    const storyMatches = userStoriesSection[1].matchAll(/[-*]\s+As\s+a.*?,\s+I\s+want\s+(.+?)(?:so that|$)/gi);
    for (const match of storyMatches) {
      features.push(match[1].trim());
    }
  }

  return { apis, dataModels, securityRequirements, features };
}

/**
 * Analyze drift for a single file
 */
async function analyzeDrift(
  fileUri: vscode.Uri,
  specRequirements: ReturnType<typeof extractSpecRequirements>,
  issues: DriftIssue[]
): Promise<void> {
  try {
    const fileContent = await vscode.workspace.fs.readFile(fileUri);
    const fileText = Buffer.from(fileContent).toString('utf8');
    const fileName = path.basename(fileUri.fsPath);

    // Check for undocumented API endpoints
    const codeApiMatches = fileText.matchAll(/(?:router|app)\.(post|get|put|delete|patch)\s*\(\s*['"`]([^'"`]+)/gi);
    for (const match of codeApiMatches) {
      const method = match[1].toUpperCase();
      const route = match[2];
      const fullEndpoint = `${method} ${route}`;

      // Check if this endpoint is in the spec
      const inSpec = specRequirements.apis.some(api => api.includes(route));
      if (!inSpec) {
        issues.push({
          severity: 'medium',
          category: 'extra-implementation',
          title: `Undocumented API endpoint: ${fullEndpoint}`,
          description: `Found ${fullEndpoint} in code but not in spec`,
          specReference: 'API Contracts',
          codeReference: fileName,
          recommendation: `Add ${fullEndpoint} to spec.md API contracts or remove if unnecessary`
        });
      }
    }

    // Check for undocumented data models
    const codeInterfaceMatches = fileText.matchAll(/(?:interface|type|class)\s+(\w+)/g);
    for (const match of codeInterfaceMatches) {
      const modelName = match[1];

      // Skip common/generic types
      if (['Props', 'State', 'Config', 'Options'].includes(modelName)) continue;

      const inSpec = specRequirements.dataModels.includes(modelName);
      if (!inSpec && !modelName.endsWith('Props') && !modelName.endsWith('Config')) {
        issues.push({
          severity: 'low',
          category: 'data-model-drift',
          title: `Undocumented data model: ${modelName}`,
          description: `Found ${modelName} in code but not in spec data models`,
          specReference: 'Data Models',
          codeReference: fileName,
          recommendation: `Add ${modelName} to spec.md data models section`
        });
      }
    }

    // Check for missing security implementations
    if (specRequirements.securityRequirements.length > 0) {
      const hasAuth = /auth|authenticate|authorization|jwt|bcrypt|passport/i.test(fileText);
      const hasCsrf = /csrf/i.test(fileText);
      const hasValidation = /validate|sanitize|zod|joi/i.test(fileText);

      if (specRequirements.securityRequirements.some(req => req.toLowerCase().includes('authentication')) && !hasAuth) {
        issues.push({
          severity: 'critical',
          category: 'security-gap',
          title: 'Missing authentication implementation',
          description: 'Spec requires authentication but no auth code found',
          specReference: 'Security Requirements',
          codeReference: fileName,
          recommendation: 'Implement authentication as specified in spec.md'
        });
      }

      if (specRequirements.securityRequirements.some(req => req.toLowerCase().includes('csrf')) && !hasCsrf) {
        issues.push({
          severity: 'high',
          category: 'security-gap',
          title: 'Missing CSRF protection',
          description: 'Spec requires CSRF protection but no implementation found',
          specReference: 'Security Requirements',
          codeReference: fileName,
          recommendation: 'Add CSRF token validation as specified in spec.md'
        });
      }

      if (specRequirements.securityRequirements.some(req => req.toLowerCase().includes('validation')) && !hasValidation) {
        issues.push({
          severity: 'high',
          category: 'security-gap',
          title: 'Missing input validation',
          description: 'Spec requires input validation but no validation library found',
          specReference: 'Security Requirements',
          codeReference: fileName,
          recommendation: 'Add input validation (e.g., Zod, Joi) as specified in spec.md'
        });
      }
    }
  } catch (error) {
    // Skip files that can't be read
  }
}

/**
 * Check for spec requirements that have no implementation
 */
function checkMissingImplementations(
  specRequirements: ReturnType<typeof extractSpecRequirements>,
  issues: DriftIssue[]
): void {
  // This is a simplified check - in production, you'd scan all code files first
  // and then compare against spec requirements

  if (specRequirements.apis.length === 0 && specRequirements.dataModels.length === 0) {
    issues.push({
      severity: 'medium',
      category: 'missing-implementation',
      title: 'Spec lacks concrete requirements',
      description: 'No API endpoints or data models found in spec',
      specReference: 'spec.md',
      recommendation: 'Add concrete API contracts and data models to spec.md'
    });
  }
}

/**
 * Show drift report in webview
 */
function showDriftReportPanel(report: DriftReport): void {
  const panel = vscode.window.createWebviewPanel(
    'speclensDrift',
    `Drift Detection: ${report.featureName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(report);
}

/**
 * Generate HTML content for drift report
 */
function getWebviewContent(report: DriftReport): string {
  const driftColor = report.overallDriftScore <= 20 ? '#28a745' :
                     report.overallDriftScore <= 40 ? '#5cb85c' :
                     report.overallDriftScore <= 60 ? '#f0ad4e' :
                     report.overallDriftScore <= 80 ? '#d9534f' : '#c9302c';

  const severityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#c9302c';
      case 'high': return '#d9534f';
      case 'medium': return '#f0ad4e';
      case 'low': return '#5cb85c';
      default: return '#999';
    }
  };

  const categoryIcon = (category: string) => {
    switch (category) {
      case 'feature-mismatch': return '🔀';
      case 'missing-implementation': return '❌';
      case 'extra-implementation': return '➕';
      case 'security-gap': return '🔒';
      case 'data-model-drift': return '📊';
      case 'api-contract-drift': return '🌐';
      default: return '⚠️';
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Spec Drift Detection</title>
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
    .drift-score {
      text-align: center;
      margin: 30px 0;
    }
    .drift-gauge {
      position: relative;
      width: 200px;
      height: 200px;
      margin: 0 auto;
      border-radius: 50%;
      background: conic-gradient(
        ${driftColor} ${report.overallDriftScore * 3.6}deg,
        var(--vscode-editor-inactiveSelectionBackground) ${report.overallDriftScore * 3.6}deg
      );
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .drift-gauge-inner {
      width: 150px;
      height: 150px;
      border-radius: 50%;
      background-color: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .drift-value {
      font-size: 48px;
      font-weight: bold;
      color: ${driftColor};
    }
    .drift-label {
      font-size: 14px;
      opacity: 0.8;
    }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 15px;
      border-radius: 4px;
      text-align: center;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
    }
    .metric-label {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 5px;
    }
    .issue-card {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border-left: 4px solid;
      padding: 15px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .issue-header {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
    .issue-icon {
      font-size: 24px;
      margin-right: 10px;
    }
    .issue-title {
      font-weight: bold;
      font-size: 16px;
      flex: 1;
    }
    .severity-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
      color: white;
      text-transform: uppercase;
    }
    .issue-description {
      margin: 10px 0;
      opacity: 0.9;
    }
    .issue-reference {
      font-size: 12px;
      opacity: 0.7;
      margin: 5px 0;
    }
    .issue-recommendation {
      background-color: rgba(240, 173, 78, 0.1);
      border-left: 3px solid #f0ad4e;
      padding: 10px;
      margin-top: 10px;
      border-radius: 3px;
      font-size: 14px;
    }
    .filter-buttons {
      margin: 20px 0;
    }
    .filter-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 16px;
      margin-right: 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    .filter-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    .filter-btn.active {
      background-color: var(--vscode-textLink-foreground);
    }
    .hidden {
      display: none;
    }
    .summary-box {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <h1>🔍 Spec Drift Detection: ${report.featureName}</h1>

  <div class="drift-score">
    <div class="drift-gauge">
      <div class="drift-gauge-inner">
        <div class="drift-value">${report.overallDriftScore}</div>
        <div class="drift-label">Drift Score</div>
      </div>
    </div>
    <p style="margin-top: 20px; opacity: 0.8;">
      ${report.overallDriftScore <= 20 ? '✅ Excellent alignment with spec' :
        report.overallDriftScore <= 40 ? '👍 Good alignment, minor drift' :
        report.overallDriftScore <= 60 ? '⚠️ Moderate drift detected' :
        report.overallDriftScore <= 80 ? '🚨 Significant drift from spec' :
        '❌ Critical drift - major realignment needed'}
    </p>
  </div>

  <div class="summary-box">
    <strong>Analysis Summary</strong><br>
    Scanned ${report.scannedFiles} files in <code>${report.codebasePath}</code><br>
    Last analyzed: ${report.lastAnalyzed.toLocaleString()}<br>
    Spec: <code>${report.specPath}</code>
  </div>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value" style="color: #c9302c">${report.summary.critical}</div>
      <div class="metric-label">Critical Issues</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #d9534f">${report.summary.high}</div>
      <div class="metric-label">High Priority</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #f0ad4e">${report.summary.medium}</div>
      <div class="metric-label">Medium Priority</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #5cb85c">${report.summary.low}</div>
      <div class="metric-label">Low Priority</div>
    </div>
  </div>

  <h2>Issues Found</h2>

  ${report.issues.length === 0 ? `
    <div style="text-align: center; padding: 40px; opacity: 0.6;">
      <div style="font-size: 48px;">🎉</div>
      <div style="font-size: 18px; margin-top: 10px;">No drift detected!</div>
      <div style="font-size: 14px; margin-top: 5px;">Implementation aligns perfectly with spec.</div>
    </div>
  ` : `
    <div class="filter-buttons">
      <button class="filter-btn active" onclick="filterIssues('all')">All (${report.issues.length})</button>
      <button class="filter-btn" onclick="filterIssues('critical')">Critical (${report.summary.critical})</button>
      <button class="filter-btn" onclick="filterIssues('high')">High (${report.summary.high})</button>
      <button class="filter-btn" onclick="filterIssues('medium')">Medium (${report.summary.medium})</button>
      <button class="filter-btn" onclick="filterIssues('low')">Low (${report.summary.low})</button>
      <button class="filter-btn" onclick="filterIssues('security-gap')">🔒 Security</button>
      <button class="filter-btn" onclick="filterIssues('api-contract-drift')">🌐 API</button>
    </div>

    ${report.issues.map(issue => `
      <div class="issue-card" style="border-left-color: ${severityColor(issue.severity)}" data-severity="${issue.severity}" data-category="${issue.category}">
        <div class="issue-header">
          <span class="issue-icon">${categoryIcon(issue.category)}</span>
          <span class="issue-title">${issue.title}</span>
          <span class="severity-badge" style="background-color: ${severityColor(issue.severity)}">${issue.severity}</span>
        </div>
        <div class="issue-description">${issue.description}</div>
        <div class="issue-reference">
          📝 Spec: ${issue.specReference}
          ${issue.codeReference ? `| 💻 Code: ${issue.codeReference}` : ''}
        </div>
        <div class="issue-recommendation">
          <strong>💡 Recommendation:</strong> ${issue.recommendation}
        </div>
      </div>
    `).join('')}
  `}

  <script>
    function filterIssues(filter) {
      // Update button states
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');

      // Filter issue cards
      const cards = document.querySelectorAll('.issue-card');
      cards.forEach(card => {
        if (filter === 'all') {
          card.classList.remove('hidden');
        } else {
          const severity = card.dataset.severity;
          const category = card.dataset.category;

          if (severity === filter || category === filter) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        }
      });
    }
  </script>
</body>
</html>`;
}
