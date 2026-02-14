# Quick Reference: Hybrid Workflow

## The Process

```
Generate → Review Prompt → Switch to Agent Mode → Improve → Accept
```

## For Design Generation

1. **Click** "Generate Design" on requirement
2. **Wait** ~60 seconds (4 stages)
3. **Copilot Chat opens** with review prompt
4. **Switch** to Agent mode (@workspace)
5. **Ask** Copilot to review and suggest improvements
6. **Accept** the changes you like

## For Task Generation

1. **Click** "Generate Tasks" on design
2. **Wait** ~55 seconds (3 stages)
3. **Copilot Chat opens** with review prompt
4. **Switch** to Agent mode (@workspace)
5. **Ask** Copilot to review and suggest improvements
6. **Accept** the changes you like

## The Review Prompt Template

When files are generated, you'll see:

```
I've just generated a [design/task] document: **[DOC-ID]**

📄 File Location: {path}
🔗 Requirement: {req-id}
📊 Size: {chars} characters

---

## 🎯 YOUR TASK: Review & Improve

⚡ IMPORTANT: Switch to Agent Mode First!

1. Click mode selector at top
2. Choose "Agent" mode
3. See @workspace in input

---

📋 Review Checklist:
- Completeness
- Accuracy
- Clarity
- Production-Ready

---

💡 How to Proceed:

Option A: Review & Suggest (Recommended)
"Please read the design and suggest improvements"

Option B: Direct Edits
"Add more detail to [section]"

Option C: No Changes Needed
"Looks good!"
```

## Useful Agent Mode Prompts

### General Review
```
Please review the design file and suggest improvements for completeness and clarity
```

### Specific Improvements
```
Add a mermaid diagram showing the architecture in the Technical Decisions section
```

### Expand Sections
```
The API Design section needs more detail - add request/response examples
```

### Check Coverage
```
Review the requirement REQ-2025-1001 and verify all aspects are covered
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Chat doesn't open | Open manually with Cmd+Shift+I |
| No Agent mode option | Update Copilot extension |
| Agent can't read file | Make sure you're in Agent mode (@workspace) |
| Changes not applied | Click "Accept" on proposed changes |

## Tips

✅ **DO**:
- Switch to Agent mode first (essential!)
- Be specific in your improvement requests
- Let Copilot suggest before requesting specific changes
- Review changes before accepting

❌ **DON'T**:
- Skip Agent mode (you'll lose editing capability)
- Make all changes at once (iterate in stages)
- Accept without reviewing (quality control)

## Why This Works

- **Speed**: Auto-generation is fast (~60s vs 5+ minutes manual)
- **Quality**: Multi-stage ensures completeness, Copilot improves clarity
- **Control**: You approve all changes
- **Transparency**: See exactly what was generated

---

**Remember**: The key is switching to Agent mode - that's what enables Copilot to read and edit files directly! 🚀
