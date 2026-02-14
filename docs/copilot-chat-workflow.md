# Using Copilot Agent Mode for Design Generation

## Overview

The **RakDev AI Extension** integrates with GitHub Copilot in **Agent Mode** to automatically generate comprehensive design documents from requirements. You can watch the generation process in real-time through the Copilot Chat panel while the design file is automatically written.

## How It Works

### Step 1: Run the Command

1. Open Command Palette (`Cmd+Shift+P` on macOS)
2. Type: **RakDev AI: Generate Design from Requirement**
3. Enter the requirement ID (e.g., `REQ-2025-1043`)

### Step 2: Watch Copilot Agent Work

The extension will:
- ✅ Create a placeholder design file (`DES-2025-XXXX.md`)
- ✅ Open the file in the editor
- ✅ **Open Copilot Chat in Agent Mode** with `@workspace` prefix
- ✅ **Copilot automatically writes the design** to the file
- ✅ Show real-time progress in the chat panel

### Step 3: Monitor Real-Time Generation

In the Copilot Chat panel, you'll see:

In the Copilot Chat panel, you'll see:

```
@workspace I have a requirement document (REQ-2025-1043) and need you to 
generate a comprehensive technical design document with ID DES-2025-1234.

**Requirement Document Content:**
```markdown
---
id: REQ-2025-1043
title: User Authentication Feature
problem: Users need secure login
scope:
  in:
    - Email/password authentication
    - OAuth integration (Google, GitHub)
...
```

Please generate a complete design document and **write it directly to the file**: 
/path/to/docs/designs/DES-2025-1234.md

[Detailed instructions for all sections...]

**Important: Replace the entire placeholder content in the file with your generated design.**
```

**Copilot Agent will:**
1. 🔍 Read the requirement document
2. 🧠 Analyze the problem, scope, metrics, and risks
3. ✍️ Generate comprehensive design sections
4. 💾 **Automatically write to the design file**
5. ✅ Show completion status

### Step 4: Review the Generated Design

Once Copilot finishes:

1. **The design file is already updated** - no manual copy/paste needed!
2. **Review the generated content** in the editor
3. **Verify the YAML front-matter** is properly formatted
4. **Check that all sections** are complete and accurate
5. **Make any adjustments** if needed
6. **Save the file** (`Cmd+S`)

## Benefits of Agent Mode

### 🤖 **Fully Automated**
- No manual copy/paste required
- Copilot directly edits the file
- Seamless workflow from requirement → design

### 🔍 **Transparent Process**
- Watch Copilot work in real-time
- See reasoning and decision-making
- Understand how the design was generated

### 📊 **Real-Time Progress**
- Chat panel shows generation steps
- See what section Copilot is working on
- Monitor completion status

### ✏️ **Iterative Control**
- Ask follow-up questions in the chat
- Request changes to specific sections
- Copilot updates the file automatically

### 📚 **Learning**
- Learn design patterns from Copilot's suggestions
- Understand architectural decisions
- See best practices in action

## Example Workflow

```bash
# 1. Create requirement
RakDev AI: New Requirement
# Fill in: User Authentication Feature with scope and metrics

# 2. Generate design with Copilot Agent
RakDev AI: Generate Design from Requirement
# Enter: REQ-2025-1043

# 3. Copilot Chat opens in Agent Mode:
🤖 Copilot: "Reading requirement REQ-2025-1043..."
🤖 Copilot: "Analyzing authentication requirements..."
🤖 Copilot: "Generating design sections..."
🤖 Copilot: "Writing to docs/designs/DES-2025-1234.md..."
✅ Copilot: "Design document created successfully!"

# 4. The file is automatically updated with:
✓ Context explaining the auth requirement
✓ Decisions about OAuth vs JWT, session management
✓ Architecture with auth service, token store, middleware
✓ API contracts for /login, /logout, /refresh endpoints
✓ Risks and mitigation strategies
✓ Test strategy for security scenarios

# 5. Review and refine (optional)
# In Copilot Chat: "Can you add more details about token refresh flow?"
🤖 Copilot: "Updating the Architecture section..."
✅ File automatically updated!

# 6. Validate
# Extension automatically indexes the new design
# Shows diagnostic if any required fields are missing
```
# Enter: REQ-2025-1043

# 3. Copilot Chat opens with prompt showing:
# - Full requirement content
# - Requested design sections
# - Formatting instructions

# 4. Review Copilot's response:
# - Context explaining the auth requirement
# - Decisions about OAuth vs JWT, session management
# - Architecture with auth service, token store, middleware
# - API contracts for /login, /logout, /refresh endpoints
# - Risks and mitigation strategies
# - Test strategy for security scenarios

# 6. Validate
# Extension automatically indexes the new design
# Shows diagnostic if any required fields are missing
```

## Tips for Best Results

### 📝 Write Clear Requirements
- Include problem statement, scope, metrics, and risks
- The more detailed your requirement, the better the design

### 🎯 Review Generated Content
- **The file is auto-updated** - just review in the editor
- Validate technical decisions against your constraints
- Add project-specific details Copilot might not know

### 🔄 Iterate in Real-Time
- Ask Copilot follow-up questions in the chat
- Example: "Add more details about error handling"
- Example: "Include retry logic in the architecture"
- Copilot will update the file automatically

### ⚙️ Customize the Prompt
- Edit `src/extension.ts` to customize the prompt template
- Add company-specific design guidelines
- Include additional context from other files

## Advanced: Direct Copilot Agent Usage

You can also manually use Copilot Agent without the command:

1. Open Copilot Chat (`Cmd+Shift+I`)
2. Type: `@workspace create a design document for requirement docs/requirements/REQ-2025-1043.md and save it to docs/designs/DES-2025-1234.md`
3. Copilot will read the requirement and generate the design
4. The file will be created automatically

## Troubleshooting

### Copilot Chat Doesn't Open
- Ensure GitHub Copilot extension is installed and active
- Check if you're signed into GitHub
- Try running: `Workbench: Open Chat` from Command Palette

### Copilot Doesn't Update the File
- Make sure you're using **Agent Mode** (prompt starts with `@workspace`)
- The file path is shown in the chat prompt
- Ask Copilot explicitly: "Please write the design to the file"

### Generated Design Missing Sections
- Review the prompt in the chat panel
- Ask Copilot to add missing sections
- Use follow-up: "Can you add more detail to the Architecture Overview section?"
- Copilot will update the file with additional content

### Front-matter Format Issues
The YAML front-matter should look like:
```yaml
---
id: DES-2025-1234
requirement: REQ-2025-1043
status: draft
decisions:
  - Use JWT for authentication
  - Implement refresh token rotation
  - Store tokens in httpOnly cookies
---
```

If Copilot formats it differently, ask: "Please fix the YAML front-matter format"

## Next Steps

After generating a design:
- [ ] Review the auto-generated design in the editor
- [ ] Ask Copilot for refinements if needed (chat stays open)
- [ ] Approve the design (`status: draft` → `status: review` → `status: approved`)
- [ ] Generate task breakdown: **RakDev AI: Generate Task Breakdown**
- [ ] Start implementation
- [ ] Update requirement status to `implemented`

---

**Pro Tip:** Keep the Copilot Chat window open after generation. You can continue the conversation to refine the design, and Copilot will automatically update the file with each iteration!
