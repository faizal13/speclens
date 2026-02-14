# SpecLens - VS Code Extension for Spec-Driven Development

## Project Overview
SpecLens (formerly RakDev AI) is a VS Code extension that provides the **visual layer** for Spec-Driven Development. It complements GitHub Spec Kit by adding live diagnostics, CodeLens task controls, traceability enforcement, tree views, and interactive task management that file-convention tools cannot deliver.

- **Public name**: SpecLens
- **Internal Rakbank name**: RakDev AI (rebrand via config when shipping internally)
- **Repo**: https://github.com/faizal13/speclens

## Tech Stack
- **Language**: TypeScript 5.4
- **Platform**: VS Code Extension API (>=1.90.0)
- **Dependencies**: js-yaml (YAML front-matter parsing)
- **AI Integration**: VS Code Language Model API (Copilot LLM, agent-agnostic planned)
- **Build**: `npm run build` (tsc), `npm run package` (vsce)

## Project Structure
```
src/
  extension.ts    -- Main extension (1635 lines, monolith - to be refactored)
  indexer.ts      -- Workspace document indexer (front-matter parsing)
  tree.ts         -- Tree data provider for explorer sidebar
docs/             -- Workflow guides and example documents
templates/        -- Document generation templates
snippets/         -- VS Code code snippets (requirement, design, task)
scripts/          -- CLI utilities (new.js for file scaffolding)
resources/        -- Icons and assets
dist/             -- Compiled JS output (gitignored)
```

## Key Concepts
- **Documents**: Markdown files with YAML front-matter in `docs/{requirements,designs,tasks}/`
- **ID Format**: REQ-YYYY-XXXX, DES-YYYY-XXXX, TASK-YYYY-XXXX
- **Workflow**: Requirement → Design → Task → Implementation (via Copilot Chat)
- **Validation**: Real-time diagnostics for missing fields, broken cross-references, status integrity

## Command Prefix
- Current: `rakdevAi.*` (to be migrated to `speclens.*`)
- Config: `rakdevAi.*` (to be migrated to `speclens.*`)

## Strategic Direction
Pivot from independent workflow to **Spec Kit companion**:
1. Add Spec Kit format compatibility (`specs/` folder alongside existing `docs/`)
2. Go agent-agnostic (detect Copilot/Claude/Cursor/etc.)
3. Add premium features: traceability matrix, Kanban task board, spec drift detection
4. Publish to VS Code Marketplace

## Implementation Phases

### Phase 0: Foundation (Current)
- [x] Rename to SpecLens, create GitHub repo, set up CLAUDE.md
- [ ] Clean up root-level documentation files (consolidate into docs/)

### Phase 1: Refactor Monolith
Split `src/extension.ts` (1,635 lines) into:
```
src/
  extension.ts          -- Activation & registration (~100 lines)
  core/                 -- indexer, validator, traceability
  providers/            -- tree, codelens, codeactions, statusbar
  commands/             -- create, generate, task-lifecycle
  formats/              -- rakdev parser, speckit parser, unified adapter
  agents/               -- copilot, agent-router
```

### Phase 2: Spec Kit Format Adapter
- Auto-detect `docs/` vs `specs/` (Spec Kit) vs both
- Parse `specs/[branch]/spec.md`, `plan.md`, `tasks.md`, `constitution.md`
- Unified indexing via FormatAdapter interface

### Phase 3: Agent-Agnostic Execution
- Detect Copilot Chat, Claude Code, Cursor composer
- Route task context to active agent
- `speclens.preferredAgent` setting

### Phase 4: Enhanced Validation
- Spec completeness scoring, plan-to-spec traceability, task coverage %

### Phase 5: Premium Features
- Traceability Matrix Webview, Kanban Task Board, Spec Drift Detection

### Phase 6: Publish to VS Code Marketplace + position as Spec Kit companion

### Command Prefix Migration
When ready, migrate `rakdevAi.*` → `speclens.*` as a single atomic step (bump to v1.0.0)

---

## Session Checkpoint Protocol

**CRITICAL**: When approaching session/context limits, Claude MUST follow this protocol:

### Before Session Ends
1. **Stop coding mid-file** - Do NOT leave files in a broken state
2. **Ensure compilable state** - Run `npm run build` and fix any errors
3. **Create a checkpoint commit** with message format:
   ```
   checkpoint: [brief description of what was done]

   NEXT STEPS:
   - [ ] First thing to do next
   - [ ] Second thing to do next
   - [ ] Any blockers or decisions needed

   CURRENT STATE:
   - What's working
   - What's partially done
   - What's not started yet

   FILES IN PROGRESS:
   - path/to/file.ts (what state it's in)
   ```
4. **Push to GitHub** so the checkpoint is accessible from any device
5. **Update the CHECKPOINT section below** with the latest state

### When Resuming
1. Read this CLAUDE.md first
2. Check `git log --oneline -5` for the latest checkpoint commit
3. Read the NEXT STEPS from the checkpoint commit message
4. Run `npm run build` to verify the code compiles
5. Continue from where the checkpoint left off

### Current Checkpoint
```
STATUS: Initial setup complete
PHASE: Pre-Phase 1 (monolith refactoring not yet started)
LAST ACTION: Created GitHub repo, renamed folder to speclens
NEXT:
- [ ] Phase 1: Refactor src/extension.ts monolith into modular files
- [ ] Phase 2: Add Spec Kit format adapter
- [ ] Phase 3: Agent-agnostic execution
BLOCKERS: None
```

---

## Coding Guidelines
- Keep changes minimal and focused - don't over-engineer
- Preserve existing functionality during refactoring
- Run `npm run build` after changes to verify compilation
- No unnecessary documentation files - use this CLAUDE.md and README.md only
- Command prefix migration (rakdevAi → speclens) should be done as a single atomic step
- Test the extension in VS Code Extension Development Host after significant changes
