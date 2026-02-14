import * as vscode from "vscode";

export type AgentType = "copilot" | "claude" | "cursor" | "none" | "auto";

export interface AgentCapabilities {
  type: AgentType;
  available: boolean;
  chatCommand?: string;
  editCommand?: string;
  name: string;
}

/**
 * Detect all available AI coding agents in the current VS Code environment
 */
export async function detectAvailableAgents(): Promise<AgentCapabilities[]> {
  const agents: AgentCapabilities[] = [];

  // Detect GitHub Copilot Chat
  const copilotExtension = vscode.extensions.getExtension(
    "GitHub.copilot-chat",
  );
  if (copilotExtension) {
    agents.push({
      type: "copilot",
      available: true,
      chatCommand: "workbench.action.chat.open",
      editCommand: "workbench.action.chat.openEditSession",
      name: "GitHub Copilot",
    });
  }

  // Detect Claude Code (check for claude command in VS Code)
  // Claude Code uses 'claude.chat' and 'claude.edit' commands
  const claudeAvailable = await checkCommandExists("claude.chat");
  if (claudeAvailable) {
    agents.push({
      type: "claude",
      available: true,
      chatCommand: "claude.chat",
      editCommand: "claude.edit",
      name: "Claude Code",
    });
  }

  // Detect Cursor composer
  // Cursor uses 'composer.startComposerEdit' command
  const cursorAvailable = await checkCommandExists(
    "composer.startComposerEdit",
  );
  if (cursorAvailable) {
    agents.push({
      type: "cursor",
      available: true,
      editCommand: "composer.startComposerEdit",
      name: "Cursor Composer",
    });
  }

  return agents;
}

/**
 * Get the preferred agent based on user config or auto-detection
 */
export async function getPreferredAgent(): Promise<
  AgentCapabilities | undefined
> {
  const config = vscode.workspace.getConfiguration("speclens");
  const preferredType = config.get<AgentType>("preferredAgent", "auto");

  const available = await detectAvailableAgents();

  if (preferredType === "auto" || preferredType === "none") {
    // Auto-select: Claude > Copilot > Cursor
    return (
      available.find((a) => a.type === "claude") ||
      available.find((a) => a.type === "copilot") ||
      available.find((a) => a.type === "cursor")
    );
  }

  // User has explicit preference
  return available.find((a) => a.type === preferredType);
}

/**
 * Check if a VS Code command exists
 */
async function checkCommandExists(commandId: string): Promise<boolean> {
  try {
    const commands = await vscode.commands.getCommands();
    return commands.includes(commandId);
  } catch {
    return false;
  }
}
