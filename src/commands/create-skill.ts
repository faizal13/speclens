import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Create an everything-copilot skill from spec/plan/tasks
 *
 * This embeds the spec as an auto-loading AI skill that activates
 * when developers work on files related to the feature.
 */
export async function createSkillFromSpec(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Step 1: Find all spec.md files
  const specFiles = await vscode.workspace.findFiles('specs/*/spec.md');

  if (specFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No spec.md files found. Create a spec first.'
    );
    return;
  }

  // Step 2: Let user select which spec to create skill from
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
      placeHolder: 'Select a spec to create skill from',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedSpecUri = selected.uri;
  }

  // Step 3: Get feature name and folder
  const featureFolder = path.dirname(selectedSpecUri.fsPath);
  const featureName = path.basename(featureFolder);

  // Step 4: Ask for file pattern trigger
  const defaultPattern = `src/**/*${featureName}*`;
  const triggerPattern = await vscode.window.showInputBox({
    prompt: 'When should this skill load? (glob pattern for files)',
    placeHolder: 'e.g., src/auth/** or src/**/*user-auth*',
    value: defaultPattern,
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length === 0) {
        return 'Please provide a file pattern';
      }
      return undefined;
    }
  });

  if (!triggerPattern) {
    return; // User cancelled
  }

  // Step 5: Check if everything-copilot is installed
  const agentsDir = vscode.Uri.joinPath(ws.uri, '.copilot-agents');
  let hasEverythingCopilot = false;
  try {
    await vscode.workspace.fs.stat(agentsDir);
    hasEverythingCopilot = true;
  } catch {
    // Not installed
  }

  if (!hasEverythingCopilot) {
    const install = await vscode.window.showWarningMessage(
      'everything-copilot is not installed. Install it to create auto-loading skills.',
      'Install Now',
      'Cancel'
    );

    if (install === 'Install Now') {
      const terminal = vscode.window.createTerminal('everything-copilot');
      terminal.show();
      terminal.sendText('npx everything-copilot init');

      vscode.window.showInformationMessage(
        'After installation completes, run this command again to create the skill.'
      );
    }
    return;
  }

  // Step 6: Build skill content
  const skillContent = await buildSkillContent(featureFolder, featureName);

  // Step 7: Create skill file in .copilot-agents/skills/
  const skillsDir = vscode.Uri.joinPath(agentsDir, 'skills');
  try {
    await vscode.workspace.fs.createDirectory(skillsDir);
  } catch {
    // Directory already exists
  }

  const skillFileName = `spec-${featureName}.md`;
  const skillUri = vscode.Uri.joinPath(skillsDir, skillFileName);

  await vscode.workspace.fs.writeFile(
    skillUri,
    Buffer.from(skillContent, 'utf8')
  );

  // Step 8: Add trigger to .copilot-agents/config.json
  await addSkillTrigger(agentsDir, skillFileName, triggerPattern);

  // Step 9: Show success message
  vscode.window.showInformationMessage(
    `✅ Skill created! Spec will auto-load when editing files matching: ${triggerPattern}\n\n` +
    `Skill file: ${skillUri.fsPath}\n\n` +
    `Try editing a file in ${triggerPattern} and ask Copilot a question - it will have the spec context!`
  );

  // Step 10: Ask if user wants to open skill file
  const openSkill = await vscode.window.showInformationMessage(
    'Do you want to view the skill file?',
    'Yes', 'No'
  );

  if (openSkill === 'Yes') {
    const doc = await vscode.workspace.openTextDocument(skillUri);
    await vscode.window.showTextDocument(doc);
  }
}

/**
 * Build skill content from spec.md, plan.md, tasks.md
 */
async function buildSkillContent(featureFolder: string, featureName: string): Promise<string> {
  let content = `# Spec Skill: ${featureName}\n\n`;
  content += `This skill provides context about the ${featureName} feature.\n`;
  content += `It auto-loads when you edit files related to this feature.\n\n`;
  content += `---\n\n`;

  // Read spec.md
  try {
    const specUri = vscode.Uri.file(path.join(featureFolder, 'spec.md'));
    const specContent = await vscode.workspace.fs.readFile(specUri);
    const specText = Buffer.from(specContent).toString('utf8');

    content += `## Specification (spec.md)\n\n`;
    content += `${specText}\n\n`;
    content += `---\n\n`;
  } catch {
    // spec.md not found
  }

  // Read plan.md
  try {
    const planUri = vscode.Uri.file(path.join(featureFolder, 'plan.md'));
    const planContent = await vscode.workspace.fs.readFile(planUri);
    const planText = Buffer.from(planContent).toString('utf8');

    content += `## Implementation Plan (plan.md)\n\n`;
    content += `${planText}\n\n`;
    content += `---\n\n`;
  } catch {
    // plan.md not found
  }

  // Read tasks.md summary (not full content, too long)
  try {
    const tasksUri = vscode.Uri.file(path.join(featureFolder, 'tasks.md'));
    const tasksContent = await vscode.workspace.fs.readFile(tasksUri);
    const tasksText = Buffer.from(tasksContent).toString('utf8');

    // Extract just task titles
    const taskTitles = tasksText.match(/^## Task \d+: (.+)$/gm) || [];

    content += `## Tasks (tasks.md summary)\n\n`;
    content += `**Task List:**\n`;
    for (const title of taskTitles) {
      content += `- ${title}\n`;
    }
    content += `\n`;
    content += `For full task details, see: \`specs/${featureName}/tasks.md\`\n\n`;
  } catch {
    // tasks.md not found
  }

  content += `## Usage Instructions\n\n`;
  content += `When working on this feature:\n`;
  content += `1. This skill automatically provides spec/plan context to AI\n`;
  content += `2. Ask Copilot questions like:\n`;
  content += `   - "What are the acceptance criteria for this task?"\n`;
  content += `   - "What's the API contract for this endpoint?"\n`;
  content += `   - "What security requirements apply here?"\n`;
  content += `3. AI responses will align with the approved spec/plan\n`;
  content += `4. Prevents implementation drift from requirements\n`;

  return content;
}

/**
 * Add skill trigger to .copilot-agents/config.json
 */
async function addSkillTrigger(
  agentsDir: vscode.Uri,
  skillFileName: string,
  triggerPattern: string
): Promise<void> {
  const configUri = vscode.Uri.joinPath(agentsDir, 'config.json');

  let config: any = {
    skills: {}
  };

  // Read existing config
  try {
    const configContent = await vscode.workspace.fs.readFile(configUri);
    const configText = Buffer.from(configContent).toString('utf8');
    config = JSON.parse(configText);
  } catch {
    // Config doesn't exist, use default
  }

  // Add skill trigger
  if (!config.skills) {
    config.skills = {};
  }

  const skillId = skillFileName.replace('.md', '');
  config.skills[skillId] = {
    file: `skills/${skillFileName}`,
    trigger: triggerPattern,
    description: `Auto-loads spec context when editing ${triggerPattern}`
  };

  // Write config back
  await vscode.workspace.fs.writeFile(
    configUri,
    Buffer.from(JSON.stringify(config, null, 2), 'utf8')
  );
}
