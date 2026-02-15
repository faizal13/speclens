import * as vscode from 'vscode';
import { getPreferredAgent, AgentCapabilities } from './detector';

export interface TaskContext {
  taskId: string;
  taskTitle: string;
  taskContent: string;
  requirementId?: string;
  designId?: string;
  mode: 'help' | 'implement';
}

/**
 * Route a task to the appropriate AI agent
 */
export async function routeTaskToAgent(context: TaskContext): Promise<boolean> {
  const agent = await getPreferredAgent();

  if (!agent) {
    vscode.window.showWarningMessage(
      'No AI coding agent detected. Please install GitHub Copilot, Claude Code, or Cursor.',
      'Learn More'
    ).then(selection => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/faizal13/speclens#agent-support'));
      }
    });
    return false;
  }

  // Route based on agent type
  switch (agent.type) {
    case 'copilot':
      return await routeToCopilot(context, agent);
    case 'claude':
      return await routeToClaude(context, agent);
    case 'cursor':
      return await routeToCursor(context, agent);
    default:
      return false;
  }
}

/**
 * Route task to GitHub Copilot Chat
 */
async function routeToCopilot(context: TaskContext, agent: AgentCapabilities): Promise<boolean> {
  const prompt = buildCopilotPrompt(context);

  try {
    // Try edit command first if in implement mode
    if (context.mode === 'implement' && agent.editCommand) {
      try {
        await vscode.commands.executeCommand(agent.editCommand, { query: prompt });
        vscode.window.showInformationMessage(`🚀 Task ${context.taskId} started with ${agent.name}!`);
        return true;
      } catch (editError: any) {
        // Edit command not available, fall back to chat
        console.log(`Edit command failed, falling back to chat: ${editError.message}`);
      }
    }

    // Fall back to chat command
    if (agent.chatCommand) {
      await vscode.commands.executeCommand(agent.chatCommand, { query: prompt });
      vscode.window.showInformationMessage(`💬 ${agent.name} opened for task ${context.taskId}`);
      return true;
    }

    throw new Error('No available commands for Copilot');
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open ${agent.name}: ${e.message}`);
    return false;
  }
}

/**
 * Route task to Claude Code
 */
async function routeToClaude(context: TaskContext, agent: AgentCapabilities): Promise<boolean> {
  const prompt = buildClaudePrompt(context);

  try {
    // Try edit command first if in implement mode
    if (context.mode === 'implement' && agent.editCommand) {
      try {
        await vscode.commands.executeCommand(agent.editCommand, prompt);
        vscode.window.showInformationMessage(`🚀 Task ${context.taskId} started with ${agent.name}!`);
        return true;
      } catch (editError: any) {
        // Edit command not available, fall back to chat
        console.log(`Edit command failed, falling back to chat: ${editError.message}`);
      }
    }

    // Fall back to chat command
    if (agent.chatCommand) {
      await vscode.commands.executeCommand(agent.chatCommand, prompt);
      vscode.window.showInformationMessage(`💬 ${agent.name} opened for task ${context.taskId}`);
      return true;
    }

    throw new Error('No available commands for Claude Code');
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open ${agent.name}: ${e.message}`);
    return false;
  }
}

/**
 * Route task to Cursor Composer
 */
async function routeToCursor(context: TaskContext, agent: AgentCapabilities): Promise<boolean> {
  const prompt = buildCursorPrompt(context);

  try {
    if (agent.editCommand) {
      // Cursor composer always opens in edit mode
      await vscode.commands.executeCommand(agent.editCommand, { initialPrompt: prompt });
      vscode.window.showInformationMessage(`🚀 Task ${context.taskId} started with ${agent.name}!`);
    }
    return true;
  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open ${agent.name}: ${e.message}`);
    return false;
  }
}

/**
 * Build prompt for GitHub Copilot (uses @workspace)
 */
function buildCopilotPrompt(context: TaskContext): string {
  const action = context.mode === 'implement' ? 'implement' : 'help with implementing';

  let prompt = `@workspace I need to ${action} this task:\n\n`;
  prompt += `**Task ID:** ${context.taskId}\n`;
  prompt += `**Title:** ${context.taskTitle}\n`;

  if (context.requirementId) {
    prompt += `**Requirement:** ${context.requirementId}\n`;
  }
  if (context.designId) {
    prompt += `**Design:** ${context.designId}\n`;
  }

  prompt += `\n**Task Details:**\n\`\`\`markdown\n${context.taskContent}\n\`\`\`\n\n`;

  if (context.mode === 'implement') {
    prompt += `**ACTION REQUIRED:**\n`;
    prompt += `1. Read the requirement and design files\n`;
    prompt += `2. Analyze the task implementation steps and acceptance criteria\n`;
    prompt += `3. Generate/modify code files to implement this task\n`;
    prompt += `4. Follow the design architecture and patterns\n\n`;
    prompt += `Please start implementing this task now.`;
  } else {
    prompt += `**HELP NEEDED:**\n`;
    prompt += `1. Review the requirement and design context\n`;
    prompt += `2. Provide step-by-step guidance for implementing this task\n`;
    prompt += `3. Suggest code examples and patterns\n`;
    prompt += `4. Help verify the acceptance criteria\n\n`;
    prompt += `What should I implement first for this task?`;
  }

  return prompt;
}

/**
 * Build prompt for Claude Code (more conversational)
 */
function buildClaudePrompt(context: TaskContext): string {
  const action = context.mode === 'implement' ? 'Implement' : 'Help me implement';

  let prompt = `${action} task ${context.taskId}: ${context.taskTitle}\n\n`;

  if (context.requirementId || context.designId) {
    prompt += `Context:\n`;
    if (context.requirementId) prompt += `- Requirement: ${context.requirementId}\n`;
    if (context.designId) prompt += `- Design: ${context.designId}\n`;
    prompt += `\n`;
  }

  prompt += `Task details:\n${context.taskContent}\n`;

  if (context.mode === 'implement') {
    prompt += `\nPlease read the requirement and design files, then implement this task following the acceptance criteria.`;
  } else {
    prompt += `\nPlease provide step-by-step guidance for implementing this task.`;
  }

  return prompt;
}

/**
 * Build prompt for Cursor Composer
 */
function buildCursorPrompt(context: TaskContext): string {
  // Cursor composer is direct and action-oriented
  let prompt = `Implement ${context.taskId}: ${context.taskTitle}\n\n`;

  if (context.requirementId || context.designId) {
    prompt += `Reference:\n`;
    if (context.requirementId) prompt += `- ${context.requirementId}\n`;
    if (context.designId) prompt += `- ${context.designId}\n`;
    prompt += `\n`;
  }

  prompt += `${context.taskContent}\n\n`;
  prompt += `Follow the acceptance criteria and implement the changes.`;

  return prompt;
}
