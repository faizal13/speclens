import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Traceability Matrix - Visual relationship mapping
 *
 * Shows:
 * - Spec Requirements → Plan Components → Tasks
 * - Coverage gaps (requirements without tasks)
 * - Implementation status by requirement
 */

interface Requirement {
  id: string;
  title: string;
  type: 'goal' | 'user-story' | 'technical' | 'security' | 'performance';
  text: string;
}

interface PlanComponent {
  id: string;
  title: string;
  phase: string;
  requirementRefs: string[]; // Which requirements this addresses
}

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'blocked' | 'done';
  requirementRefs: string[]; // Which requirements this implements
  planRefs: string[]; // Which plan components this belongs to
  estimatedHours: number;
}

interface TraceabilityMatrix {
  requirements: Requirement[];
  planComponents: PlanComponent[];
  tasks: Task[];
  coverage: {
    [requirementId: string]: {
      planComponents: string[];
      tasks: string[];
      completionPercentage: number;
      status: 'not-started' | 'in-progress' | 'completed' | 'partially-covered';
    };
  };
  gaps: {
    requirementsWithoutTasks: string[];
    requirementsWithoutPlan: string[];
    tasksWithoutRequirements: string[];
  };
}

/**
 * Show traceability matrix for a feature
 */
export async function showTraceabilityMatrix(): Promise<void> {
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
      placeHolder: 'Select a feature to analyze traceability',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedSpecUri = selected.uri;
  }

  const featurePath = path.dirname(selectedSpecUri.fsPath);
  const featureName = path.basename(featurePath);

  // Build traceability matrix
  const matrix = await buildTraceabilityMatrix(featurePath);

  // Show matrix in webview panel
  showTraceabilityMatrixPanel(featureName, matrix);
}

/**
 * Build traceability matrix from spec/plan/tasks
 */
async function buildTraceabilityMatrix(featurePath: string): Promise<TraceabilityMatrix> {
  const requirements: Requirement[] = [];
  const planComponents: PlanComponent[] = [];
  const tasks: Task[] = [];

  // Parse spec.md for requirements
  try {
    const specUri = vscode.Uri.file(path.join(featurePath, 'spec.md'));
    const specContent = await vscode.workspace.fs.readFile(specUri);
    const specText = Buffer.from(specContent).toString('utf8');

    // Extract goals
    const goalsSection = specText.match(/##\s+Goals([\s\S]*?)(?=##|$)/i);
    if (goalsSection) {
      const goalMatches = goalsSection[1].matchAll(/[-*]\s+(.+)/g);
      let goalIndex = 1;
      for (const match of goalMatches) {
        requirements.push({
          id: `REQ-GOAL-${goalIndex}`,
          title: match[1].trim(),
          type: 'goal',
          text: match[1].trim()
        });
        goalIndex++;
      }
    }

    // Extract user stories
    const userStoriesSection = specText.match(/##\s+User\s+Stories([\s\S]*?)(?=##|$)/i);
    if (userStoriesSection) {
      const storyMatches = userStoriesSection[1].matchAll(/[-*]\s+(.+)/g);
      let storyIndex = 1;
      for (const match of storyMatches) {
        requirements.push({
          id: `REQ-STORY-${storyIndex}`,
          title: match[1].trim(),
          type: 'user-story',
          text: match[1].trim()
        });
        storyIndex++;
      }
    }

    // Extract technical requirements
    const techReqSection = specText.match(/##\s+Technical\s+Requirements([\s\S]*?)(?=##|$)/i);
    if (techReqSection) {
      const techMatches = techReqSection[1].matchAll(/[-*]\s+(.+)/g);
      let techIndex = 1;
      for (const match of techMatches) {
        requirements.push({
          id: `REQ-TECH-${techIndex}`,
          title: match[1].trim(),
          type: 'technical',
          text: match[1].trim()
        });
        techIndex++;
      }
    }
  } catch {
    // spec.md not found
  }

  // Parse plan.md for components
  try {
    const planUri = vscode.Uri.file(path.join(featurePath, 'plan.md'));
    const planContent = await vscode.workspace.fs.readFile(planUri);
    const planText = Buffer.from(planContent).toString('utf8');

    // Extract implementation phases
    const phaseRegex = /##\s+Phase\s+\d+:\s+(.+)/gi;
    let phaseMatch;
    let phaseIndex = 1;

    while ((phaseMatch = phaseRegex.exec(planText)) !== null) {
      const phaseTitle = phaseMatch[1].trim();

      // Extract steps within this phase
      const phaseStart = phaseMatch.index;
      const nextPhase = planText.indexOf('## Phase', phaseStart + 1);
      const phaseContent = nextPhase > 0 ? planText.substring(phaseStart, nextPhase) : planText.substring(phaseStart);

      const stepMatches = phaseContent.matchAll(/[-*]\s+(.+)/g);
      let stepIndex = 1;
      for (const step of stepMatches) {
        // Simple keyword matching to link plan components to requirements
        const stepText = step[1].toLowerCase();
        const requirementRefs: string[] = [];

        // Match to requirements by keyword overlap
        for (const req of requirements) {
          const reqKeywords = req.text.toLowerCase().split(' ').filter(w => w.length > 4);
          const stepKeywords = stepText.split(' ').filter(w => w.length > 4);
          const overlap = reqKeywords.filter(kw => stepKeywords.includes(kw));

          if (overlap.length >= 2) {
            requirementRefs.push(req.id);
          }
        }

        planComponents.push({
          id: `PLAN-${phaseIndex}-${stepIndex}`,
          title: step[1].trim(),
          phase: phaseTitle,
          requirementRefs
        });
        stepIndex++;
      }
      phaseIndex++;
    }
  } catch {
    // plan.md not found
  }

  // Parse tasks.md for tasks
  try {
    const tasksUri = vscode.Uri.file(path.join(featurePath, 'tasks.md'));
    const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
    const tasksText = Buffer.from(tasksContent).toString('utf8');

    // Split into task sections
    const taskSections = tasksText.split(/^##\s+Task\s+(\d+):/gm);

    for (let i = 1; i < taskSections.length; i += 2) {
      const taskNum = taskSections[i];
      const taskContent = taskSections[i + 1];

      // Extract title
      const titleMatch = taskContent.match(/^(.+)/);
      const title = titleMatch ? titleMatch[1].trim() : `Task ${taskNum}`;

      // Extract status
      const statusMatch = taskContent.match(/\*\*Status:\*\*\s*(\w+)/i);
      let status: 'pending' | 'in-progress' | 'blocked' | 'done' = 'pending';
      if (statusMatch) {
        const statusText = statusMatch[1].toLowerCase();
        if (statusText === 'done' || statusText === 'completed') status = 'done';
        else if (statusText === 'in-progress' || statusText === 'in_progress') status = 'in-progress';
        else if (statusText === 'blocked') status = 'blocked';
      }

      // Extract estimated hours
      const hoursMatch = taskContent.match(/\*\*Estimated\s+Time:\*\*\s*(\d+)\s*hours?/i);
      const estimatedHours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;

      // Match to requirements by keyword overlap
      const taskText = taskContent.toLowerCase();
      const requirementRefs: string[] = [];
      const planRefs: string[] = [];

      for (const req of requirements) {
        const reqKeywords = req.text.toLowerCase().split(' ').filter(w => w.length > 4);
        const taskKeywords = taskText.split(' ').filter(w => w.length > 4);
        const overlap = reqKeywords.filter(kw => taskKeywords.includes(kw));

        if (overlap.length >= 2) {
          requirementRefs.push(req.id);
        }
      }

      for (const plan of planComponents) {
        const planKeywords = plan.title.toLowerCase().split(' ').filter(w => w.length > 4);
        const taskKeywords = taskText.split(' ').filter(w => w.length > 4);
        const overlap = planKeywords.filter(kw => taskKeywords.includes(kw));

        if (overlap.length >= 2) {
          planRefs.push(plan.id);
        }
      }

      tasks.push({
        id: `TASK-${taskNum}`,
        title,
        status,
        requirementRefs,
        planRefs,
        estimatedHours
      });
    }
  } catch {
    // tasks.md not found
  }

  // Calculate coverage
  const coverage: TraceabilityMatrix['coverage'] = {};

  for (const req of requirements) {
    const relatedPlanComponents = planComponents.filter(p => p.requirementRefs.includes(req.id)).map(p => p.id);
    const relatedTasks = tasks.filter(t => t.requirementRefs.includes(req.id));

    const completedTasks = relatedTasks.filter(t => t.status === 'done').length;
    const totalTasks = relatedTasks.length;
    const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let status: 'not-started' | 'in-progress' | 'completed' | 'partially-covered' = 'not-started';
    if (totalTasks === 0) {
      status = 'not-started';
    } else if (completionPercentage === 100) {
      status = 'completed';
    } else if (completionPercentage > 0) {
      status = 'in-progress';
    } else {
      status = 'partially-covered';
    }

    coverage[req.id] = {
      planComponents: relatedPlanComponents,
      tasks: relatedTasks.map(t => t.id),
      completionPercentage,
      status
    };
  }

  // Identify gaps
  const gaps = {
    requirementsWithoutTasks: requirements.filter(r => coverage[r.id].tasks.length === 0).map(r => r.id),
    requirementsWithoutPlan: requirements.filter(r => coverage[r.id].planComponents.length === 0).map(r => r.id),
    tasksWithoutRequirements: tasks.filter(t => t.requirementRefs.length === 0).map(t => t.id)
  };

  return {
    requirements,
    planComponents,
    tasks,
    coverage,
    gaps
  };
}

/**
 * Create and show traceability matrix webview
 */
function showTraceabilityMatrixPanel(featureName: string, matrix: TraceabilityMatrix): void {
  const panel = vscode.window.createWebviewPanel(
    'speclensTraceability',
    `Traceability: ${featureName}`,
    vscode.ViewColumn.One,
    {
      enableScripts: true
    }
  );

  panel.webview.html = getWebviewContent(featureName, matrix);
}

/**
 * Generate HTML content for traceability matrix
 */
function getWebviewContent(featureName: string, matrix: TraceabilityMatrix): string {
  const statusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#28a745';
      case 'in-progress': return '#5cb85c';
      case 'partially-covered': return '#f0ad4e';
      case 'not-started': return '#d9534f';
      default: return '#999';
    }
  };

  const taskStatusBadge = (status: string) => {
    const badges: Record<string, string> = {
      'done': '✅ Done',
      'in-progress': '🔄 In Progress',
      'blocked': '🚫 Blocked',
      'pending': '⏸️ Pending'
    };
    return badges[status] || status;
  };

  // Calculate overall metrics
  const totalRequirements = matrix.requirements.length;
  const fullyImplemented = Object.values(matrix.coverage).filter(c => c.status === 'completed').length;
  const inProgress = Object.values(matrix.coverage).filter(c => c.status === 'in-progress').length;
  const notStarted = Object.values(matrix.coverage).filter(c => c.status === 'not-started').length;
  const overallCoverage = totalRequirements > 0 ? Math.round((fullyImplemented / totalRequirements) * 100) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Traceability Matrix</title>
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
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      color: var(--vscode-textLink-foreground);
    }
    .metric-label {
      font-size: 12px;
      text-transform: uppercase;
      opacity: 0.8;
      margin-top: 5px;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      font-size: 14px;
    }
    .matrix-table th {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      padding: 12px;
      text-align: left;
      border: 1px solid var(--vscode-panel-border);
      font-weight: bold;
    }
    .matrix-table td {
      padding: 12px;
      border: 1px solid var(--vscode-panel-border);
      vertical-align: top;
    }
    .requirement-cell {
      max-width: 300px;
    }
    .req-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: bold;
      margin-right: 8px;
      color: white;
    }
    .req-goal { background-color: #007bff; }
    .req-story { background-color: #6f42c1; }
    .req-technical { background-color: #17a2b8; }
    .req-security { background-color: #dc3545; }
    .req-performance { background-color: #ffc107; color: #000; }
    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
    }
    .task-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .task-list li {
      padding: 4px 0;
      font-size: 12px;
    }
    .task-badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      margin-left: 8px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    .gap-warning {
      background-color: rgba(217, 83, 79, 0.1);
      border-left: 4px solid #d9534f;
      padding: 12px;
      margin: 10px 0;
      border-radius: 4px;
    }
    .coverage-bar {
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      height: 24px;
      margin: 10px 0;
      overflow: hidden;
      position: relative;
    }
    .coverage-fill {
      background-color: #28a745;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      transition: width 0.3s ease;
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
  </style>
</head>
<body>
  <h1>🔗 Traceability Matrix: ${featureName}</h1>

  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value">${overallCoverage}%</div>
      <div class="metric-label">Overall Coverage</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #28a745">${fullyImplemented}</div>
      <div class="metric-label">Fully Implemented</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #5cb85c">${inProgress}</div>
      <div class="metric-label">In Progress</div>
    </div>
    <div class="metric-card">
      <div class="metric-value" style="color: #d9534f">${notStarted}</div>
      <div class="metric-label">Not Started</div>
    </div>
  </div>

  <div class="coverage-bar">
    <div class="coverage-fill" style="width: ${overallCoverage}%">
      ${overallCoverage}% Requirements Implemented
    </div>
  </div>

  ${matrix.gaps.requirementsWithoutTasks.length > 0 ? `
    <h2>⚠️ Coverage Gaps</h2>
    ${matrix.gaps.requirementsWithoutTasks.length > 0 ? `
      <div class="gap-warning">
        ❌ ${matrix.gaps.requirementsWithoutTasks.length} requirement(s) have no implementing tasks: ${matrix.gaps.requirementsWithoutTasks.join(', ')}
      </div>
    ` : ''}
    ${matrix.gaps.requirementsWithoutPlan.length > 0 ? `
      <div class="gap-warning">
        ⚠️ ${matrix.gaps.requirementsWithoutPlan.length} requirement(s) have no plan components: ${matrix.gaps.requirementsWithoutPlan.join(', ')}
      </div>
    ` : ''}
    ${matrix.gaps.tasksWithoutRequirements.length > 0 ? `
      <div class="gap-warning">
        ℹ️ ${matrix.gaps.tasksWithoutRequirements.length} task(s) not linked to requirements: ${matrix.gaps.tasksWithoutRequirements.join(', ')}
      </div>
    ` : ''}
  ` : ''}

  <h2>Requirement → Task Mapping</h2>

  <div class="filter-buttons">
    <button class="filter-btn active" onclick="filterRequirements('all')">All</button>
    <button class="filter-btn" onclick="filterRequirements('goal')">Goals</button>
    <button class="filter-btn" onclick="filterRequirements('user-story')">User Stories</button>
    <button class="filter-btn" onclick="filterRequirements('technical')">Technical</button>
    <button class="filter-btn" onclick="filterRequirements('not-started')">Not Started</button>
    <button class="filter-btn" onclick="filterRequirements('in-progress')">In Progress</button>
    <button class="filter-btn" onclick="filterRequirements('completed')">Completed</button>
  </div>

  <table class="matrix-table">
    <thead>
      <tr>
        <th style="width: 40%">Requirement</th>
        <th style="width: 20%">Status</th>
        <th style="width: 40%">Implementing Tasks</th>
      </tr>
    </thead>
    <tbody>
      ${matrix.requirements.map(req => {
        const cov = matrix.coverage[req.id];
        const reqTasks = matrix.tasks.filter(t => cov.tasks.includes(t.id));

        return `
          <tr class="req-row" data-type="${req.type}" data-status="${cov.status}">
            <td class="requirement-cell">
              <span class="req-badge req-${req.type}">${req.type.toUpperCase()}</span>
              <div><strong>${req.id}</strong></div>
              <div>${req.title}</div>
            </td>
            <td>
              <span class="status-indicator" style="background-color: ${statusColor(cov.status)}"></span>
              ${cov.status.replace(/-/g, ' ').toUpperCase()}
              <div style="margin-top: 8px; font-size: 12px;">
                ${cov.completionPercentage}% complete
              </div>
            </td>
            <td>
              ${reqTasks.length > 0 ? `
                <ul class="task-list">
                  ${reqTasks.map(task => `
                    <li>
                      ${task.title}
                      <span class="task-badge">${taskStatusBadge(task.status)}</span>
                    </li>
                  `).join('')}
                </ul>
              ` : '<em style="color: #d9534f;">No tasks implementing this requirement</em>'}
            </td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>

  <h2>📊 Requirements Breakdown</h2>
  <div class="metrics">
    <div class="metric-card">
      <div class="metric-value">${matrix.requirements.filter(r => r.type === 'goal').length}</div>
      <div class="metric-label">Goals</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${matrix.requirements.filter(r => r.type === 'user-story').length}</div>
      <div class="metric-label">User Stories</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${matrix.requirements.filter(r => r.type === 'technical').length}</div>
      <div class="metric-label">Technical Reqs</div>
    </div>
    <div class="metric-card">
      <div class="metric-value">${matrix.tasks.length}</div>
      <div class="metric-label">Total Tasks</div>
    </div>
  </div>

  <script>
    function filterRequirements(filter) {
      // Update button states
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');

      // Filter rows
      const rows = document.querySelectorAll('.req-row');
      rows.forEach(row => {
        if (filter === 'all') {
          row.classList.remove('hidden');
        } else if (['goal', 'user-story', 'technical', 'security', 'performance'].includes(filter)) {
          // Filter by requirement type
          if (row.dataset.type === filter) {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        } else {
          // Filter by status
          if (row.dataset.status === filter) {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        }
      });
    }
  </script>
</body>
</html>`;
}
