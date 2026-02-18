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
 * Uses actual command existence checks (not just extension presence)
 */
export async function detectAvailableAgents(): Promise<AgentCapabilities[]> {
  const agents: AgentCapabilities[] = [];
  const allCommands = await vscode.commands.getCommands();

  // --- GitHub Copilot Chat ---
  // Check extension AND verify at least the chat command exists
  const copilotExt = vscode.extensions.getExtension("GitHub.copilot-chat");
  if (copilotExt) {
    // Try the newer inline chat command, then fall back to panel chat
    const editCmd = [
      "workbench.action.chat.openEditSession",  // Copilot Edit (newer)
      "github.copilot.chat.focus",               // Focus chat panel
    ].find(cmd => allCommands.includes(cmd));

    const chatCmd = [
      "workbench.action.chat.open",              // Panel chat (common)
      "github.copilot.chat.focus",               // Focus existing panel
    ].find(cmd => allCommands.includes(cmd));

    agents.push({
      type: "copilot",
      available: true,
      chatCommand: chatCmd,
      editCommand: editCmd,
      name: "GitHub Copilot",
    });
  }

  // --- Claude Code ---
  const claudeChatCmd = ["claude.chat", "claude.openChat"].find(cmd => allCommands.includes(cmd));
  const claudeEditCmd = ["claude.edit"].find(cmd => allCommands.includes(cmd));
  if (claudeChatCmd || claudeEditCmd) {
    agents.push({
      type: "claude",
      available: true,
      chatCommand: claudeChatCmd,
      editCommand: claudeEditCmd,
      name: "Claude Code",
    });
  }

  // --- Cursor Composer ---
  const cursorCmd = [
    "composer.startComposerEdit",
    "aipopup.action.modal.generate",
  ].find(cmd => allCommands.includes(cmd));
  if (cursorCmd) {
    agents.push({
      type: "cursor",
      available: true,
      editCommand: cursorCmd,
      name: "Cursor Composer",
    });
  }

  return agents;
}

/**
 * Get the preferred agent based on user config or auto-detection
 */
export async function getPreferredAgent(): Promise<AgentCapabilities | undefined> {
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

  return available.find((a) => a.type === preferredType);
}
