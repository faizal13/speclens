import * as vscode from 'vscode';
import * as path from 'path';
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

  // Step 2: Ask if this is for a microservice
  const isMicroservice = await vscode.window.showQuickPick([
    { label: 'Microservice Feature', description: 'Feature for a specific microservice (has APIs, events, dependencies)', value: true },
    { label: 'Monolith/General Feature', description: 'Regular feature in a monolithic app', value: false }
  ], {
    placeHolder: 'Is this feature for a microservice?',
    ignoreFocusOut: true
  });

  if (!isMicroservice) {
    return; // User cancelled
  }

  let serviceName = '';
  if (isMicroservice.value) {
    // Step 2a: Get microservice name
    serviceName = await vscode.window.showInputBox({
      prompt: 'Enter microservice name (e.g., payment-service, user-service)',
      placeHolder: 'e.g., payment-service',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || !/^[a-z0-9-]+$/.test(value)) {
          return 'Use lowercase letters, numbers, and dashes only';
        }
        return undefined;
      }
    }) || '';

    if (!serviceName) {
      return; // User cancelled
    }
  }

  // Step 3: Get feature/branch name for the spec
  const featureName = await vscode.window.showInputBox({
    prompt: `Enter a short feature name ${isMicroservice.value ? `for ${serviceName}` : ''}`,
    placeHolder: isMicroservice.value ? `e.g., ${serviceName}-stripe-integration` : 'e.g., user-authentication',
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

  // Step 4: Check if specs folder exists, create if not
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

  // Step 5: Ask if user wants to attach context documents
  const attachContext = await vscode.window.showQuickPick([
    { label: 'Yes', description: 'Attach existing docs (architecture, schemas, APIs, etc.)', value: true },
    { label: 'No', description: 'Just use rough notes', value: false }
  ], {
    placeHolder: 'Do you have additional context documents? (architecture diagrams, schemas, etc.)',
    ignoreFocusOut: true
  });

  let contextFiles: vscode.Uri[] = [];
  if (attachContext && attachContext.value) {
    // Step 5a: File picker for context documents
    const selectedFiles = await vscode.window.showOpenDialog({
      canSelectMany: true,
      canSelectFiles: true,
      canSelectFolders: false,
      openLabel: 'Attach Context',
      title: 'Select context documents (PDFs, diagrams, schemas, docs)',
      filters: {
        'Documents': ['pdf', 'md', 'txt', 'json', 'yaml', 'yml', 'sql'],
        'Images': ['png', 'jpg', 'jpeg', 'svg', 'gif'],
        'Code': ['ts', 'js', 'py', 'go', 'java', 'prisma'],
        'All': ['*']
      }
    });

    if (selectedFiles && selectedFiles.length > 0) {
      contextFiles = selectedFiles;

      // Step 5b: Create context/ subfolder and copy files there
      const contextUri = vscode.Uri.joinPath(featureUri, 'context');
      await vscode.workspace.fs.createDirectory(contextUri);

      for (const file of contextFiles) {
        const fileName = path.basename(file.fsPath);
        const destUri = vscode.Uri.joinPath(contextUri, fileName);
        await vscode.workspace.fs.copy(file, destUri, { overwrite: true });
      }

      vscode.window.showInformationMessage(
        `📎 ${contextFiles.length} context file(s) copied to specs/${featureName}/context/`
      );
    }
  }

  // Step 6: Create spec.md path
  const specUri = vscode.Uri.joinPath(featureUri, 'spec.md');

  // Step 7: Build AI prompt for spec elaboration (with context if provided)
  const prompt = await buildElaborationPrompt(roughNotes, featureName, contextFiles, isMicroservice.value, serviceName);

  // Step 8: Show progress and open the AI agent
  vscode.window.showInformationMessage(
    `🤖 Starting spec elaboration for "${featureName}"${contextFiles.length > 0 ? ` with ${contextFiles.length} context docs` : ''}...`
  );

  // Step 9: Route to AI agent (Copilot/Claude/Cursor)
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
async function buildElaborationPrompt(
  roughNotes: string,
  featureName: string,
  contextFiles: vscode.Uri[] = [],
  isMicroservice: boolean = false,
  serviceName: string = ''
): Promise<string> {
  // Read context files if provided
  let contextSection = '';
  if (contextFiles.length > 0) {
    contextSection = '\n\n**ADDITIONAL CONTEXT DOCUMENTS:**\n';
    contextSection += 'The BA has provided the following context documents. Use them to understand existing architecture, constraints, and patterns:\n\n';

    for (const fileUri of contextFiles) {
      const fileName = path.basename(fileUri.fsPath);
      const fileExtension = path.extname(fileUri.fsPath).toLowerCase();

      try {
        // Read file content
        const content = await vscode.workspace.fs.readFile(fileUri);
        const textContent = Buffer.from(content).toString('utf8');

        // Truncate if too large (max 2000 chars per file)
        const truncated = textContent.length > 2000
          ? textContent.substring(0, 2000) + '\n\n[... truncated, file too large ...]'
          : textContent;

        contextSection += `--- ${fileName} ---\n`;

        // Add context based on file type
        if (['.json', '.yaml', '.yml'].includes(fileExtension)) {
          contextSection += `(API schema/config)\n\`\`\`${fileExtension.slice(1)}\n${truncated}\n\`\`\`\n\n`;
        } else if (['.sql', '.prisma'].includes(fileExtension)) {
          contextSection += `(Database schema)\n\`\`\`sql\n${truncated}\n\`\`\`\n\n`;
        } else if (['.md', '.txt'].includes(fileExtension)) {
          contextSection += `${truncated}\n\n`;
        } else if (['.ts', '.js', '.py', '.go', '.java'].includes(fileExtension)) {
          contextSection += `(Code reference)\n\`\`\`${fileExtension.slice(1)}\n${truncated}\n\`\`\`\n\n`;
        } else if (['.png', '.jpg', '.jpeg', '.svg', '.gif'].includes(fileExtension)) {
          contextSection += `(Image: ${fileName} - architecture diagram or UI mockup)\n\n`;
        } else {
          contextSection += `${truncated}\n\n`;
        }
      } catch (e) {
        contextSection += `(Unable to read file: ${fileName})\n\n`;
      }
    }

    contextSection += '**IMPORTANT:** Use the context documents to:\n';
    contextSection += '- Align with existing architecture patterns\n';
    contextSection += '- Respect current database schema\n';
    contextSection += '- Follow existing API conventions\n';
    contextSection += '- Identify integration points with existing systems\n';
    contextSection += '- Avoid reinventing what already exists\n\n';
  }

  return `You are a Business Analyst assistant helping to create a formal specification from rough notes.

**CONTEXT:**
A BA has provided rough, high-level notes about a requirement. Your job is to:
1. Analyze the rough notes
2. Ask clarifying questions if needed (about scope, users, success metrics, edge cases, constraints)
3. Generate a formal spec.md following GitHub Spec Kit format

**ROUGH BA NOTES:**
${roughNotes}

**FEATURE NAME:** ${featureName}
${contextSection}

**YOUR TASK:**
Create a comprehensive spec.md following this structure:

\`\`\`markdown
# ${featureName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

${isMicroservice ? `## Service Context
**Service:** ${serviceName}
**Type:** Microservice feature
**Responsibility:** [What is this service responsible for in the overall system]

## Service Dependencies
### Upstream Services (this service depends on)
- [Service Name]: [Why/what data/APIs we consume]

### Downstream Services (depend on this service)
- [Service Name]: [What they consume from us]

### External Dependencies
- [Third-party API, e.g., Stripe, SendGrid]

` : ''}## Overview
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

${isMicroservice ? `### API Contract
**New Endpoints:**
| Method | Path | Description | Auth | Request | Response |
|--------|------|-------------|------|---------|----------|
| POST | /api/resource | Create resource | Required | \`CreateResourceRequest\` | \`ResourceResponse\` |
| GET | /api/resource/:id | Get resource | Required | - | \`ResourceResponse\` |

**Request/Response Types:**
\`\`\`typescript
interface CreateResourceRequest {
  name: string;
  // ...
}

interface ResourceResponse {
  id: string;
  name: string;
  createdAt: string;
}
\`\`\`

### Events Published
- \`resource.created\`: Published when resource is created
  \`\`\`json
  {
    "eventType": "resource.created",
    "resourceId": "uuid",
    "timestamp": "2024-01-15T10:30:00Z"
  }
  \`\`\`

### Events Consumed
- \`other-service.event\`: What we do when we receive this event

` : ''}### Constraints
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
