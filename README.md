# SpecLens

**The visual layer for Spec-Driven Development.**

SpecLens brings your specs to life inside VS Code — live diagnostics, inline CodeLens task controls, dependency enforcement, change tracking, traceability matrix, kanban board, and AI-powered spec authoring. Works seamlessly with [GitHub Spec Kit](https://github.com/github/spec-kit) and any AI coding agent (Copilot, Claude Code, Cursor).

---

## Features at a Glance

| Category | Feature |
|----------|---------|
| **Spec Authoring** | BA notes → formal spec, plan generation, task breakdown |
| **Task Lifecycle** | Start / Complete / Block / Restart with dependency enforcement |
| **Change Tracking** | Git-based file tracking per task; review before marking Done |
| **Validation** | Live diagnostics, spec completeness scoring, traceability |
| **Premium** | Traceability Matrix, Kanban Board, Spec Drift Detection |
| **Agent-Agnostic** | Copilot, Claude Code, Cursor — clipboard-first, never fails |

---

## Quick Start

### 1 · Install SpecLens
Search for **SpecLens** in the VS Code Extensions panel, or install the `.vsix` directly:
```
Extensions → ... → Install from VSIX
```

### 2 · Open a project with specs
SpecLens activates automatically when it detects a `specs/` or `docs/requirements/` folder.

### 3 · Author your first spec
Open the Command Palette (`⌘⇧P`) and run:
```
SpecLens: 🧠 Elaborate BA Notes → Spec
```
Paste rough notes — SpecLens produces a structured spec with goals, user stories, success metrics, and technical requirements.

### 4 · Generate a plan and tasks
```
SpecLens: 🏗️ Generate Plan from Spec
SpecLens: 📋 Generate Tasks from Plan
```

### 5 · Execute tasks with AI
Open `specs/<feature>/tasks.md` — inline CodeLens buttons appear above each task:

```
🟡 PENDING | ⏱️ 2h | 📊 0% (0/5) | ✅ deps met
▶️ Start Task  |  🔁 Restart Task  |  🤖 Get AI Help
```

---

## Workflow

```
BA Notes
   │
   ▼  SpecLens: Elaborate Spec
specs/<feature>/spec.md
   │
   ▼  SpecLens: Generate Plan
specs/<feature>/plan.md
   │
   ▼  SpecLens: Generate Tasks
specs/<feature>/tasks.md
   │
   ▼  CodeLens: Start Task → AI Agent → Code changes
   │
   ▼  CodeLens: Complete (Review & Approve)
   │
   ✅  Task Done
```

---

## CodeLens Task Controls

Every task in `tasks.md` gets inline buttons that adapt to its current state:

| Status | Buttons shown |
|--------|--------------|
| **Pending** (deps met) | `▶️ Start Task` · `🔁 Restart Task` · `🤖 Get AI Help` |
| **Pending** (deps missing) | `⛔ Start Task (deps not met)` · `🔁 Restart Task` · `🤖 Get AI Help` |
| **In Progress** | `✅ Complete (Review & Approve)` · `🚫 Block` · `🔁 Restart Task` · `🤖 Get AI Help` · `📝 View Changes` |
| **Blocked** | `▶️ Unblock` · `🔁 Restart Task` · `🤖 Get AI Help` |
| **Done** | `🔄 Reopen` · `🔁 Restart Task` · `🤖 Get AI Help` · `📝 View Changes` |

### Dependency Enforcement
SpecLens reads the `**Dependencies:**` field in each task. If a task's dependencies are not yet Done, the Start button warns you and blocks execution.

### Single Active Task Rule
Only one task can be In Progress at a time. SpecLens warns (with the option to override) if you try to start a second task while one is already running.

### 🔁 Restart Task
Always available on every task regardless of status. Smart behaviour:
- **If code changes exist** since the last snapshot → sends a **Verify** prompt to your AI agent: *"Check if the acceptance criteria are already met — do NOT rewrite."*
- **If no changes exist** → behaves exactly like Start Task (full implementation mode).

### Change Tracking & Review Workflow
When you start a task, SpecLens records the current git commit hash. When you click **Complete**, a review webview opens showing every file that was modified, added, deleted, or newly created during the task. You must **Approve** before the task is marked Done.

---

## Premium Features

### 🔗 Traceability Matrix
`SpecLens: 🔗 Show Traceability Matrix`

Visual requirement-to-task mapping. Shows coverage %, gaps (requirements with no tasks), and orphaned tasks (tasks with no requirement). Filter by type, status, or coverage level.

### 📋 Kanban Board
`SpecLens: 📋 Show Kanban Board`

Drag-and-drop board with four columns: **Pending → In Progress → Blocked → Done**. Updates `tasks.md` on drop. Shows metrics: total hours, hours completed, remaining, % complete.

### 🔍 Spec Drift Detection
`SpecLens: 🔍 Detect Spec Drift`

Compares your spec against the actual codebase. Detects undocumented APIs, data models not in spec, security gaps, and out-of-scope code. Produces a drift score (0–100) with a filterable report.

### 📊 Validation Report
`SpecLens: 📊 Show Validation Report`

Interactive dashboard per feature showing spec completeness score (A–F grade), plan-to-spec traceability alignment, task coverage %, critical issues, and actionable recommendations.

---

## AI Agent Integration

SpecLens works with any AI coding agent:

```json
"speclens.preferredAgent": "auto"
// Options: "auto" | "copilot" | "claude" | "cursor" | "none"
```

**Auto mode** priority: Claude Code → GitHub Copilot → Cursor.

The task prompt is **always copied to clipboard first** as a guaranteed fallback, so routing never silently fails even if agent APIs change between versions.

---

## Spec Kit Format

SpecLens auto-detects [GitHub Spec Kit](https://github.com/github/spec-kit) format:

```
specs/
  <feature>/
    spec.md        ← Requirements & goals
    plan.md        ← Architecture & implementation plan
    tasks.md       ← Task breakdown with status, deps, criteria
```

Both `specs/` (Spec Kit) and `docs/` (legacy) formats are supported simultaneously.

---

## Commands

All commands available from `⌘⇧P` / `Ctrl⇧P`:

**Spec Authoring:** Elaborate Spec · Generate Plan · Generate Tasks · Document Bug Fix

**Task Management:** Start · Complete · Restart · Block · Unblock · View Changes · Get AI Help

**Validation & Reports:** Validate Workspace · Validation Report · Traceability Matrix · Kanban Board · Detect Spec Drift

---

## Requirements

- VS Code 1.90.0 or later
- A `specs/` or `docs/requirements/` folder in your workspace
- An AI coding agent (GitHub Copilot, Claude Code, or Cursor) for task execution

---

## License

MIT
