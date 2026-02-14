# 🚀 Quick Reference: Interactive Task Generation

## Command
`RakDev AI: Generate Tasks from Design (Interactive)`

## What It Does
Creates 8-15 individual task files from your design document, each:
- ✅ Linked to requirement sections
- ✅ Linked to design decisions
- ✅ With acceptance criteria
- ✅ With effort estimates
- ✅ With dependencies
- ✅ Controllable status (todo/in-progress/done)

## 30-Second Workflow

```bash
# 1. Run command
Cmd+Shift+P → Generate Tasks from Design (Interactive)

# 2. Enter design ID
DES-2025-1234

# 3. Watch Copilot generate tasks in chat
🤖 Creating TASK-2025-5001-jwt-token-service.md...
🤖 Creating TASK-2025-5002-oauth-integration.md...
...
✅ 12 tasks created!

# 4. Tasks auto-written to docs/tasks/
# Each task file has:
- Requirement link (what it covers)
- Design link (what it implements)
- Step-by-step implementation guide
- Acceptance criteria
```

## Task File Structure

```markdown
---
id: TASK-2025-5001
design: DES-2025-1234
requirement: REQ-2025-1043
status: todo
acceptance:
  - [criteria 1]
  - [criteria 2]
designSection: "Decisions > Decision 1"
requirementLink: "#scope"
estimatedHours: 4
---
# Task: [Name]

## Overview
What needs to be done

## Design Context
Links to specific design section

## Requirement Coverage
Links to requirement sections covered:
- ✅ In-scope: [feature]
- ✅ Success Metric: [metric]

## Implementation Details
Step-by-step instructions

## Acceptance Criteria
How to verify completion

## Dependencies
Other tasks that must be done first

## Estimated Effort
Time estimate
```

## Key Features

### 🔗 Automatic Linking
```markdown
## Requirement Coverage
Covers [REQ-2025-1043](../requirements/REQ-2025-1043.md#scope):
- ✅ OAuth integration (in-scope)
- ✅ Login latency < 500ms (metric)
```

**Click link → Jump to requirement section!**

### 🎯 Design Mapping
```markdown
## Design Context
Implements **Decisions > Decision 2: OAuth Integration**
from [DES-2025-1234](../designs/DES-2025-1234.md#decisions)
```

**Click link → See design decision!**

### 📊 Individual Control
```yaml
status: todo  # Change to: in-progress, done, blocked
```

**You decide:**
- Which task to start
- When to retry
- Which to skip

### 🤖 Visible Process
Watch in Copilot Chat:
```
🤖 Analyzing design sections...
🤖 Creating tasks from 5 decisions...
🤖 Creating tasks from 4 components...
🤖 Creating tasks from API contracts...
✅ Generated 12 tasks
```

## Task Breakdown Logic

Copilot creates tasks from:

| Design Section | Task Type | Example |
|---------------|-----------|---------|
| **Decisions** | 1 per decision | JWT Service, OAuth Integration |
| **Architecture** | 1 per component | Auth API, Token Service, User DB |
| **API Contracts** | Grouped by domain | Auth Endpoints, Profile Endpoints |
| **Test Strategy** | 1 per test level | Unit Tests, Integration Tests |
| **Rollout Phases** | 1 per phase | MVP Deploy, OAuth Rollout |

## Example Generated Tasks

From a User Auth design:

```
✅ TASK-2025-5001: JWT Token Service (4h)
   Links: REQ#scope, DES#decision-1

✅ TASK-2025-5002: OAuth Google Integration (6h)
   Links: REQ#scope, DES#decision-2

✅ TASK-2025-5003: Auth API Endpoints (5h)
   Links: REQ#scope, DES#architecture

✅ TASK-2025-5004: User Database Schema (3h)
   Links: REQ#scope, DES#architecture

✅ TASK-2025-5005: Unit Test Suite (6h)
   Links: REQ#metrics, DES#test-strategy

... (12 total tasks)
```

## Working with Tasks

### Start a Task
1. Open `TASK-2025-5001.md`
2. Click requirement link → See context
3. Click design link → See decisions
4. Update: `status: in-progress`
5. Implement step-by-step
6. Update: `status: done`

### Get Help from Copilot
```
@workspace I'm working on TASK-2025-5001. 
How do I implement JWT validation?
```

Copilot reads the task context and helps!

### Iterate
In Copilot Chat:
```
Can you split Task 3 into smaller sub-tasks?
Can you add more detail to Task 7?
Can you create a task for database migrations?
```

Tasks update automatically!

## Status Tracking

**Status Bar:**
```
RakDev AI (R:1 D:1 T:12 ⚠️0)
```

**Tree View:**
```
📁 Tasks (12)
  ✅ TASK-2025-5001 (done)
  🔄 TASK-2025-5002 (in-progress)
  ⏳ TASK-2025-5003 (todo)
  ...
```

## Benefits

| Aspect | Manual | Auto-Generated |
|--------|--------|---------------|
| Time | 1-2 hours | 2-3 minutes |
| Requirement links | ❌ | ✅ Automatic |
| Design links | ❌ | ✅ Automatic |
| Granularity | ⚠️ Guessed | ✅ Optimized |
| Dependencies | ❌ | ✅ Auto-detected |
| Estimates | ⚠️ Rough | ✅ Calculated |
| Visibility | ❌ | ✅ Real-time chat |

## Tips

### ✅ Review First
Don't blindly accept:
- Check requirement coverage is complete
- Verify task granularity (2-8 hours ideal)
- Validate dependencies make sense

### ✅ Iterate
Use Copilot Chat:
- "Make tasks more granular"
- "Add deployment tasks"
- "Include monitoring setup"

### ✅ Track Progress
Update status:
```yaml
todo → in-progress → done
```

### ✅ Use Links
Click requirement/design links to:
- Understand context
- Verify coverage
- See original decisions

## Troubleshooting

**Too few tasks?**
```
Can you create more granular tasks?
```

**Too many tasks?**
```
Can you combine Tasks 5, 6, 7?
```

**Missing links?**
- Verify design has `requirement:` field
- Check files exist
- Ask: "Fix broken links"

**Tasks not created?**
- Check Copilot is active
- Verify design file exists
- Retry command

## Full Workflow

```bash
# 1. Create requirement
RakDev AI: New Requirement
# (Add problem, scope, metrics)

# 2. Generate design
RakDev AI: Generate Design from Requirement
# (Copilot creates design, you review)

# 3. Generate tasks
RakDev AI: Generate Tasks from Design (Interactive)
# (Copilot creates 8-15 task files)

# 4. Review tasks
# Check links, estimates, dependencies

# 5. Start implementation
# Pick first task, update status
# Use Copilot help per task

# 6. Track progress
# Update status as tasks complete
```

## Next Steps

After task generation:
1. Review all tasks
2. Prioritize by dependencies
3. Assign to team members
4. Start first task
5. Use Copilot for help
6. Track progress in tree view

---

**Full docs:** See `docs/INTERACTIVE-TASK-GENERATION.md`

**Ready?** Run: `Generate Tasks from Design (Interactive)` 🎯
