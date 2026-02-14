# Hybrid Workflow: Automation + Human Review

## Overview

The extension now implements a **hybrid workflow** that combines the best of both worlds:

1. ⚡ **Fast, Reliable Automation**: Files are auto-generated using Language Model API
2. 👀 **Human Review & Control**: Copilot Chat prompts you to review and improve
3. 🤖 **Agent Mode Refinements**: Explicit instructions to switch to @workspace for edits

## Why This Approach?

### Previous Approaches & Limitations

| Approach | Benefits | Limitations |
|----------|----------|-------------|
| **Full Automation** | Fast, reliable, no user action needed | No visibility, can't control quality |
| **Pre-open Chat** | Would show progress in real-time | Can't pre-select agent mode; API creates new session |
| **Manual Process** | Full control | Slow, requires constant attention |

### Hybrid Solution

The hybrid workflow addresses all these limitations:

✅ **Speed**: Files generated automatically in ~60 seconds (designs) or ~55 seconds (tasks)
✅ **Reliability**: Multi-stage generation ensures complete, non-truncated content
✅ **Visibility**: Copilot Chat shows you what was generated with detailed review prompt
✅ **Control**: You decide when to switch to Agent mode and what to improve
✅ **Quality**: Copilot suggests improvements, you accept/reject them

## How It Works

### Design Generation Flow

```
1. User clicks "Generate Design" on requirement
   ↓
2. Extension generates design (4 stages, ~60s)
   - Stage 1: Overview & Architecture
   - Stage 2: Technical Decisions & Data Models
   - Stage 3: API Design & Security
   - Stage 4: Error Handling, Testing, Deployment
   ↓
3. Design file saved to docs/designs/{year}/{design-id}.md
   ↓
4. Copilot Chat opens with REVIEW PROMPT:
   - Summary of what was generated
   - File location and size
   - **Explicit instruction: "Switch to Agent mode (@workspace)"**
   - Review checklist (completeness, accuracy, clarity)
   - How to proceed (suggest improvements, direct edits, or approve)
   ↓
5. User reviews the prompt in chat
   ↓
6. User switches to Agent mode manually
   - Click mode selector at top of chat
   - Choose "Agent" mode
   - See @workspace appear in input
   ↓
7. User asks Copilot to review/improve:
   "Please review the design and suggest improvements"
   ↓
8. Copilot reads file and suggests improvements
   ↓
9. User approves changes
   ↓
10. Copilot edits the file directly (agent mode)
```

### Task Generation Flow

```
1. User clicks "Generate Tasks" on design
   ↓
2. Extension generates tasks (3 stages, ~55s)
   - Stage 1: Generate task outline (5-10 tasks)
   - Stage 2: Generate each task individually with full context
   - Stage 3: Write files and enable interactive buttons
   ↓
3. Task files saved to docs/tasks/{year}/{task-id}-*.md
   ↓
4. Copilot Chat opens with REVIEW PROMPT
   (same process as design generation)
   ↓
5-10. User reviews, switches to agent mode, and improves tasks
```

## The Review Prompt

### What You'll See in Copilot Chat

When files are generated, Copilot Chat opens with a comprehensive review prompt:

#### 1. Document Summary
- Document ID (DES-2025-0001, TASK-2025-5001, etc.)
- File location (absolute path)
- Related requirement ID
- Content size

#### 2. Action Required
**IMPORTANT**: Explicit instruction to switch to Agent mode:
```
⚡ IMPORTANT: Switch to Agent Mode First!

Before proceeding, please:
1. 👆 Click on the chat input mode selector at the top
2. 🔄 Switch from "Ask" mode to "Agent" mode (@workspace)
3. ✅ You'll see @workspace appear in the chat input

Why Agent mode?
- Agent mode can read and edit files directly
- You can make improvements without manual copy-paste
- Changes are applied with one click
```

#### 3. Review Checklist
Structured checklist covering:
- **Completeness**: All requirements addressed, no missing sections
- **Accuracy**: Sound technical decisions, appropriate architecture
- **Clarity**: Easy to understand, helpful diagrams, no confusion
- **Production-Ready**: Ready for implementation, sufficient detail

#### 4. How to Proceed
Three clear options:

**Option A: Review & Suggest** (Recommended)
```
Please read the design at: {file path}

Review it against the requirement ({req-id}) and suggest:
1. What's missing or incomplete
2. What needs more detail
3. What could be improved

Then ask me: "Should I apply these improvements?"
```

**Option B: Direct Edits**
```
Please improve the design at: {file path}

Specifically:
1. Add more detail to the [section name] section
2. Include mermaid diagram for architecture
3. Expand the API design with more examples
```

**Option C: No Changes Needed**
```
If the design looks complete, just say "Looks good!"
```

## Using Agent Mode

### Why Agent Mode?

Agent mode (@workspace) is crucial for this workflow because:

1. **File Access**: Agent can read the generated file directly
2. **Direct Edits**: Agent can modify files without copy-paste
3. **Context Awareness**: Agent understands project structure
4. **One-Click Apply**: You review changes and click "Accept"

### How to Switch to Agent Mode

1. Look at the top of the Copilot Chat panel
2. Find the mode selector dropdown (shows "Ask" by default)
3. Click it and select "Agent"
4. You'll see `@workspace` appear in the chat input
5. Now you can type your review request

### Example Agent Mode Prompts

Once in agent mode, you can ask:

**General Review**:
```
Please review the design file and suggest improvements for completeness and clarity
```

**Specific Improvements**:
```
Add a mermaid diagram showing the architecture in the Technical Decisions section
```

**Expand Sections**:
```
The API Design section needs more detail - add request/response examples for each endpoint
```

**Check Requirements Coverage**:
```
Review the requirement REQ-2025-1001 and verify all aspects are covered in the design
```

## Benefits of This Workflow

### For Users

| Benefit | Description |
|---------|-------------|
| **Speed** | Get complete documents in ~60 seconds, not 5 minutes of manual work |
| **Quality** | Multi-stage generation ensures completeness, Copilot improves quality |
| **Control** | You decide what to improve and when to accept changes |
| **Transparency** | See exactly what was generated before making changes |
| **Learning** | Review prompts teach you what to look for in good designs/tasks |

### For the Workflow

| Benefit | Description |
|---------|-------------|
| **Reliability** | Language Model API is faster and more reliable than chat UI |
| **No Token Limits** | Multi-stage generation avoids truncation |
| **Full Context** | Each stage gets complete requirement/design text |
| **File Integration** | Generated files immediately work with CodeLens buttons |
| **Iterative Improvement** | Agent mode allows unlimited refinements |

## Best Practices

### 1. Always Switch to Agent Mode

Don't skip this step! Agent mode is essential for:
- Reading the generated file
- Making direct edits
- Understanding project context

### 2. Review Before Requesting Changes

Take a moment to:
- Read the review prompt checklist
- Open the generated file
- Compare with the requirement
- Identify specific areas to improve

### 3. Be Specific in Your Requests

Instead of "improve this", say:
- "Add request/response examples to the API section"
- "Include error handling details for edge cases"
- "Expand testing approach with specific test scenarios"

### 4. Use Option A (Review & Suggest)

Let Copilot analyze and suggest improvements first:
- More comprehensive than manual review
- Finds issues you might miss
- You get approval before changes

### 5. Iterate as Needed

Don't try to fix everything in one go:
- Make improvements in stages
- Review each change before next
- Stop when quality is sufficient

## Troubleshooting

### Chat Doesn't Open

**Problem**: Copilot Chat doesn't open automatically
**Solution**: 
- Check if Copilot extension is installed
- Try opening chat manually: Cmd+Shift+I
- Extension will show notification with file location

### Can't Find Agent Mode

**Problem**: Don't see "Agent" option in mode selector
**Solution**:
- Update GitHub Copilot to latest version
- Agent mode requires Copilot Chat extension
- Try reloading VS Code window

### Agent Can't Read File

**Problem**: Agent says it can't access the file
**Solution**:
- Make sure you're in Agent mode (see @workspace in input)
- Provide absolute file path (it's in the review prompt)
- Check file was actually created (look in docs/ folder)

### Changes Not Applied

**Problem**: Copilot suggests changes but they're not in the file
**Solution**:
- Make sure you clicked "Accept" on the proposed changes
- Agent mode required for direct file edits
- Check if file is read-only or git locked

## Summary

The hybrid workflow gives you:

1. ⚡ **Automation**: Fast, reliable file generation
2. 👀 **Visibility**: See what was generated with detailed review prompt
3. 🎯 **Control**: You decide what to improve and when
4. 🤖 **AI Power**: Agent mode makes improvements with one click
5. 🔄 **Iteration**: Unlimited refinements until quality is perfect

This combines the best aspects of automation (speed, reliability) with human judgment (quality, control), giving you a powerful workflow for requirement → design → task generation.

---

**Next Steps**:
1. Try generating a design from a requirement
2. Review the Copilot Chat prompt when it opens
3. Switch to Agent mode as instructed
4. Ask Copilot to review and suggest improvements
5. Accept the changes you like
6. Repeat for task generation

Enjoy the new hybrid workflow! 🚀
