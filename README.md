# SpecLens

**The premier VS Code companion for Spec-Driven Development.**

Live diagnostics, traceability enforcement, interactive task management, and AI-powered document generation - the visual layer that file-convention tools like GitHub Spec Kit don't provide.

> **Internal Rakbank name**: RakDev AI | **Public name**: SpecLens

## What It Does

SpecLens adds a rich IDE experience on top of spec-driven development workflows:

```
Requirement → Design → Task → Implementation
     ↑            ↑         ↑         ↑
  Validate    AI Generate  AI Break   Copilot Chat
  Live         from Req    from Des   with Context
```

## Key Features

### Already Implemented (v0.0.4)

1. **AI-Powered Design Generation** - Generates comprehensive designs from requirements via VS Code Language Model API
2. **AI-Powered Task Breakdown** - Generates structured task documents from designs
3. **Live Workspace Diagnostics** - Real-time validation for missing fields, broken cross-references, status integrity
4. **Interactive Task Buttons (CodeLens)** - Start, Complete, Block, Unblock, Reopen, Get Help, View Changes
5. **Tree View Explorer** - Groups documents by type (Requirements/Designs/Tasks) with click-to-open
6. **Status Bar Dashboard** - Live counts `R:X D:Y T:Z` with diagnostic warnings
7. **Code Actions** - Quick fixes for missing front-matter keys
8. **Document Scaffolding** - Commands and CLI to create requirement/design/task files
9. **Cross-Reference Validation** - Ensures design→requirement and task→requirement/design links are valid
10. **Traceability Enforcement** - Configurable requirement that designs must be approved before tasks

### Planned (Strategic Roadmap)

- **Spec Kit Format Compatibility** - Read/index `specs/` folder alongside existing `docs/` format
- **Agent-Agnostic Execution** - Detect and route to Copilot, Claude Code, Cursor, etc.
- **Traceability Matrix Webview** - Visual matrix of spec→plan→task coverage
- **Interactive Task Board** - Kanban-style webview with status management
- **Spec Drift Detection** - Flag when code changes diverge from specs
- **VS Code Marketplace Publishing**

## Quick Start

```bash
# Install dependencies
npm install

# Build
npm run build

# Launch in VS Code
# Press F5 to open Extension Development Host

# Package
npm run package
```

## Workflow

1. **Create Requirement** - `SpecLens: New Requirement` (fills problem, metrics, risks)
2. **Generate Design** - `SpecLens: Generate Design from Requirement` (AI-powered)
3. **Generate Tasks** - `SpecLens: Generate Tasks from Design` (AI-powered breakdown)
4. **Execute Tasks** - Click "Start Task" CodeLens button (opens Copilot Chat with context)
5. **Track Progress** - Status bar + Tree view + diagnostics

## Document Structure

```
docs/
  requirements/   REQ-YYYY-XXXX.md  (YAML front-matter: problem, metrics, risks)
  designs/        DES-YYYY-XXXX.md  (YAML: requirement link, decisions[])
  tasks/          TASK-YYYY-XXXX.md (YAML: requirement + design link, acceptance[])
```

## Prerequisites

- VS Code >= 1.90.0
- GitHub Copilot (for AI generation features)

## Market Context

This project is inspired by and aims to complement:
- **[GitHub Spec Kit](https://github.com/github/spec-kit)** - File-convention + CLI for spec-driven development (~70K stars)
- **[Kiro IDE](https://kiro.dev/)** - AWS's spec-driven IDE (VS Code fork)
- **[BMAD Method](https://github.com/bmad-code-org/BMAD-METHOD)** - Enterprise-scale AI-driven development framework

SpecLens fills the **visual/IDE gap** - Spec Kit has no UI, Kiro is proprietary, BMAD is heavyweight. SpecLens provides the diagnostics, traceability, and interactive task management that only a VS Code extension can deliver.

## License

MIT
