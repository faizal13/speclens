import * as vscode from 'vscode';
import { WorkspaceIndex, parseFrontMatter } from '../indexer';
import { selectLanguageModel, streamModelResponse, stripCodeBlocks, openCopilotChatForReview, openCopilotChatForIterativeEditing } from '../agents/copilot';
import { generateId } from './create';

export type HandleChangeFn = (uri: vscode.Uri) => Promise<void>;

export async function taskBreakdown(index: WorkspaceIndex) {
  const designId = await vscode.window.showInputBox({ prompt: 'Design ID to breakdown' });
  if (!designId) return;
  const design = index.byId.get(designId.trim());
  if (!design || design.kind !== 'design') {
    vscode.window.showErrorMessage('Design not found.');
    return;
  }
  const cfg = vscode.workspace.getConfiguration();
  const includeQuality = cfg.get<boolean>('rakdevAi.breakdown.includeQualityTasks', true);
  const maxTasks = cfg.get<number>('rakdevAi.breakdown.maxTasks', 40);
  const textDoc = await vscode.workspace.openTextDocument(design.uri);
  const text = textDoc.getText();
  const sections = extractSections(text);
  const decisions: string[] = Array.isArray(design.data.decisions) ? design.data.decisions : [];

  const tasks: string[] = [];
  decisions.forEach((d) => tasks.push(`Implementation: ${trimSentence(d)}`));

  if (sections['Risks']) {
    tasks.push('Mitigation Plan: address listed risks');
  }
  if (sections['Test Strategy']) {
    tasks.push('Test Plan: translate strategy to concrete test cases');
  }
  if (sections['Context']) {
    tasks.push('Documentation: update README / architecture references');
  }

  if (includeQuality) {
    tasks.push('Observability: metrics/logs/traces additions');
    tasks.push('Security Review: threat model / dependency scan');
    tasks.push('Performance Benchmark: baseline critical paths');
  }

  const uniq: string[] = [];
  for (const t of tasks) if (!uniq.includes(t)) uniq.push(t);

  const limited = uniq.slice(0, maxTasks);
  const content = `# Advanced Task Breakdown for ${designId}\n` + limited.map((t) => `- [ ] ${t}`).join('\n');
  const doc = await vscode.workspace.openTextDocument({ content });
  await vscode.window.showTextDocument(doc);
}

export async function generateRequirementsDoc() {
  try {
    const project = await vscode.window.showInputBox({ prompt: 'Project/Product name', placeHolder: 'Kidzilla' });
    if (!project) return;
    const intro = await vscode.window.showInputBox({ prompt: 'Introduction (leave blank to paste later)', value: '' }) || 'TBD';
    const sampleReq = await vscode.window.showQuickPick(['Yes', 'No'], { placeHolder: 'Include interactive prompts for individual requirements?' });
    let reqBlocks = '';
    if (sampleReq === 'Yes') {
      const reqCountStr = await vscode.window.showInputBox({ prompt: 'How many requirements?', value: '3' }) || '0';
      const reqCount = Math.min(50, Math.max(0, parseInt(reqCountStr, 10) || 0));
      for (let i = 1; i <= reqCount; i++) {
        const story = await vscode.window.showInputBox({ prompt: `User Story ${i} (As a ...)`, value: '' }) || 'TBD user story';
        reqBlocks += `### Requirement ${i}\n\n**User Story:** ${story}\n\n#### Acceptance Criteria\n\n1. TBD\n\n`;
      }
    } else {
      const bulk = await vscode.window.showInputBox({ prompt: 'Paste requirements block (optional)', value: '' });
      if (bulk) reqBlocks = bulk + (bulk.endsWith('\n') ? '' : '\n');
    }
    if (!reqBlocks) {
      reqBlocks = '### Requirement 1\n\n**User Story:** TBD\n\n#### Acceptance Criteria\n\n1. TBD\n';
    }
    const tpl = await readTemplate('templates/requirements-doc.tpl.md');
    const content = tpl
      .replace('{{PROJECT_NAME}}', project)
      .replace('{{INTRO}}', intro)
      .replace('{{REQUIREMENTS_BLOCK}}', reqBlocks.trimEnd());

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const slug = project.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const year = new Date().getFullYear();
    const fileName = `REQ-DOC-${year}-${Math.floor(Math.random() * 9000 + 1000)}-${slug}.md`;
    const targetDir = vscode.Uri.joinPath(ws.uri, 'docs', 'requirements');
    await vscode.workspace.fs.createDirectory(targetDir);
    const fileUri = vscode.Uri.joinPath(targetDir, fileName);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
    await vscode.window.showTextDocument(fileUri);
  } catch (e: any) {
    vscode.window.showErrorMessage(`Requirements doc generation failed: ${e.message}`);
  }
}

export async function generateDesignFromRequirement(index: WorkspaceIndex) {
  try {
    const reqId = await vscode.window.showInputBox({ prompt: 'Requirement ID (e.g., REQ-2025-1043)', placeHolder: 'REQ-YYYY-####' });
    if (!reqId) return;

    const reqEntry = index.byId.get(reqId.trim());
    if (!reqEntry || reqEntry.kind !== 'requirement') {
      vscode.window.showErrorMessage(`Requirement '${reqId}' not found. Ensure file exists in docs/requirements/.`);
      return;
    }

    const reqDoc = await vscode.workspace.openTextDocument(reqEntry.uri);
    const reqText = reqDoc.getText();

    const title = reqEntry.data.title || reqId;
    const year = new Date().getFullYear();
    const designId = `DES-${year}-${Math.floor(Math.random() * 9000 + 1000)}`;

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const designDir = vscode.Uri.joinPath(ws.uri, 'docs', 'designs');
    await vscode.workspace.fs.createDirectory(designDir);
    const designFile = vscode.Uri.joinPath(designDir, `${designId}.md`);

    const placeholder = `---
id: ${designId}
requirement: ${reqId}
status: draft
decisions: []
---
# Design: ${title}

## Overview
[Copilot will generate this section...]

## Architecture
[Copilot will generate this section...]

## Technical Decisions
[Copilot will generate this section...]

## Data Models
[Copilot will generate this section...]

## API Design
[Copilot will generate this section...]

## Security Considerations
[Copilot will generate this section...]

## Error Handling
[Copilot will generate this section...]

## Testing Strategy
[Copilot will generate this section...]

## Deployment
[Copilot will generate this section...]

`;
    await vscode.workspace.fs.writeFile(designFile, Buffer.from(placeholder, 'utf8'));

    const doc = await vscode.workspace.openTextDocument(designFile);
    const editor = await vscode.window.showTextDocument(doc);

    try {
      const model = await selectLanguageModel();

      if (model) {
        await generateDesignWithLanguageModel(model, reqText, reqId, designId, title, designFile, editor);
        await openCopilotChatForIterativeEditing(designFile, designId, reqId, reqText);
        return;
      }
    } catch (e) {
      console.log('Language Model API not available, using chat fallback');
    }

    vscode.window.showWarningMessage(
      `⚠️ Design generation requires Language Model API (Claude or GPT-4).\n\n` +
      `The API is not available in your VS Code installation.\n\n` +
      `A placeholder file has been created. You can:\n` +
      `1. Manually fill in the design sections\n` +
      `2. Install GitHub Copilot Chat extension for AI assistance\n` +
      `3. Use inline chat to get help with specific sections`,
      'View File',
      'Install Copilot Chat'
    ).then(selection => {
      if (selection === 'View File') {
        vscode.window.showTextDocument(designFile);
      } else if (selection === 'Install Copilot Chat') {
        vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
      }
    });

  } catch (e: any) {
    vscode.window.showErrorMessage(`Design generation failed: ${e.message}`);
  }
}

export async function generateTasksFromDesign(index: WorkspaceIndex, handleChange: HandleChangeFn) {
  try {
    const designId = await vscode.window.showInputBox({
      prompt: 'Design ID (e.g., DES-2025-1234)',
      placeHolder: 'DES-YYYY-####'
    });
    if (!designId) return;

    const designEntry = index.byId.get(designId.trim());
    if (!designEntry || designEntry.kind !== 'design') {
      vscode.window.showErrorMessage(`Design '${designId}' not found. Ensure file exists in docs/designs/.`);
      return;
    }

    const designDoc = await vscode.workspace.openTextDocument(designEntry.uri);
    const designText = designDoc.getText();

    const reqId = designEntry.data.requirement;
    if (!reqId) {
      vscode.window.showErrorMessage(`Design ${designId} has no linked requirement. Please add 'requirement: REQ-YYYY-####' to front-matter.`);
      return;
    }

    const reqEntry = index.byId.get(reqId);
    if (!reqEntry || reqEntry.kind !== 'requirement') {
      vscode.window.showErrorMessage(`Linked requirement '${reqId}' not found.`);
      return;
    }

    const reqDoc = await vscode.workspace.openTextDocument(reqEntry.uri);
    const reqText = reqDoc.getText();

    const reqTitle = reqEntry.data.title || reqId;
    const designTitle = designEntry.data.title || designId;

    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) return;
    const tasksDir = vscode.Uri.joinPath(ws.uri, 'docs', 'tasks');
    await vscode.workspace.fs.createDirectory(tasksDir);

    try {
      const model = await selectLanguageModel();

      if (model) {
        console.log(`[Task Generation] Using model: ${model.vendor}/${model.family}`);
        await generateTasksWithLanguageModel(model, reqText, designText, reqId, designId, reqTitle, designTitle, tasksDir, handleChange);
        return;
      } else {
        console.log('[Task Generation] No language models found');
      }
    } catch (e: any) {
      console.error('[Task Generation] Language Model API error:', e);
      vscode.window.showErrorMessage(`Task generation failed: ${e.message}`);
      return;
    }

    console.log('[Task Generation] Falling back - no models available');
    vscode.window.showWarningMessage(
      `⚠️ Task generation requires Language Model API (Claude or GPT-4).\n\n` +
      `The API is not available in your VS Code installation.\n\n` +
      `Please ensure GitHub Copilot Chat extension is installed and you have access to Claude or GPT-4 models.`,
      'Install Copilot Chat',
      'Learn More'
    ).then(selection => {
      if (selection === 'Install Copilot Chat') {
        vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
      } else if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://code.visualstudio.com/docs/copilot/copilot-chat'));
      }
    });

    const selection = await vscode.window.showInformationMessage(
      `Alternative: Manual Task Creation\n\n` +
      `You can manually create task files in: ${tasksDir.fsPath}\n\n` +
      `Each task file should follow the standard structure with:\n` +
      `- Front-matter (id, design, requirement, status, priority, estimatedHours)\n` +
      `- Task sections (Overview, Requirements, Design Reference, Implementation, Acceptance Criteria)`,
      'Open Tasks Folder',
      'Show Example',
      'Got it'
    );

    if (selection === 'Open Tasks Folder') {
      vscode.commands.executeCommand('revealInExplorer', tasksDir);
    } else if (selection === 'Show Example') {
      const example = `Example task file: docs/tasks/TASK-2025-5001-setup-architecture.md

---
id: TASK-2025-5001
design: ${designId}
requirement: ${reqId}
status: todo
priority: high
estimatedHours: 6
---

# Task: Setup Core Architecture

## Overview
[Content from Copilot Chat]

[... rest of sections ...]`;

      const panel = vscode.window.createWebviewPanel(
        'taskExample',
        'Task File Example',
        vscode.ViewColumn.Beside,
        {}
      );
      panel.webview.html = `<pre>${example}</pre>`;
    }

  } catch (e: any) {
    vscode.window.showErrorMessage(`Task generation failed: ${e.message}`);
  }
}

// --- Private helpers ---

async function readTemplate(relPath: string): Promise<string> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) throw new Error('No workspace');
  const uri = vscode.Uri.joinPath(ws.uri, relPath);
  const bytes = await vscode.workspace.fs.readFile(uri);
  return bytes.toString();
}

function extractSections(markdown: string): Record<string, string> {
  const lines = markdown.split(/\r?\n/);
  const sections: Record<string, string> = {};
  let current: string | null = null; let buf: string[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+)$/.exec(line.trim());
    if (m) {
      if (current) sections[current] = buf.join('\n').trim();
      current = m[1].trim(); buf = []; continue;
    }
    if (current) buf.push(line);
  }
  if (current) sections[current] = buf.join('\n').trim();
  return sections;
}

function trimSentence(s: string): string { return s.replace(/^[*\-\s]+/, '').replace(/\.$/, '').slice(0, 120); }

async function generateDesignWithLanguageModel(
  model: vscode.LanguageModelChat,
  reqText: string,
  reqId: string,
  designId: string,
  title: string,
  designFile: vscode.Uri,
  editor: vscode.TextEditor
) {
  const sections = [
    {
      name: 'Overview & Architecture',
      prompt: `Analyze this requirement and generate ONLY these sections:\n\n## Overview\n- Complete high-level technical approach addressing ALL requirements\n- Key technologies and architectural patterns\n- Success criteria mapped to metrics\n\n## Architecture\n- Detailed system components and responsibilities\n- Data flow and interactions (include mermaid diagrams)\n- How each component addresses specific requirements\n- Scalability and performance considerations\n\n**REQUIREMENT (${reqId}):**\n${reqText}\n\nGenerate complete, detailed content. Use mermaid diagrams. Be thorough.`
    },
    {
      name: 'Technical Decisions & Data Models',
      prompt: `Based on this requirement, generate ONLY these sections:\n\n## Technical Decisions\n- Complete technology choices with detailed rationale\n- Why each decision addresses specific requirements\n- Trade-offs and alternatives considered\n\n## Data Models\n- Complete entity definitions and schemas with examples\n- Relationships and constraints\n- How models support requirement use cases\n\n**REQUIREMENT (${reqId}):**\n${reqText}\n\nGenerate complete, detailed content with code examples.`
    },
    {
      name: 'API Design & Security',
      prompt: `Based on this requirement, generate ONLY these sections:\n\n## API Design\n- All endpoints needed for requirements\n- Complete request/response formats with examples\n- Authentication and authorization approach\n\n## Security Considerations\n- Auth mechanisms addressing requirement risks\n- Data protection strategies\n- Security measures for each risk identified\n\n**REQUIREMENT (${reqId}):**\n${reqText}\n\nGenerate complete, detailed content with code examples.`
    },
    {
      name: 'Error Handling, Testing & Deployment',
      prompt: `Based on this requirement, generate ONLY these sections:\n\n## Error Handling\n- All error scenarios from requirements\n- Graceful degradation strategies\n- User feedback mechanisms\n\n## Testing Strategy\n- How to verify each acceptance criterion\n- Unit, integration, and E2E test approach\n- Performance testing for metrics\n\n## Deployment & Operations\n- Infrastructure requirements\n- CI/CD pipeline\n- Monitoring for requirement metrics\n- Rollback strategies\n\n**REQUIREMENT (${reqId}):**\n${reqText}\n\nGenerate complete, detailed content.`
    }
  ];

  let fullContent = '';

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Generating design ${designId}...`,
    cancellable: false
  }, async (progress) => {
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      progress.report({
        message: `Generating ${section.name} (${i + 1}/${sections.length})...`,
        increment: (100 / sections.length)
      });

      const sectionContent = await streamModelResponse(model, section.prompt, 'Generating design document section');
      fullContent += '\n\n' + stripCodeBlocks(sectionContent);

      progress.report({
        message: `Completed ${section.name} (${fullContent.length} chars)`
      });
    }
  });

  const generatedContent = fullContent.trim();

  if (generatedContent) {
    const doc = editor.document;
    const text = doc.getText();
    const fmMatch = /^---\n[\s\S]*?\n---\n/m.exec(text);

    let newContent;
    if (fmMatch) {
      newContent = fmMatch[0] + '\n# Design: ' + title + '\n\n' + generatedContent;
    } else {
      newContent = `---\nid: ${designId}\nrequirement: ${reqId}\nstatus: draft\ndecisions: []\n---\n\n# Design: ${title}\n\n${generatedContent}`;
    }

    const edit = new vscode.WorkspaceEdit();
    edit.replace(designFile, new vscode.Range(0, 0, doc.lineCount, 0), newContent);
    await vscode.workspace.applyEdit(edit);
    await doc.save();

    const action = await vscode.window.showInformationMessage(
      `✅ Design ${designId} generated successfully! (${generatedContent.length} characters)`,
      'View File',
      'Review with Copilot'
    );

    if (action === 'View File') {
      await vscode.window.showTextDocument(designFile);
    } else if (action === 'Review with Copilot') {
      await openCopilotChatForReview(designFile, designId, reqId, generatedContent);
    }
  }
}

async function generateTasksWithLanguageModel(
  model: vscode.LanguageModelChat,
  reqText: string,
  designText: string,
  reqId: string,
  designId: string,
  _reqTitle: string,
  designTitle: string,
  tasksDir: vscode.Uri,
  handleChange: HandleChangeFn
) {
  const year = new Date().getFullYear();
  const taskDocId = `TASK-DOC-${year}-${Math.floor(Math.random() * 9000 + 1000)}`;
  const taskFile = vscode.Uri.joinPath(tasksDir, `${taskDocId}-${designId}-tasks.md`);

  const taskPrompt = `Generate a comprehensive task breakdown document for implementing this design.

**REQUIREMENT (${reqId}):**
${reqText}

**DESIGN (${designId}):**
${designText}

**INSTRUCTIONS:**
Create a complete task breakdown document with:

1. **Front-matter** (YAML):
   - id: ${taskDocId}
   - design: ${designId}
   - requirement: ${reqId}
   - status: draft

2. **# Task Breakdown: ${designTitle}** (main heading)

3. **## Overview**
   - Summary of what needs to be implemented
   - Link to requirement and design
   - Total estimated effort

4. **## Implementation Tasks** (organize as sections and subsections)

   For each major area (5-8 tasks total), create:

   ### Task N: [Task Title] (Priority: high/medium/low | Est: Xh)

   **Requirements Coverage:**
   - Quote specific parts from ${reqId}

   **Design Reference:**
   - Reference specific design decisions from ${designId}

   **Implementation Steps:**
   1. Detailed step with code examples
   2. Next step with specifics
   3. Continue with thorough guidance

   **Acceptance Criteria:**
   - [ ] Specific, testable criterion 1
   - [ ] Specific, testable criterion 2
   - [ ] Specific, testable criterion 3

   **Dependencies:** List any task dependencies

   ---

5. **## Task Summary**
   - Table or list of all tasks with ID, priority, estimate
   - Recommended implementation order

6. **## Testing Strategy**
   - How to test each task
   - Integration testing approach

7. **## Notes**
   - Additional considerations
   - Risks or gotchas

**FORMAT:**
Output ONLY the markdown content (including front-matter).
Be thorough and detailed - this is production-ready documentation.
Include code examples and specific technical guidance for each task.`;

  let generatedContent = '';

  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: `Generating task breakdown for ${designId}...`,
    cancellable: false
  }, async (progress) => {
    console.log('[Task Generation] Sending prompt to AI...');
    progress.report({ message: 'Sending request to AI model...' });

    generatedContent = await streamModelResponse(model, taskPrompt, 'Generating task breakdown document');

    console.log('[Task Generation] AI response received, length:', generatedContent.length);
  });

  if (!generatedContent || generatedContent.length < 100) {
    vscode.window.showErrorMessage('Failed to generate task breakdown. No content generated.');
    return;
  }

  generatedContent = stripCodeBlocks(generatedContent);

  console.log(`[Task Generation] Writing task file: ${taskFile.fsPath}`);
  await vscode.workspace.fs.writeFile(taskFile, Buffer.from(generatedContent, 'utf8'));

  await handleChange(taskFile);

  console.log(`[Task Generation] Task breakdown written successfully`);

  const selection = await vscode.window.showInformationMessage(
    `✅ Task breakdown generated successfully! (${generatedContent.length} characters)`,
    'View File',
    'Review with Copilot',
    'Open Tasks Folder'
  );

  if (selection === 'View File') {
    await vscode.window.showTextDocument(taskFile);
  } else if (selection === 'Review with Copilot') {
    await openCopilotChatForReview(taskFile, taskDocId, reqId, generatedContent);
  } else if (selection === 'Open Tasks Folder') {
    vscode.commands.executeCommand('revealInExplorer', tasksDir);
  }
}
