# 🚀 Quick Start: Agent Mode Design Generation

## TL;DR

Run one command, watch Copilot work, get a complete design document automatically written to your project.

## 30-Second Demo

```bash
# 1. Open Command Palette (Cmd+Shift+P)
RakDev AI: Generate Design from Requirement

# 2. Enter requirement ID
REQ-2025-1043

# 3. Copilot Chat opens and you see:
🤖 @workspace Reading requirement REQ-2025-1043...
🤖 Analyzing problem, scope, metrics...
🤖 Generating Context, Decisions, Architecture sections...
🤖 Writing to docs/designs/DES-2025-5678.md...
✅ Design document created!

# 4. The file is already updated - just review it!
```

## What You Get

A complete design document with:
- ✅ Context section (problem, scope, metrics)
- ✅ 3-5 architectural decisions with rationale
- ✅ Architecture overview with components and data flow
- ✅ API contracts with request/response examples
- ✅ Risk analysis with mitigation strategies
- ✅ Test strategy (unit, integration, acceptance)
- ✅ Rollout plan with phases
- ✅ Open questions

## Key Features

### 🔍 Transparent Process
Watch Copilot work in the chat panel - see every step of the generation.

### 🤖 Fully Automated
No copy/paste needed - file is automatically written.

### 🔄 Interactive Refinement
Ask follow-ups in chat:
```
Can you add a sequence diagram for the login flow?
Can you expand on error handling strategies?
```
Copilot updates the file automatically!

### 📚 Educational
Learn design patterns and architectural tradeoffs from Copilot's reasoning.

## Prerequisites

- ✅ GitHub Copilot extension installed
- ✅ Signed into GitHub
- ✅ RakDev AI Extension installed
- ✅ Have a requirement file created

## Example Workflow

### Step 1: Create Requirement (2 minutes)
```bash
# Command: RakDev AI: New Requirement
```

```yaml
---
id: REQ-2025-1043
title: User Authentication System
problem: Users need secure login with OAuth support
scope:
  in:
    - Email/password authentication
    - Google OAuth integration
    - JWT token management
  out:
    - Multi-factor authentication (future)
metrics:
  - Login latency < 500ms
  - 99.9% uptime
  - Support 10K concurrent users
risks:
  - Token theft via XSS
  - OAuth provider downtime
status: approved
---
```

### Step 2: Generate Design (2 minutes)
```bash
# Command: RakDev AI: Generate Design from Requirement
# Enter: REQ-2025-1043
```

**Copilot Chat opens and generates:**
- Context explaining the auth requirement
- Decisions about JWT, OAuth, token storage
- Architecture with auth service, token service, Redis cache
- API contracts for /login, /logout, /refresh endpoints
- Risks and mitigation (XSS, CSRF, brute force)
- Test strategy with security tests
- Rollout plan (MVP → OAuth → Hardening)

### Step 3: Review & Refine (1 minute)
File is auto-updated! Optional refinements in chat:
```
Can you add retry logic for OAuth failures?
```

### Step 4: Approve & Continue
```yaml
status: draft → review → approved
```

Generate task breakdown:
```bash
# Command: RakDev AI: Generate Task Breakdown
```

## Comparison

| Manual Design | Agent Mode |
|--------------|-----------|
| 30-60 minutes | 2-3 minutes |
| Inconsistent structure | Standardized |
| No visibility | Real-time chat |
| Hard to iterate | Chat follow-ups |

## Tips

### 💡 Write Better Requirements
More detail = Better design:
- Clear problem statement
- Specific scope boundaries
- Measurable metrics
- Known risks

### 💡 Iterate in Chat
Don't settle for first draft:
```
Add more details about X
Include a diagram for Y
Expand on error handling
```

### 💡 Validate Tech Choices
Copilot might suggest unfamiliar tech - review and adjust:
```
Use PostgreSQL instead of MongoDB
```

## Troubleshooting

**Chat doesn't open:**
- Check Copilot is active (bottom right)
- Try: `Cmd+Shift+I` to open chat manually

**File not updated:**
- Verify `@workspace` in prompt
- Ask: "Please write to the file"

**Quality issues:**
- Add more detail to requirement
- Use follow-up questions
- Manually edit if needed

## What's Next?

1. Generate design ✅
2. Review and approve
3. Generate task breakdown
4. Start implementation!

---

**Full docs:** See `docs/AGENT-MODE-SETUP.md` for complete guide.

**Ready?** Run: `RakDev AI: Generate Design from Requirement` 🚀
