# SpecLens

**The Visual Layer for Spec-Driven Development**

SpecLens brings live diagnostics, interactive task controls, and agent-agnostic AI routing to [GitHub Spec Kit](https://github.com/github/spec-kit) workflows. It's the VS Code extension that Spec Kit developers have been waiting for.

## What is Spec-Driven Development?

Spec-Driven Development (popularized by GitHub Spec Kit, AWS Kiro IDE, and Google's BMAD Method) is a workflow where you:

1. **Write a spec** (`spec.md`) - Define what you're building and why
2. **Create a plan** (`plan.md`) - Architecture, tech decisions, data models
3. **Break into tasks** (`tasks.md`) - Incremental, testable work items
4. **Implement with AI** - Route tasks to Copilot, Claude, or Cursor

SpecLens adds the **visual IDE layer** that file-convention tools can't provide: diagnostics, CodeLens task buttons, agent detection, and format validation.

---

## Features

✅ **BA→Spec Elaboration** - Transform rough notes into formal specs with AI
✅ **Bug Fix Documentation** - Document production bugs with fix plans and tasks
✅ **Context Document Support** - Attach architecture diagrams, schemas, APIs as context
✅ **Microservices Support** - API contracts, events, service dependencies
✅ **Enhanced Validation** 📊 - Spec completeness scoring, traceability, task coverage
✅ **Validation Reports** - Interactive dashboards with health metrics and recommendations
✅ **everything-copilot Integration** 🍒 - Specialized agents + auto-loading specs
✅ **Intelligent Agent Routing** - @architect, @tdd, @security-reviewer (cost-optimized)
✅ **Spec-as-Skill** - Auto-load spec context when editing related code
✅ **Auto-detects Spec Kit format** (`specs/[branch]/{spec,plan,tasks}.md`)
✅ **Agent-agnostic task routing** - Works with Copilot, Claude Code, or Cursor
✅ **Interactive CodeLens** - Start/Complete/Block tasks without leaving the editor
✅ **Live diagnostics** - Validates specs, plans, and tasks as you write
✅ **Tree view** - Browse all specs in your workspace
✅ **Status bar** - See spec/plan/task counts at a glance

---

## 🧠 BA → Spec Elaboration Workflow

**The Problem:** Business Analysts often struggle to write formal, well-structured requirements. They know what they want at a high level but can't document it properly for development teams.

**The Solution:** SpecLens's AI-powered spec elaboration workflow transforms rough BA notes into formal specs following industry-standard formats (GitHub Spec Kit, AWS Kiro, Google BMAD).

### How It Works

1. **BA provides rough notes** - Just describe the requirement at a high level
   ```
   "We need user login with email and password, maybe social login too"
   ```

2. **AI asks clarifying questions** - The agent probes for:
   - Scope and boundaries
   - User personas and use cases
   - Success metrics
   - Edge cases and constraints
   - Security/performance requirements

3. **AI generates formal spec.md** - Following GitHub Spec Kit format:
   - Overview (what and why)
   - Goals and non-goals
   - User stories
   - Success metrics
   - Technical requirements
   - Out of scope section

4. **BA/Dev reviews and iterates** - Edit the spec, add details, refine with AI

5. **Generate plan.md** - Create architecture/design from the approved spec
   ```
   SpecLens: 🏗️ Generate Plan from Spec
   ```

6. **Generate tasks.md** - Break plan into incremental work items
   ```
   SpecLens: 📋 Generate Tasks from Plan
   ```

7. **Execute with CodeLens** - Click "Start Task" buttons to route tasks to AI agent

### Using the Commands

#### 1. Elaborate BA Notes → Spec (with Context Documents)
Open Command Palette (`Cmd+Shift+P`) and run:
```
SpecLens: 🧠 Elaborate BA Notes → Spec
```
- Paste rough BA notes
- Choose microservice or monolith
- Enter feature name (e.g., `user-authentication`)
- **Optional:** Attach context documents (architecture diagrams, API docs, database schemas)
- AI generates complete spec.md (with API contracts for microservices)
- Save to `specs/[feature-name]/spec.md`

**Context Documents:**
- Architecture diagrams (PNG, SVG)
- Database schemas (SQL, Prisma)
- API documentation (JSON, YAML, OpenAPI)
- Existing code (TS, JS, Python)
- Any relevant docs (PDF, MD, TXT)

Files are copied to `specs/[feature]/context/` and auto-loaded in subsequent commands.

#### 2. Generate Plan from Spec
After creating spec.md, run:
```
SpecLens: 🏗️ Generate Plan from Spec
```
- Select which spec to generate plan from
- AI creates architecture, tech stack, data models, API design
- Save to `specs/[feature-name]/plan.md`

#### 3. Generate Tasks from Plan
After creating plan.md, run:
```
SpecLens: 📋 Generate Tasks from Plan
```
- Select which plan to break down
- AI creates 15-25 incremental tasks (2-4 hours each)
- Each task has acceptance criteria and dependencies
- Save to `specs/[feature-name]/tasks.md`

#### 4. Document Bug Fixes (NEW! 🐛)
For production bugs, run:
```
SpecLens: 🐛 Document Bug & Create Fix Plan
```
- Describe the bug
- Select severity (Critical/High/Medium/Low)
- Add reproduction steps and error messages
- AI generates:
  - `spec.md`: Bug analysis, root cause, impact assessment
  - `plan.md`: Investigation steps, fix approach, rollback plan
  - `tasks.md`: 7 focused tasks (reproduce, debug, fix, test, deploy, monitor)
- Save to `specs/bugfix-YYYY-XXXX/`

**Perfect for:**
- Production incidents
- Critical hotfixes
- Regression bugs
- User-reported issues

#### 5. Execute Tasks with CodeLens
Open `tasks.md` and click CodeLens buttons:
- **Start Task** - Opens AI agent with task context
- **Complete Task** - Marks task as done
- **Block Task** - Flags blockers

**Tip:** Works with **any AI agent** - Copilot, Claude Code, or Cursor. Configure your preference in settings: `speclens.preferredAgent`

---

## 🔧 Microservices Support

SpecLens fully supports microservice architectures! When creating specs for microservices:

**Enhanced Spec Template Includes:**
- **Service Context**: Service name, responsibilities, boundaries
- **Service Dependencies**: Upstream/downstream services, external APIs
- **API Contracts**: Endpoint specs with request/response types
- **Event Schemas**: Published and consumed events with JSON schemas
- **Inter-Service Communication**: REST, gRPC, message queues

**Example Workflow:**
1. Run `SpecLens: 🧠 Elaborate BA Notes → Spec`
2. Select "Microservice Feature"
3. Enter service name: `payment-service`
4. Enter feature: `payment-service-stripe-integration`
5. AI generates spec with:
   - API contract (POST /api/payments/create)
   - Events (payment.created, payment.failed)
   - Dependencies (User Service, Order Service)
   - Stripe integration points

**Plan.md Additions:**
- Service discovery and load balancing
- API gateway routing
- Event bus topology
- Contract testing strategy (Pact, OpenAPI validation)

**Best for:**
- Payment services
- User services
- Notification services
- Independent bounded contexts

---

## 📊 Enhanced Validation & Quality Metrics

SpecLens provides comprehensive validation to ensure your spec-driven development is on track.

### Feature 1: Spec Completeness Scoring

Get a 0-100% score on your spec quality with detailed breakdown:

```
Command: SpecLens: 📊 Show Validation Report

Spec Completeness: 85% (Grade B)
✓ Overview Section (10 pts)
✓ Goals Section (10 pts)
✓ User Stories (15 pts)
✓ Success Metrics (15 pts)
✓ Technical Requirements (15 pts)
✗ Data Model (0/10 pts) ← Missing
✓ Out of Scope (10 pts)
✓ Security Considerations (15 pts)

Suggestion: Add data models (TypeScript interfaces, SQL schemas)
```

**Scoring Criteria:**
- **Overview** (10 pts): Clear 2-3 sentence summary
- **Goals** (10 pts): What you're trying to achieve
- **User Stories** (15 pts): As a [user], I want [action]...
- **Success Metrics** (15 pts): Measurable, quantifiable goals
- **Technical Requirements** (15 pts): Functional + non-functional
- **Data Model** (10 pts): TypeScript/SQL definitions
- **Out of Scope** (10 pts): What you're NOT building
- **Security** (15 pts): Auth, encryption, CSRF, XSS protection

**Grades:**
- **A (90-100%)**: Production-ready spec
- **B (80-89%)**: Good spec, minor improvements needed
- **C (70-79%)**: Fair spec, address gaps
- **D (60-69%)**: Incomplete spec, major work needed
- **F (<60%)**: Missing critical sections

### Feature 2: Plan-to-Spec Traceability

Ensure your implementation plan aligns with your approved spec:

```
Plan-to-Spec Alignment: 80%

✓ Tech Stack Defined (20 pts)
✓ Architecture Described (20 pts)
✗ Data Models Don't Match Spec (0/20 pts)
✓ Security Requirements Addressed (20 pts)
✓ Performance Requirements Addressed (20 pts)

Gaps:
- Plan missing User, Session models defined in spec
- Spec mentions OAuth but plan doesn't include OAuth setup

Warnings:
- Spec defines success metrics but plan lacks monitoring strategy
```

**What it checks:**
- Tech stack chosen and justified
- Architecture documented
- Data models match spec requirements
- Security requirements addressed in plan
- Performance requirements addressed in plan
- Spec goals referenced in plan
- Success metrics have measurement strategy

### Feature 3: Task Coverage Percentage

Track implementation progress across all tasks:

```
Task Coverage Dashboard

Total Tasks: 20
✅ Completed: 12 (60%)
🔄 In Progress: 2 (10%)
🚫 Blocked: 1 (5%)
📋 Pending: 5 (25%)

Progress: 70% (completed + in-progress)
Coverage: 60% (completed only)

Time Estimates:
Total: 55 hours
Completed: 33 hours
Remaining: 22 hours
```

**Metrics Provided:**
- Total task count
- Status breakdown (completed, in-progress, blocked, pending)
- Coverage percentage (% completed)
- Progress percentage (% started)
- Time estimates (total, completed, remaining)

### Interactive Validation Report

**Command:** `SpecLens: 📊 Show Validation Report`

Opens an interactive webview with:
- **Overall Health Badge**: Excellent / Good / Fair / Poor
- **Spec Completeness Score**: 0-100% with grade
- **Requirements Checklist**: Visual checklist of all sections
- **Traceability Analysis**: Plan-to-spec alignment percentage
- **Coverage Dashboard**: Task progress with charts
- **Critical Issues**: Highlighted problems to address
- **Recommendations**: Actionable suggestions

**Example Output:**
```
Overall Health: Good

Critical Issues:
❌ 1 task is blocked
⚠️ Data models in plan don't match spec

Recommendations:
💡 Add data models (TypeScript interfaces) to spec
💡 Include monitoring strategy for success metrics
💡 Unblock Task 8 before proceeding

Next Steps:
👍 You're on the right track. Address recommendations to reach Excellent status.
```

---

## 🍒 everything-copilot Integration (Optional)

Supercharge SpecLens with [everything-copilot](https://github.com/faizal13/everything-copilot) for specialized AI agents and cost optimization!

### Install everything-copilot

```bash
npx everything-copilot init
```

### Feature 1: Intelligent Agent Routing

SpecLens automatically routes tasks to specialized agents based on task type:

| Task Type | Agent | Model | Use Case |
|-----------|-------|-------|----------|
| Setup, Database, Architecture | `@architect` | Opus | Strategic decisions, schema design |
| Tests, TDD | `@tdd` | Sonnet | Write tests first, >90% coverage |
| E2E Testing | `@e2e` | Sonnet | Playwright/Cypress flows |
| Security, Auth, CSRF | `@security-reviewer` | Opus | OWASP Top 10, audit |
| Refactoring, Cleanup | `@refactor` | Sonnet | Code quality, SOLID |
| General Implementation | `@implement` | Sonnet | Feature development |

**Example:**
```
1. Open tasks.md
2. Click "Start Task" on "Write unit tests for password hashing"
3. SpecLens detects "test" → Routes to @tdd agent
4. Notification: "🤖 Routing to @tdd - Model: SONNET"
5. Copilot Chat opens with TDD specialist context
```

**Cost Optimization:**
- **With everything-copilot:** ~$1.20/M tokens (Opus 5%, Sonnet 35%, Haiku 60%)
- **Without:** ~$15/M tokens (all Opus)
- **Savings:** 92% cost reduction 💰

### Feature 2: Spec-as-Skill (Auto-Loading Context)

Embed your spec/plan/tasks as an auto-loading AI skill that triggers when editing related code.

**Setup:**
```
1. Complete spec.md and plan.md
2. Run: SpecLens: 🍒 Create AI Skill from Spec
3. Select feature: user-authentication
4. File pattern: src/auth/**
```

**Result:**
- Creates `.copilot-agents/skills/spec-user-authentication.md`
- Updates `.copilot-agents/config.json` with trigger
- Skill auto-loads when editing `src/auth/*.ts`

**Usage:**
```typescript
// src/auth/login.ts
// Ask Copilot: "What are the authentication requirements?"

// Copilot response (with spec context):
// "Based on the user-authentication spec:
// - Password hashing with bcrypt (cost factor 12)
// - Session management with JWT
// - CSRF protection required
// - Rate limiting: max 5 login attempts per 15min"
```

**Benefits:**
- ✅ Zero manual context copying
- ✅ AI responses aligned with approved spec
- ✅ Prevents implementation drift
- ✅ Works across the team (committed to repo)

---

## Quick Start

### 1. Install Dependencies
```bash
npm install
npm run build
```

### 2. Launch Extension
Press `F5` in VS Code to open the Extension Development Host.

### 3. Create Your First Spec
```bash
mkdir -p specs/my-feature
touch specs/my-feature/spec.md
touch specs/my-feature/plan.md
touch specs/my-feature/tasks.md
```

---

## Spec Kit Format Guide

SpecLens follows the **GitHub Spec Kit convention**. Here's what each file does:

### `spec.md` - The Requirements Document

This is **what** you're building and **why**. Think of it as your PRD (Product Requirements Document).

<details>
<summary>📄 Example: User Authentication Spec</summary>

```markdown
# Spec: User Authentication System

## Overview
Add secure user authentication with email/password login, OAuth (Google, GitHub), and session management.

## Goals
- Enable users to create accounts and log in securely
- Support multiple authentication methods (email, OAuth)
- Maintain secure session state across requests

## Non-Goals
- Multi-factor authentication (future enhancement)
- Enterprise SSO (not in scope)

## User Stories

### As a new user
- I want to sign up with my email so I can create an account
- I want to sign up with Google/GitHub so I can skip manual registration
- I want to verify my email to ensure account security

### As a returning user
- I want to log in with my credentials so I can access my account
- I want to reset my password if I forget it

## Success Metrics
- 90%+ of new users complete signup within 2 minutes
- Login success rate > 95%
- Zero plain-text passwords in database

## Technical Requirements

### Security
- Password hashing with bcrypt (cost factor 12+)
- HTTPS-only secure cookies
- CSRF protection
- Rate limiting (max 5 login failures per 15min)

### Performance
- Login response time < 200ms (p95)
- Support 1000+ concurrent users

### Data Model
\`\`\`typescript
interface User {
  id: string;
  email: string;
  passwordHash?: string;
  emailVerified: boolean;
  oauthProviders: ('google' | 'github')[];
}
\`\`\`

## References
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/...)
```

</details>

---

### `plan.md` - The Implementation Plan

This is **how** you're going to build it. Architecture, tech stack, data flow.

<details>
<summary>📐 Example: User Authentication Plan</summary>

```markdown
# Implementation Plan: User Authentication

## Architecture

\`\`\`
┌─────────┐    ┌──────────┐    ┌──────────┐
│ Browser │───▶│ API      │───▶│ Database │
│         │◀───│ (Express)│◀───│(Postgres)│
└─────────┘    └──────────┘    └──────────┘
                     │
                     ▼
              ┌────────────┐
              │OAuth (G/GH)│
              └────────────┘
\`\`\`

## Technology Decisions

### Backend
- **Framework**: Express.js
- **Password Hashing**: bcrypt (work factor 12)
- **Session Storage**: PostgreSQL (ACID guarantees)
- **OAuth**: Passport.js

**Why not JWT?** Server-side sessions allow instant logout.

### Database Schema
\`\`\`sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  email_verified BOOLEAN DEFAULT false
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  token_hash VARCHAR(255),
  expires_at TIMESTAMP
);
\`\`\`

## Security Measures
- Secure cookies: `HttpOnly`, `Secure`, `SameSite=Strict`
- Rate limiting: 5 attempts per 15min per IP
- CSRF tokens on all mutations

## Data Flow

### Login Flow
1. User submits email + password
2. Rate limit check
3. Fetch user by email
4. Verify password with bcrypt
5. Create session + set cookie
6. Return user data

## Testing Strategy
- Unit tests: password hashing, session validation
- Integration tests: full login/signup flows
- Security tests: SQL injection, CSRF protection
```

</details>

---

### `tasks.md` - The Task Breakdown

This is the **work items** - incremental tasks with clear acceptance criteria.

<details>
<summary>✅ Example: User Authentication Tasks</summary>

```markdown
# Tasks: User Authentication

## Task 1: Database Schema (Priority: high | Est: 4h)

**Status:** TODO

**Implementation Steps:**
1. Create migration file `001_create_auth_tables.sql`
2. Define users, sessions, oauth_connections tables
3. Add indexes on token_hash, user_id
4. Test migration up/down

**Acceptance Criteria:**
- [ ] Migration runs on fresh database
- [ ] Indexes created correctly
- [ ] Foreign keys enforce integrity
- [ ] Rollback works

**Dependencies:** None

---

## Task 2: User Model & Password Hashing (Priority: high | Est: 3h)

**Status:** TODO

**Implementation Steps:**
1. Create `models/User.ts`
2. Implement `User.create(email, password)` with bcrypt
3. Implement `User.findByEmail()`
4. Implement `User.verifyPassword()`
5. Write unit tests

**Acceptance Criteria:**
- [ ] Passwords hashed with bcrypt work factor 12+
- [ ] Plain-text passwords never stored
- [ ] All tests pass (100% coverage)

**Dependencies:** Task 1

---

## Task 3: Login Endpoint (Priority: high | Est: 3h)

**Status:** TODO

**Implementation Steps:**
1. Create POST `/api/auth/login` route
2. Apply rate limiter (5 attempts/15min)
3. Verify password
4. Create session
5. Set secure cookie

**Acceptance Criteria:**
- [ ] Returns 401 for invalid credentials
- [ ] Rate limiter blocks after 5 failures
- [ ] Session cookie has HttpOnly, Secure flags
- [ ] Integration test passes

**Dependencies:** Task 2
```

</details>

---

## How SpecLens Enhances Spec Kit Workflows

| Without SpecLens | With SpecLens |
|-----------------|---------------|
| Manual file navigation | **Tree view** - Click to open any spec |
| No validation | **Live diagnostics** - Catch broken references |
| Copy/paste tasks to AI | **CodeLens buttons** - One-click task routing |
| Hardcoded to Copilot | **Agent-agnostic** - Works with Claude, Cursor too |
| Plain markdown | **Interactive controls** - Start/Complete/Block tasks |

---

## Configuration

### Agent Preference

By default, SpecLens auto-detects available agents (priority: Claude > Copilot > Cursor). Override in settings:

```json
{
  "speclens.preferredAgent": "claude"  // "auto" | "copilot" | "claude" | "cursor"
}
```

---

## Folder Structure

SpecLens works with the standard Spec Kit layout:

```
your-project/
├── specs/
│   ├── feature-a/
│   │   ├── spec.md      ← Requirements (what & why)
│   │   ├── plan.md      ← Architecture (how)
│   │   └── tasks.md     ← Work items (incremental steps)
│   └── feature-b/
│       ├── spec.md
│       ├── plan.md
│       └── tasks.md
└── .vscode/
    └── settings.json
```

Each feature gets its own branch folder under `specs/`.

---

## Why Spec-Driven Development?

1. **AI works better with context** - Specs give AI the full picture before coding
2. **Prevents rework** - Align on the plan before implementation
3. **Better code reviews** - Reviewers can see if code matches spec
4. **Documentation that stays updated** - Specs live with the code
5. **Onboarding** - New devs read specs to understand why code exists

---

## Comparison to Similar Tools

| Tool | Type | Spec Format | IDE Support | Agent Support |
|------|------|-------------|-------------|---------------|
| **GitHub Spec Kit** | CLI | `specs/` folder | None | Copilot only |
| **AWS Kiro IDE** | IDE fork | Custom | Built-in | Amazon Q only |
| **Google BMAD** | Framework | Custom | None | Gemini only |
| **SpecLens** | VS Code Extension | Spec Kit compatible | ✅ Full | ✅ Any (Copilot/Claude/Cursor) |

SpecLens is the **only** VS Code extension that brings IDE-level support to Spec Kit workflows.

---

## Roadmap

- [x] **Phase 1**: Modular architecture refactor
- [x] **Phase 2**: Spec Kit format adapter
- [x] **Phase 3**: Agent-agnostic task routing
- [ ] **Phase 4**: VS Code Marketplace publish
- [ ] **Phase 5**: Traceability matrix webview
- [ ] **Phase 6**: Spec drift detection

---

## Testing

See [TESTING-GUIDE.md](./TESTING-GUIDE.md) for comprehensive step-by-step testing instructions with 6 detailed scenarios:
- Feature Development (BA→Spec→Plan→Tasks→Implementation)
- Bug Fix in Production
- Microservice Development
- Context Documents
- everything-copilot Integration
- No AI Agent (graceful degradation)

---

## Contributing

SpecLens is in active development. We welcome contributions! See [CLAUDE.md](./CLAUDE.md) for development guidelines.

---

## License

MIT

---

## Acknowledgments

Inspired by:
- [GitHub Spec Kit](https://github.com/github/spec-kit) - File conventions for spec-driven dev
- [AWS Kiro IDE](https://kiro.dev/) - Spec-driven IDE
- [Google BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD) - Enterprise AI dev framework
