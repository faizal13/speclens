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
 * Route a task to the appropriate AI agent.
 *
 * Strategy (most reliable across all agent versions):
 * 1. Build the prompt
 * 2. Copy it to clipboard
 * 3. Try to open the agent's chat/edit panel
 * 4. Show a notification telling user the prompt is ready to paste
 *
 * This ensures the task context always reaches the agent even if
 * auto-injection APIs differ across versions.
 */
export async function routeTaskToAgent(context: TaskContext): Promise<boolean> {
  const agent = await getPreferredAgent();

  if (!agent) {
    vscode.window.showWarningMessage(
      'No AI coding agent detected (Copilot, Claude Code, or Cursor).',
      'Install Copilot'
    ).then(sel => {
      if (sel === 'Install Copilot') {
        vscode.env.openExternal(vscode.Uri.parse('https://marketplace.visualstudio.com/items?itemName=GitHub.copilot-chat'));
      }
    });
    return false;
  }

  const prompt = buildPrompt(context);

  // Always copy to clipboard first — this is the guaranteed fallback
  await vscode.env.clipboard.writeText(prompt);

  // Try to open the agent panel and inject the prompt
  const opened = await tryOpenAgentPanel(agent, prompt);

  if (opened) {
    vscode.window.showInformationMessage(
      `🤖 ${agent.name} opened for ${context.taskId}. Prompt copied to clipboard — paste if it didn't auto-fill.`,
      'OK'
    );
  } else {
    // Panel couldn't be opened programmatically — guide user manually
    vscode.window.showInformationMessage(
      `📋 Task prompt copied to clipboard! Open ${agent.name} chat and paste (Cmd+V / Ctrl+V).`,
      'Open Chat'
    ).then(async sel => {
      if (sel === 'Open Chat') {
        // Try generic chat commands as last resort
        for (const cmd of [
          'workbench.action.chat.open',
          'github.copilot.chat.focus',
          'claude.chat',
          'workbench.panel.chat.view.copilot.focus',
        ]) {
          try {
            await vscode.commands.executeCommand(cmd);
            break;
          } catch { /* try next */ }
        }
      }
    });
  }

  return true;
}

/**
 * Try to open the agent panel and inject the prompt.
 * Returns true if successfully opened, false if all attempts failed.
 */
async function tryOpenAgentPanel(agent: AgentCapabilities, prompt: string): Promise<boolean> {

  // Commands to try in order, with their argument shapes
  const attempts: Array<() => Thenable<unknown>> = [];

  switch (agent.type) {
    case 'copilot':
      attempts.push(
        // Copilot Edit mode (VS Code 1.93+)
        () => vscode.commands.executeCommand('workbench.action.chat.openEditSession', { query: prompt }),
        // Copilot Chat panel with query
        () => vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt }),
        // Copilot Chat panel without query (just open)
        () => vscode.commands.executeCommand('workbench.action.chat.open'),
        // Focus existing chat panel
        () => vscode.commands.executeCommand('github.copilot.chat.focus'),
        // Generic workbench chat
        () => vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus'),
      );
      break;

    case 'claude':
      attempts.push(
        () => vscode.commands.executeCommand('claude.edit', prompt),
        () => vscode.commands.executeCommand('claude.chat', prompt),
        () => vscode.commands.executeCommand('claude.openChat', prompt),
      );
      break;

    case 'cursor':
      attempts.push(
        () => vscode.commands.executeCommand('composer.startComposerEdit', { initialPrompt: prompt }),
        () => vscode.commands.executeCommand('aipopup.action.modal.generate', { what: prompt }),
        () => vscode.commands.executeCommand('composer.startComposerEdit'),
      );
      break;
  }

  for (const attempt of attempts) {
    try {
      await attempt();
      return true; // First success wins
    } catch (e: any) {
      // Command not found or wrong args — try next
      console.log(`[SpecLens] Agent command failed: ${e.message}`);
    }
  }

  return false; // All attempts exhausted
}

/**
 * Build the task prompt — same format regardless of agent
 */
function buildPrompt(context: TaskContext): string {
  const featureName = context.requirementId?.replace('spec-', '') ?? 'this feature';
  const action = context.mode === 'implement'
    ? `Implement the following task for ${featureName}`
    : `Help me implement the following task for ${featureName}`;

  let prompt = `${action}:\n\n`;
  prompt += `**Task:** ${context.taskId} — ${context.taskTitle}\n\n`;
  prompt += `---\n\n`;
  prompt += context.taskContent;
  prompt += `\n\n---\n\n`;

  if (context.mode === 'implement') {
    prompt += `Please implement this task step by step, following the acceptance criteria above.`;
  } else {
    prompt += `Please provide step-by-step guidance for implementing this task and help me verify the acceptance criteria.`;
  }

  return prompt;
}
