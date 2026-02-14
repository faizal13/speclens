# 🎯 Interactive Task Generation with Copilot Agent

## Overview

The **Generate Tasks from Design (Interactive)** command creates individual, trackable task files from your design document. Each task:

✅ **Links to requirement sections** - See what part of the requirement it covers  
✅ **Links to design decisions** - Know which design section it implements  
✅ **Shows in Copilot Chat** - Watch generation in real-time  
✅ **Individually controllable** - Start, retry, or skip any task  
✅ **Auto-written to files** - No manual copy/paste  

## How It Works

### 1. Run the Command

```bash
# Command Palette (Cmd+Shift+P)
RakDev AI: Generate Tasks from Design (Interactive)

# Enter design ID
DES-2025-1234
```

### 2. Copilot Agent Analyzes

The extension:
1. ✅ Reads the design document
2. ✅ Reads the linked requirement document  
3. ✅ Opens Copilot Chat with `@workspace` agent prompt
4. ✅ Shows full context to Copilot

### 3. Watch Task Generation

In the Copilot Chat panel, you see:

```
🤖 @workspace Analyzing design DES-2025-1234...
🤖 Breaking down into actionable tasks...
🤖 Creating TASK-2025-5001-jwt-token-service.md...
🤖 Creating TASK-2025-5002-oauth-integration.md...
🤖 Creating TASK-2025-5003-user-database-schema.md...
...
✅ Generated 12 tasks with requirement and design links!
```

### 4. Task Files Auto-Created

Each task file in `docs/tasks/` includes:

```markdown
---
id: TASK-2025-5001
design: DES-2025-1234
requirement: REQ-2025-1043
status: todo
acceptance:
  - JWT generation creates valid tokens
  - Token validation rejects expired tokens
  - Unit tests achieve 90%+ coverage
designSection: "Decisions > Decision 1: Use JWT"
requirementLink: "#scope"
estimatedHours: 4
---
# Task: Implement JWT Token Service

## Overview
Create token service for JWT generation and validation.

## Design Context
This implements **Decisions > Decision 1: Use JWT for Authentication** 
from [DES-2025-1234](../designs/DES-2025-1234.md#decisions).

## Requirement Coverage
Covers [REQ-2025-1043](../requirements/REQ-2025-1043.md#scope):
- ✅ **In-scope**: Email/password authentication
- ✅ **In-scope**: OAuth integration  
- ✅ **Success Metric**: Login latency < 500ms

## Implementation Details
### Step 1: Setup JWT Library
- Install `jsonwebtoken` package
- Configure signing secret

### Step 2: Create Token Service
- generateAccessToken(userId, claims)
- validateAccessToken(token)
...

## Acceptance Criteria
- ✅ JWT generation creates valid tokens
- ✅ Token validation rejects expired tokens
- ✅ Unit tests achieve 90%+ coverage

## Dependencies
None - foundational task

## Estimated Effort
**4 hours**
```

## Key Features

### 🔗 Requirement Linkage

Every task shows **which part of the requirement** it addresses:

```markdown
## Requirement Coverage
Covers [REQ-2025-1043](../requirements/REQ-2025-1043.md#scope):
- ✅ **In-scope**: OAuth integration
- ✅ **Success Metric**: 99.9% uptime
- ✅ **Excludes**: MFA (out of scope)
```

**Benefits:**
- Click links to jump to requirement sections
- Understand **why** this task exists
- Validate coverage of all requirements

### 🎯 Design Section Mapping

Every task links to **specific design decisions**:

```markdown
## Design Context
This implements **Architecture > Auth API Component** 
from [DES-2025-1234](../designs/DES-2025-1234.md#architecture-overview).
```

**Benefits:**
- Know which design section guides this task
- Navigate directly to architectural context
- Ensure design is fully implemented

### 📊 Task Control

Each task has its own file with status:

```yaml
status: todo  # or: in-progress, done, blocked
```

**You control:**
- ✅ Which tasks to start first
- ✅ When to retry failed tasks
- ✅ Skip tasks if requirements change
- ✅ Add custom tasks manually

### 🤖 Visible Generation

Watch Copilot work in the chat panel:

```
🤖 Analyzing design sections...
🤖 Found 5 architectural decisions
🤖 Found 3 API contract groups
🤖 Found 4 architecture components
🤖 Creating 12 implementation tasks...

Task 1: JWT Token Service (Decision 1)
  - Links to: REQ-2025-1043#scope
  - Estimated: 4 hours
  
Task 2: OAuth Integration (Decision 2)
  - Links to: REQ-2025-1043#scope
  - Estimated: 6 hours
...
```

### 🔄 Iterative Refinement

After generation, ask Copilot follow-ups:

```
Can you split Task 3 into smaller sub-tasks?
Can you add more detail to the API implementation task?
Can you create a separate task for database migrations?
```

Copilot will create/update task files automatically!

## Task Breakdown Strategy

Copilot creates tasks from:

### 1. Design Decisions (1 task each)
```
Decision 1: JWT Authentication → TASK: Implement JWT Service
Decision 2: OAuth Integration → TASK: OAuth Flow Implementation
Decision 3: httpOnly Cookies → TASK: Cookie-based Token Storage
```

### 2. Architecture Components (1 task each)
```
Auth API Component → TASK: Auth API Endpoints
Token Service Component → TASK: Token Management Service
User Database → TASK: User Database Schema
Redis Cache → TASK: Token Blacklist Cache
```

### 3. API Contracts (grouped by domain)
```
Login/Logout endpoints → TASK: Authentication Endpoints
Token refresh endpoint → TASK: Token Refresh Implementation
User profile endpoints → TASK: User Profile API
```

### 4. Test Strategy (by level)
```
Unit Tests → TASK: Unit Test Suite
Integration Tests → TASK: Integration Test Suite
Security Tests → TASK: Security Test Suite
Performance Tests → TASK: Load Testing Setup
```

### 5. Rollout Phases (from design)
```
Phase 1: MVP → TASK: MVP Deployment
Phase 2: OAuth → TASK: OAuth Production Rollout
Phase 3: Hardening → TASK: Security Hardening
```

## Example: Full Task Generation Flow

### Input: Design Document

```yaml
---
id: DES-2025-1234
requirement: REQ-2025-1043
status: approved
decisions:
  - Use JWT for stateless auth
  - Implement OAuth 2.0 for Google
  - Store refresh tokens in httpOnly cookies
---
# Design: User Authentication

## Decisions
### Decision 1: JWT
...
### Decision 2: OAuth
...

## Architecture
- Auth API (Express)
- Token Service
- User DB (PostgreSQL)
- Redis Cache

## API Contracts
- POST /api/auth/login
- POST /api/auth/logout
- POST /api/auth/refresh
- GET /api/auth/oauth/google
...
```

### Output: Generated Tasks

**12 task files created:**

1. `TASK-2025-5001-jwt-token-service.md`
   - Design: Decision 1
   - Requirement: Scope (auth methods)
   - 4 hours

2. `TASK-2025-5002-oauth-google-integration.md`
   - Design: Decision 2
   - Requirement: Scope (OAuth integration)
   - 6 hours

3. `TASK-2025-5003-httponly-cookie-storage.md`
   - Design: Decision 3
   - Requirement: Scope (security)
   - 3 hours

4. `TASK-2025-5004-auth-api-endpoints.md`
   - Design: Architecture (Auth API)
   - Requirement: Scope (login/logout)
   - 5 hours

5. `TASK-2025-5005-user-database-schema.md`
   - Design: Architecture (User DB)
   - Requirement: Scope (user storage)
   - 3 hours

6. `TASK-2025-5006-redis-token-blacklist.md`
   - Design: Architecture (Redis Cache)
   - Requirement: Metrics (logout invalidation)
   - 2 hours

7. `TASK-2025-5007-login-endpoint.md`
   - Design: API Contracts (/login)
   - Requirement: Scope (authentication)
   - 4 hours

8. `TASK-2025-5008-logout-endpoint.md`
   - Design: API Contracts (/logout)
   - Requirement: Scope (session management)
   - 2 hours

9. `TASK-2025-5009-token-refresh-endpoint.md`
   - Design: API Contracts (/refresh)
   - Requirement: Scope (token lifecycle)
   - 3 hours

10. `TASK-2025-5010-unit-test-suite.md`
    - Design: Test Strategy (unit tests)
    - Requirement: Metrics (code quality)
    - 6 hours

11. `TASK-2025-5011-integration-test-suite.md`
    - Design: Test Strategy (integration)
    - Requirement: Metrics (reliability)
    - 8 hours

12. `TASK-2025-5012-security-test-suite.md`
    - Design: Risks (XSS, CSRF mitigation)
    - Requirement: Risks (token theft)
    - 4 hours

**Total: 50 hours estimated**

## Working with Generated Tasks

### View Tasks in Tree

The RakDev AI tree view shows all tasks grouped:

```
📁 RakDev AI
  📁 Requirements (1)
    📄 REQ-2025-1043
  📁 Designs (1)
    📄 DES-2025-1234
  📁 Tasks (12)
    📄 TASK-2025-5001 (todo)
    📄 TASK-2025-5002 (todo)
    ...
```

### Start a Task

1. Open task file: `TASK-2025-5001-jwt-token-service.md`
2. Update status: `status: in-progress`
3. Click requirement link to see context
4. Click design link to see decisions
5. Implement according to steps
6. Update status: `status: done`

### Retry a Failed Task

If a task fails:

1. Open Copilot Chat
2. Share the task file: `@workspace See TASK-2025-5001. I'm stuck on Step 2.`
3. Copilot reads the task context
4. Ask: "How do I implement token validation?"
5. Get specific guidance based on your design

### Track Progress

The status bar shows task counts:

```
RakDev AI (R:1 D:1 T:12 ⚠️0)
         Tasks: 3 done, 4 in-progress, 5 todo
```

## Benefits Summary

| Feature | Manual Tasks | Agent-Generated Tasks |
|---------|-------------|----------------------|
| **Creation Time** | 1-2 hours | 2-3 minutes |
| **Requirement Links** | ❌ Manual | ✅ Automatic |
| **Design Links** | ❌ Manual | ✅ Automatic |
| **Consistency** | ⚠️ Varies | ✅ Structured |
| **Visibility** | ❌ Hidden | ✅ Real-time chat |
| **Granularity** | ⚠️ Guessed | ✅ Optimized |
| **Dependencies** | ❌ Manual | ✅ Auto-detected |
| **Estimates** | ⚠️ Rough | ✅ Calculated |

## Tips for Best Results

### 📝 Detailed Design Documents

Better design = Better tasks:
- ✅ Clear decisions with rationale
- ✅ Component responsibilities defined
- ✅ API contracts specified
- ✅ Test strategy outlined

### 🎯 Review Generated Tasks

Don't blindly accept:
- ✅ Verify requirement coverage
- ✅ Check task granularity (2-8 hour tasks ideal)
- ✅ Validate dependencies
- ✅ Adjust estimates based on team velocity

### 🔄 Iterate with Copilot

Use follow-ups:
```
Can you split Task 5 into database setup and migration?
Can you add a task for API documentation?
Can you create tasks for monitoring setup?
```

### 📊 Track Progress

Update task status regularly:
```yaml
status: todo → in-progress → done
```

This helps team track what's left.

## Troubleshooting

### Not Enough Tasks Generated

Ask Copilot:
```
Can you create more granular tasks for the Auth API component?
Can you break down the OAuth integration into smaller steps?
```

### Too Many Tasks

Ask Copilot:
```
Can you combine Tasks 7, 8, 9 into a single "Auth Endpoints" task?
```

### Missing Requirement Links

If links are broken:
1. Check requirement ID in design front-matter
2. Verify requirement file exists
3. Ask Copilot: "Fix broken requirement links in tasks"

### Tasks Not Created

- Verify design document exists
- Check design has `requirement:` field
- Ensure Copilot is active
- Try manual: Open chat, paste the prompt

## What's Next?

After task generation:

1. **Review all tasks** - Verify coverage and estimates
2. **Prioritize tasks** - Order by dependencies
3. **Assign tasks** - Distribute to team
4. **Start implementation** - Pick first task
5. **Track progress** - Update status as you go
6. **Use Copilot help** - Ask questions per task

## Advanced: Custom Task Templates

Want specific task structure? Edit `src/extension.ts`:

```typescript
const chatPrompt = `...

**Custom Requirements:**
- Add "Related PRs" section to each task
- Include "Rollback Plan" for risky tasks
- Add "Performance Impact" notes
- Include "Documentation Updates" section

...`;
```

---

**Ready to try it?** Start with an approved design and run:  
`RakDev AI: Generate Tasks from Design (Interactive)` 🚀
