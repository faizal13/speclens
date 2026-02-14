import * as vscode from 'vscode';

export async function selectLanguageModel(): Promise<vscode.LanguageModelChat | undefined> {
  // Try Claude Sonnet 4 first (latest and best for technical content)
  let models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-sonnet-4' });

  // Fallback to Claude Sonnet 3.5
  if (!models || models.length === 0) {
    models = await vscode.lm.selectChatModels({ vendor: 'anthropic', family: 'claude-3.5-sonnet' });
  }

  // Fallback to any Anthropic Claude model
  if (!models || models.length === 0) {
    models = await vscode.lm.selectChatModels({ vendor: 'anthropic' });
  }

  // Fallback to Copilot GPT-4 if Claude not available
  if (!models || models.length === 0) {
    models = await vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4' });
  }

  return models && models.length > 0 ? models[0] : undefined;
}

export async function streamModelResponse(model: vscode.LanguageModelChat, prompt: string, justification: string): Promise<string> {
  const messages = [vscode.LanguageModelChatMessage.User(prompt)];
  const chatRequest = await model.sendRequest(messages, {
    justification
  }, new vscode.CancellationTokenSource().token);

  let content = '';
  for await (const fragment of chatRequest.text) {
    content += fragment;
  }
  return content;
}

export function stripCodeBlocks(text: string): string {
  let result = text.trim();
  result = result.replace(/^```(?:markdown)?\s*\n?/i, '');
  result = result.replace(/\n?```\s*$/i, '');
  return result.trim();
}

export async function openCopilotChatForReview(
  fileUri: vscode.Uri,
  docId: string,
  reqId: string,
  content: string
) {
  const fileName = fileUri.fsPath.split('/').pop();
  const docType = docId.startsWith('DES-') ? 'design' : docId.startsWith('TASK-') ? 'task' : 'document';

  const contentPreview = content.substring(0, 2000);
  const hasMore = content.length > 2000;

  const chatPrompt = `@workspace I've generated a ${docType} document (${docId}) based on requirement ${reqId}.

**Generated Document:**
- **ID:** ${docId}
- **File:** \`${fileName}\`
- **Location:** \`${fileUri.fsPath}\`
- **Requirement:** ${reqId}
- **Size:** ${content.length} characters

---

### 📄 Generated Content

\`\`\`markdown
${contentPreview}${hasMore ? '\n\n... (content continues - total ' + content.length + ' chars)' : ''}
\`\`\`

---

### 🔍 Please Review and Analyze

Please analyze this generated ${docType} and provide feedback on:

1. **Completeness Check:**
   - What sections or details are missing?
   - Are all aspects of the requirement ${reqId} addressed?
   - For ${docType === 'design' ? 'designs: Are architecture, security, testing, and deployment covered?' : 'tasks: Are implementation steps, acceptance criteria, and dependencies clear?'}

2. **Quality Assessment:**
   - Is the content specific and actionable?
   - Are there vague statements that need more detail?
   - Are code examples, diagrams, or technical specifics needed?

3. **Improvement Suggestions:**
   - What could be added to make this ${docType} better?
   - Are there best practices or patterns that should be included?
   - What risks or edge cases might be overlooked?

4. **Structure & Clarity:**
   - Is the document well-organized?
   - Are any sections unclear or confusing?
   - Should anything be reorganized or expanded?

**Please provide specific, actionable suggestions for improvement.**`;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(
    `🔍 ${docType.charAt(0).toUpperCase() + docType.slice(1)} generated. Copilot is reviewing for improvements...`,
    'Open File',
    'View in Editor'
  ).then(selection => {
    if (selection === 'Open File' || selection === 'View in Editor') {
      vscode.window.showTextDocument(fileUri);
    }
  });
}

export async function openCopilotChatForIterativeEditing(
  fileUri: vscode.Uri,
  docId: string,
  reqId: string,
  content: string
) {
  const docType = docId.startsWith('DES-') ? 'design' : docId.startsWith('TASK-') ? 'task' : 'document';

  const chatPrompt = `@workspace I've just generated ${docType} document ${docId} (${fileUri.fsPath.split('/').pop()}).

**Context:**
- Document ID: ${docId}
- Requirement: ${reqId}
- File: ${fileUri.fsPath}

**Current Content Preview:**
\`\`\`markdown
${content.substring(0, 1000)}${content.length > 1000 ? '\n...(truncated)' : ''}
\`\`\`

The ${docType} has been created and saved. I'm now ready to make iterative improvements.

**You can help me:**
- Refine or expand any section
- Add more technical details
- Improve clarity or structure
- Add diagrams or examples
- Review for completeness
- Suggest improvements

**To edit the file, use:**
- \`@workspace /edit ${fileUri.fsPath}\` to make changes
- Ask me to read specific sections: "Show me the Architecture section"
- Request additions: "Add a Security section"
- Request refinements: "Expand the API Design section with more examples"

What would you like to improve or discuss about this ${docType}?`;

  await vscode.commands.executeCommand('workbench.action.chat.open', {
    query: chatPrompt
  });

  vscode.window.showInformationMessage(
    `💬 Copilot Chat opened for ${docId}. You can now make iterative improvements!`,
    'View File',
    'Got it'
  ).then(selection => {
    if (selection === 'View File') {
      vscode.window.showTextDocument(fileUri);
    }
  });
}
