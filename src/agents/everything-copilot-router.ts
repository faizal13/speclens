import * as vscode from 'vscode';

/**
 * everything-copilot integration for SpecLens
 *
 * Routes tasks to specialized agents based on task type:
 * - @architect: Setup, database, architecture decisions
 * - @tdd: Test writing, test-first development
 * - @implement: General implementation
 * - @security-reviewer: Security, validation, auth
 * - @e2e: End-to-end testing
 * - @refactor: Code cleanup, refactoring
 */

export interface TaskContext {
  taskId: string;
  taskTitle: string;
  taskContent: string;
  acceptanceCriteria: string[];
  requirementId?: string;
  designId?: string;
}

/**
 * Detect task type from task title and acceptance criteria
 */
export function detectTaskType(task: TaskContext): AgentType {
  const title = task.taskTitle.toLowerCase();
  const criteria = task.acceptanceCriteria.join(' ').toLowerCase();
  const combined = `${title} ${criteria}`;

  // Setup and architecture tasks → @architect
  if (
    title.includes('setup') ||
    title.includes('project structure') ||
    title.includes('database schema') ||
    title.includes('prisma') ||
    title.includes('migration') ||
    title.includes('architecture') ||
    title.includes('tech stack') ||
    criteria.includes('prisma schema') ||
    criteria.includes('database migration')
  ) {
    return 'architect';
  }

  // Test tasks → @tdd
  if (
    title.includes('test') ||
    title.includes('unit test') ||
    title.includes('integration test') ||
    title.includes('regression test') ||
    criteria.includes('test coverage') ||
    criteria.includes('write test') ||
    criteria.includes('test passes') ||
    criteria.includes('test fails')
  ) {
    return 'tdd';
  }

  // E2E test tasks → @e2e
  if (
    title.includes('e2e') ||
    title.includes('end-to-end') ||
    title.includes('playwright') ||
    title.includes('cypress') ||
    criteria.includes('e2e test')
  ) {
    return 'e2e';
  }

  // Security tasks → @security-reviewer
  if (
    title.includes('security') ||
    title.includes('csrf') ||
    title.includes('xss') ||
    title.includes('authentication') ||
    title.includes('authorization') ||
    title.includes('audit') ||
    title.includes('vulnerability') ||
    criteria.includes('csrf protection') ||
    criteria.includes('rate limiting') ||
    criteria.includes('security headers') ||
    criteria.includes('owasp')
  ) {
    return 'security-reviewer';
  }

  // Refactor tasks → @refactor
  if (
    title.includes('refactor') ||
    title.includes('cleanup') ||
    title.includes('optimize') ||
    title.includes('improve') ||
    criteria.includes('code quality') ||
    criteria.includes('clean up')
  ) {
    return 'refactor';
  }

  // Default: implementation tasks → @implement
  return 'implement';
}

export type AgentType = 'architect' | 'tdd' | 'e2e' | 'security-reviewer' | 'refactor' | 'implement';

export interface AgentInfo {
  type: AgentType;
  handle: string;
  description: string;
  model: 'opus' | 'sonnet' | 'haiku';
}

/**
 * Get agent info for a task type
 */
export function getAgentInfo(type: AgentType): AgentInfo {
  const agents: Record<AgentType, AgentInfo> = {
    'architect': {
      type: 'architect',
      handle: '@architect',
      description: 'Strategic planner for setup, database, and architecture',
      model: 'opus'
    },
    'tdd': {
      type: 'tdd',
      handle: '@tdd',
      description: 'Test-driven development specialist',
      model: 'sonnet'
    },
    'e2e': {
      type: 'e2e',
      handle: '@e2e',
      description: 'End-to-end testing specialist',
      model: 'sonnet'
    },
    'security-reviewer': {
      type: 'security-reviewer',
      handle: '@security-reviewer',
      description: 'Security audit and hardening specialist',
      model: 'opus'
    },
    'refactor': {
      type: 'refactor',
      handle: '@refactor-clean',
      description: 'Code refactoring and cleanup specialist',
      model: 'sonnet'
    },
    'implement': {
      type: 'implement',
      handle: '@implement',
      description: 'General implementation specialist',
      model: 'sonnet'
    }
  };

  return agents[type];
}

/**
 * Check if everything-copilot is available
 */
export async function isEverythingCopilotAvailable(): Promise<boolean> {
  try {
    // Check if .copilot-agents/ directory exists
    const workspaces = vscode.workspace.workspaceFolders;
    if (!workspaces || workspaces.length === 0) {
      return false;
    }

    const agentsDir = vscode.Uri.joinPath(workspaces[0].uri, '.copilot-agents');
    try {
      await vscode.workspace.fs.stat(agentsDir);
      return true;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}

/**
 * Build task prompt with everything-copilot agent prefix
 */
export function buildAgentTaskPrompt(task: TaskContext, agentType: AgentType, spec?: string, plan?: string): string {
  const agent = getAgentInfo(agentType);

  let prompt = `${agent.handle} `;

  // Add context sections
  if (spec) {
    prompt += `\n\n**SPEC CONTEXT:**\n\`\`\`markdown\n${spec.substring(0, 2000)}\n\`\`\`\n`;
  }

  if (plan) {
    prompt += `\n\n**PLAN CONTEXT:**\n\`\`\`markdown\n${plan.substring(0, 2000)}\n\`\`\`\n`;
  }

  // Add task details
  prompt += `\n\n**TASK: ${task.taskTitle}**\n\n${task.taskContent}\n\n`;

  // Add acceptance criteria
  if (task.acceptanceCriteria.length > 0) {
    prompt += `**Acceptance Criteria:**\n`;
    for (const criterion of task.acceptanceCriteria) {
      prompt += `- [ ] ${criterion}\n`;
    }
  }

  // Add agent-specific instructions
  switch (agentType) {
    case 'architect':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Focus on architecture, data models, and tech decisions\n`;
      prompt += `- Ensure setup is production-ready\n`;
      prompt += `- Follow best practices for the tech stack\n`;
      break;

    case 'tdd':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Write tests FIRST (TDD approach)\n`;
      prompt += `- Ensure tests fail before implementation\n`;
      prompt += `- Aim for >90% code coverage\n`;
      prompt += `- Include edge cases and error scenarios\n`;
      break;

    case 'e2e':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Write end-to-end tests using Playwright/Cypress\n`;
      prompt += `- Test user flows from start to finish\n`;
      prompt += `- Include happy path and error scenarios\n`;
      prompt += `- Take screenshots on failure\n`;
      break;

    case 'security-reviewer':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Review against OWASP Top 10\n`;
      prompt += `- Ensure proper input validation\n`;
      prompt += `- Check for XSS, CSRF, SQL injection vulnerabilities\n`;
      prompt += `- Verify authentication and authorization\n`;
      prompt += `- Add security headers and rate limiting\n`;
      break;

    case 'refactor':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Improve code quality and maintainability\n`;
      prompt += `- Remove duplication and dead code\n`;
      prompt += `- Ensure tests still pass after refactoring\n`;
      prompt += `- Follow SOLID principles\n`;
      break;

    case 'implement':
      prompt += `\n**Instructions:**\n`;
      prompt += `- Implement the feature following the spec and plan\n`;
      prompt += `- Write clean, maintainable code\n`;
      prompt += `- Include error handling\n`;
      prompt += `- Add inline comments for complex logic\n`;
      break;
  }

  return prompt;
}

/**
 * Route task to everything-copilot agent
 */
export async function routeToEverythingCopilot(
  task: TaskContext,
  spec?: string,
  plan?: string
): Promise<boolean> {
  // Detect task type
  const agentType = detectTaskType(task);
  const agent = getAgentInfo(agentType);

  // Build prompt with agent prefix
  const prompt = buildAgentTaskPrompt(task, agentType, spec, plan);

  // Show notification about which agent is being used
  vscode.window.showInformationMessage(
    `🤖 Routing to ${agent.handle} (${agent.description}) - Model: ${agent.model.toUpperCase()}`
  );

  // Open Copilot Chat with agent-prefixed prompt
  try {
    const copilotExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
    if (copilotExtension) {
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt });
      return true;
    }

    // Fallback to regular chat if Copilot not available
    vscode.window.showWarningMessage(
      'GitHub Copilot not detected. Install everything-copilot for specialized agent routing.',
      'Learn More'
    ).then(selection => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/faizal13/everything-copilot'));
      }
    });
    return false;

  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to route to agent: ${e.message}`);
    return false;
  }
}

/**
 * Suggest installing everything-copilot if not available
 */
export async function suggestEverythingCopilot(): Promise<void> {
  const choice = await vscode.window.showInformationMessage(
    '💡 Install everything-copilot for specialized AI agents (@architect, @tdd, @security-reviewer) and cost optimization!',
    'Install Now',
    'Learn More',
    'Not Now'
  );

  if (choice === 'Install Now') {
    const terminal = vscode.window.createTerminal('everything-copilot');
    terminal.show();
    terminal.sendText('npx everything-copilot init');
  } else if (choice === 'Learn More') {
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/faizal13/everything-copilot'));
  }
}
