import * as vscode from 'vscode';
import { routeTaskToAgent } from '../agents/router';

/**
 * Elaborate rough BA notes into a formal spec.md using AI
 *
 * This command helps BAs who know requirements at a high level but struggle
 * to document them formally. The AI agent asks clarifying questions and
 * generates a properly structured spec.md following GitHub Spec Kit format.
 */
export async function elaborateSpec(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Step 1: Get rough BA notes
  const roughNotes = await vscode.window.showInputBox({
    prompt: 'Paste rough BA notes or describe the requirement at a high level',
    placeHolder: 'e.g., "We need user login with email and password, maybe social login too"',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length < 10) {
        return 'Please provide at least a brief description (10+ characters)';
      }
      return undefined;
    }
  });

  if (!roughNotes) {
    return; // User cancelled
  }

  // Step 2: Get feature/branch name for the spec
  const featureName = await vscode.window.showInputBox({
    prompt: 'Enter a short feature name (will be used for folder name)',
    placeHolder: 'e.g., user-authentication',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || !/^[a-z0-9-]+$/.test(value)) {
        return 'Use lowercase letters, numbers, and dashes only';
      }
      return undefined;
    }
  });

  if (!featureName) {
    return; // User cancelled
  }

  // Step 3: Check if specs folder exists, create if not
  const specsUri = vscode.Uri.joinPath(ws.uri, 'specs');
  try {
    await vscode.workspace.fs.stat(specsUri);
  } catch {
    await vscode.workspace.fs.createDirectory(specsUri);
  }

  // Step 4: Create feature folder
  const featureUri = vscode.Uri.joinPath(specsUri, featureName);
  try {
    await vscode.workspace.fs.stat(featureUri);
    const overwrite = await vscode.window.showWarningMessage(
      `Feature "${featureName}" already exists. Overwrite spec.md?`,
      'Yes', 'No'
    );
    if (overwrite !== 'Yes') {
      return;
    }
  } catch {
    await vscode.workspace.fs.createDirectory(featureUri);
  }

  // Step 5: Create spec.md path
  const specUri = vscode.Uri.joinPath(featureUri, 'spec.md');

  // Step 6: Build AI prompt for spec elaboration
  const prompt = buildElaborationPrompt(roughNotes, featureName);

  // Step 7: Show progress and open the AI agent
  vscode.window.showInformationMessage(
    `🤖 Starting spec elaboration for "${featureName}"...`
  );

  // Step 8: Route to AI agent (Copilot/Claude/Cursor)
  // Note: We use a simplified task context since this is spec creation, not task execution
  const success = await routeToAgent(prompt);

  if (success) {
    vscode.window.showInformationMessage(
      `✅ AI agent opened! Review the generated spec and save it to:\n${specUri.fsPath}`
    );
  }
}

/**
 * Build the AI prompt for spec elaboration
 */
function buildElaborationPrompt(roughNotes: string, featureName: string): string {
  return `You are a Business Analyst assistant helping to create a formal specification from rough notes.

**CONTEXT:**
A BA has provided rough, high-level notes about a requirement. Your job is to:
1. Analyze the rough notes
2. Ask clarifying questions if needed (about scope, users, success metrics, edge cases, constraints)
3. Generate a formal spec.md following GitHub Spec Kit format

**ROUGH BA NOTES:**
${roughNotes}

**FEATURE NAME:** ${featureName}

**YOUR TASK:**
Create a comprehensive spec.md following this structure:

\`\`\`markdown
# ${featureName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

## Overview
[2-3 sentences describing what this feature is and why it's needed]

## Goals
- [Primary goal]
- [Secondary goal]
- [Additional goals]

## User Stories
- As a [user type], I want to [action] so that [benefit]
- As a [user type], I want to [action] so that [benefit]

## Success Metrics
- [Measurable metric, e.g., "90% of users complete login within 30 seconds"]
- [Business metric, e.g., "Reduce support tickets by 50%"]

## Technical Requirements
### Functional Requirements
- [What the system must do]
- [What the system must do]

### Non-Functional Requirements
- Performance: [expectations]
- Security: [requirements]
- Scalability: [needs]

### Constraints
- [Technical constraints]
- [Business constraints]
- [Timeline constraints]

## Out of Scope
- [What is explicitly NOT included]
- [What is explicitly NOT included]

## Open Questions
- [Questions that need answers before implementation]
\`\`\`

**IMPORTANT GUIDELINES:**
1. If the rough notes are vague, ask 2-3 clarifying questions first (in chat)
2. Infer reasonable defaults based on industry best practices
3. Focus on WHAT needs to be built, not HOW (that's for plan.md)
4. Be specific with success metrics (use numbers/percentages where possible)
5. Include security and performance considerations
6. List what's out of scope to avoid scope creep

**OUTPUT:**
Generate the spec.md content. The BA will review, iterate, and save it.`;
}

/**
 * Route to the preferred AI agent with the elaboration prompt
 */
async function routeToAgent(prompt: string): Promise<boolean> {
  try {
    // Get the configured agent
    const config = vscode.workspace.getConfiguration('speclens');
    const preferredAgent = config.get<string>('preferredAgent', 'auto');

    // Try to execute chat/edit command directly with the prompt
    // Detection logic borrowed from agents/detector.ts
    if (preferredAgent === 'copilot' || preferredAgent === 'auto') {
      const copilotExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
      if (copilotExtension) {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt });
        return true;
      }
    }

    if (preferredAgent === 'claude' || preferredAgent === 'auto') {
      const commands = await vscode.commands.getCommands();
      if (commands.includes('claude.chat')) {
        await vscode.commands.executeCommand('claude.chat', prompt);
        return true;
      }
    }

    if (preferredAgent === 'cursor' || preferredAgent === 'auto') {
      const commands = await vscode.commands.getCommands();
      if (commands.includes('composer.startComposerEdit')) {
        await vscode.commands.executeCommand('composer.startComposerEdit', { initialPrompt: prompt });
        return true;
      }
    }

    // Fallback: no agent detected
    vscode.window.showWarningMessage(
      'No AI coding agent detected. Please install GitHub Copilot, Claude Code, or Cursor.',
      'Learn More'
    ).then(selection => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/faizal13/speclens#agent-support'));
      }
    });
    return false;

  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open AI agent: ${e.message}`);
    return false;
  }
}
