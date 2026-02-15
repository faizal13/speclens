import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Document a bug and create a fix plan
 *
 * This command helps developers document production bugs, analyze root causes,
 * and create structured fix plans with tasks. Designed for quick turnaround
 * on critical issues.
 */
export async function documentBugFix(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Step 1: Get bug description
  const bugDescription = await vscode.window.showInputBox({
    prompt: 'Describe the bug (what\'s broken and how it manifests)',
    placeHolder: 'e.g., "Users can\'t reset password - getting 500 error on /api/auth/reset"',
    ignoreFocusOut: true,
    validateInput: (value) => {
      if (!value || value.trim().length < 15) {
        return 'Please provide a clear bug description (15+ characters)';
      }
      return undefined;
    }
  });

  if (!bugDescription) {
    return; // User cancelled
  }

  // Step 2: Get severity level
  const severity = await vscode.window.showQuickPick([
    { label: '🔴 Critical', value: 'critical', description: 'Production down, data loss, security breach' },
    { label: '🟠 High', value: 'high', description: 'Major feature broken, affects many users' },
    { label: '🟡 Medium', value: 'medium', description: 'Feature partially broken, workaround exists' },
    { label: '🟢 Low', value: 'low', description: 'Minor issue, cosmetic, edge case' }
  ], {
    placeHolder: 'Select bug severity',
    ignoreFocusOut: true
  });

  if (!severity) {
    return; // User cancelled
  }

  // Step 3: Get reproduction steps (optional)
  const reproSteps = await vscode.window.showInputBox({
    prompt: 'Steps to reproduce (optional - press Enter to skip)',
    placeHolder: 'e.g., "1. Go to /reset-password 2. Enter email 3. Click submit 4. See 500 error"',
    ignoreFocusOut: true
  });

  // Step 4: Get error message/stack trace (optional)
  const errorMessage = await vscode.window.showInputBox({
    prompt: 'Error message or stack trace (optional - press Enter to skip)',
    placeHolder: 'e.g., "TypeError: Cannot read property \'email\' of undefined at resetPassword.ts:42"',
    ignoreFocusOut: true
  });

  // Step 5: Generate bug ID (bugfix-YYYY-XXXX format)
  const bugId = generateBugId();

  // Step 6: Check if specs folder exists
  const specsUri = vscode.Uri.joinPath(ws.uri, 'specs');
  try {
    await vscode.workspace.fs.stat(specsUri);
  } catch {
    await vscode.workspace.fs.createDirectory(specsUri);
  }

  // Step 7: Create bugfix folder
  const bugfixUri = vscode.Uri.joinPath(specsUri, bugId);
  await vscode.workspace.fs.createDirectory(bugfixUri);

  // Step 8: Build AI prompt for bug documentation
  const prompt = buildBugFixPrompt({
    bugId,
    description: bugDescription,
    severity: severity.value,
    reproSteps: reproSteps || '',
    errorMessage: errorMessage || ''
  });

  // Step 9: Route to AI agent
  vscode.window.showInformationMessage(
    `🐛 Documenting bug "${bugId}"...`
  );

  const success = await routeToAgent(prompt);

  if (success) {
    const specPath = path.join(bugfixUri.fsPath, 'spec.md');
    const planPath = path.join(bugfixUri.fsPath, 'plan.md');
    const tasksPath = path.join(bugfixUri.fsPath, 'tasks.md');

    vscode.window.showInformationMessage(
      `✅ AI agent opened! Review and save:\n` +
      `1. Bug analysis → ${specPath}\n` +
      `2. Fix plan → ${planPath}\n` +
      `3. Fix tasks → ${tasksPath}`
    );
  }
}

/**
 * Generate a bug ID in format: bugfix-YYYY-XXXX
 */
function generateBugId(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random
  return `bugfix-${year}-${random}`;
}

interface BugContext {
  bugId: string;
  description: string;
  severity: string;
  reproSteps: string;
  errorMessage: string;
}

/**
 * Build comprehensive AI prompt for bug documentation and fix planning
 */
function buildBugFixPrompt(bug: BugContext): string {
  const reproSection = bug.reproSteps ? `
**REPRODUCTION STEPS:**
${bug.reproSteps}
` : '';

  const errorSection = bug.errorMessage ? `
**ERROR MESSAGE/STACK TRACE:**
\`\`\`
${bug.errorMessage}
\`\`\`
` : '';

  return `You are a senior developer helping to document and fix a production bug.

**CONTEXT:**
A ${bug.severity} severity bug has been reported. Your job is to:
1. Document the bug thoroughly
2. Hypothesize root causes (or investigate if you have access to code)
3. Create a fix plan
4. Generate actionable tasks for fixing it

**BUG REPORT:**
**ID:** ${bug.bugId}
**Severity:** ${bug.severity}
**Description:** ${bug.description}
${reproSection}${errorSection}

**YOUR TASK:**
Create THREE documents for this bug fix:

---

## 1. spec.md - Bug Documentation

\`\`\`markdown
# Bug: ${bug.bugId}

## Summary
[1-2 sentence description of what's broken]

## Severity
**${bug.severity.toUpperCase()}** - [Explain impact: how many users affected, data loss risk, etc.]

## Current Behavior (Broken)
- [What happens now when users try to use the feature]
- [Specific error messages or symptoms]

## Expected Behavior (Correct)
- [What should happen instead]
- [How the feature is supposed to work]

## Reproduction Steps
${bug.reproSteps || '1. [Step 1]\n2. [Step 2]\n3. [Observe error]'}

## Error Details
${bug.errorMessage || '[Error message, stack trace, logs]'}

## Impact Assessment
- **Users Affected:** [Estimate: all users, logged-in users, 10%, etc.]
- **Business Impact:** [Revenue loss, reputation damage, SLA breach, etc.]
- **Workaround Available:** [Yes/No - describe if yes]
- **Data Integrity Risk:** [Can this corrupt data? Yes/No]

## Root Cause Hypothesis
[Based on error message and symptoms, what is the likely root cause?]
- **Primary hypothesis:** [Most likely cause]
- **Alternative hypotheses:** [Other possibilities]
- **Investigation needed:** [What to check to confirm]

## Related Issues
- [Link to similar bugs, related PRs, or past incidents]

## Success Criteria for Fix
- [ ] Bug no longer reproducible in local dev
- [ ] Regression test added (fails before fix, passes after)
- [ ] No new errors introduced
- [ ] Fix deployed to production
- [ ] Monitoring confirms error rate dropped to zero
\`\`\`

---

## 2. plan.md - Fix Implementation Plan

\`\`\`markdown
# Fix Plan: ${bug.bugId}

## Investigation Steps
1. **Reproduce locally**
   - Set up local environment matching production
   - Follow reproduction steps
   - Confirm error occurs

2. **Debug and identify root cause**
   - Add debug logging around suspect code
   - Inspect variables/state at failure point
   - Trace execution flow
   - Confirm root cause hypothesis

3. **Verify impact scope**
   - Check error monitoring (Sentry/logs) for frequency
   - Identify affected user segments
   - Check if related features are also broken

## Fix Approach

### Option 1: [Primary Fix] (Recommended)
**Description:** [How to fix the root cause]
**Pros:** [Why this is best]
**Cons:** [Downsides or risks]
**Implementation:**
- [Step 1: Code changes needed]
- [Step 2: Database migrations needed?]
- [Step 3: Configuration changes?]

### Option 2: [Alternative Fix]
**Description:** [Another way to fix it]
**Pros:** [Advantages]
**Cons:** [Why this is not recommended]

### Option 3: [Quick Workaround]
**Description:** [Temporary fix to stop the bleeding]
**Use Case:** Critical severity - deploy workaround immediately while working on proper fix

## Code Changes Required
\`\`\`typescript
// File: [path/to/file.ts]
// Current (broken):
function resetPassword(userId: string) {
  const user = users.find(u => u.id === userId);
  sendEmail(user.email, resetLink); // ❌ user might be undefined
}

// Fixed:
function resetPassword(userId: string) {
  const user = users.find(u => u.id === userId);
  if (!user) {
    throw new Error(\`User not found: \${userId}\`);
  }
  sendEmail(user.email, resetLink); // ✅ user is guaranteed to exist
}
\`\`\`

## Testing Strategy
- **Unit test:** Test the specific function that failed
- **Integration test:** Test the full endpoint/flow
- **Regression test:** Automated test that reproduces the bug (should fail before fix, pass after)
- **Manual testing:** QA checklist for verification

## Rollback Plan
**If fix introduces new issues:**
1. Revert PR/commit
2. Redeploy previous version
3. Re-investigate with more logging

## Deployment Strategy
- **Critical severity:** Hotfix branch → immediate deploy to prod → monitor
- **High severity:** Fast-track PR review → deploy within 24h
- **Medium/Low severity:** Normal PR process → next release cycle

## Monitoring & Verification
- **Metrics to watch:** [Error rate, success rate, latency]
- **Alerts to check:** [Specific alert that fired for this bug]
- **Success indicator:** [Error count drops to zero within 1 hour of deploy]
\`\`\`

---

## 3. tasks.md - Fix Execution Tasks

\`\`\`markdown
# Bug Fix Tasks: ${bug.bugId}

## Task List

---

## Task 1: Reproduce bug in local environment

**Status:** pending

**Description:**
Set up local dev environment matching production config. Follow the reproduction steps to confirm the bug occurs locally.

**Acceptance Criteria:**
- [ ] Local environment matches production (same dependencies, config, data)
- [ ] Bug reproduces reliably (same error message/behavior)
- [ ] Screenshot/logs captured showing the error
- [ ] Reproduction documented in spec.md if steps were unclear

**Estimated Time:** 30 minutes

**Dependencies:** None

---

## Task 2: Debug and identify root cause

**Status:** pending

**Description:**
Add debug logging, use debugger, and trace execution to identify the exact line of code causing the failure. Confirm root cause hypothesis from spec.md.

**Acceptance Criteria:**
- [ ] Root cause identified (specific line of code, logic error, data issue)
- [ ] Evidence collected (logs, screenshots, variable states)
- [ ] Root cause documented in plan.md
- [ ] Hypothesis from spec.md confirmed or updated

**Estimated Time:** 1 hour

**Dependencies:** Task 1

---

## Task 3: Implement the fix

**Status:** pending

**Description:**
Write code to fix the root cause. Follow the fix approach from plan.md. Ensure fix is minimal and focused (don't refactor unrelated code).

**Acceptance Criteria:**
- [ ] Code change implements the fix approach from plan.md
- [ ] Fix is minimal (only changes what's necessary)
- [ ] No unrelated refactoring or cleanup
- [ ] Code follows project style/conventions
- [ ] Comments added explaining why the bug occurred

**Estimated Time:** 1 hour

**Dependencies:** Task 2

---

## Task 4: Write regression test

**Status:** pending

**Description:**
Write an automated test that reproduces the bug. Test should FAIL on the old code and PASS with the fix.

**Acceptance Criteria:**
- [ ] Test reproduces the exact bug scenario
- [ ] Test fails on code before fix (verify this!)
- [ ] Test passes on code after fix
- [ ] Test is clear and maintainable (good naming, comments)
- [ ] Test added to CI pipeline

**Estimated Time:** 1 hour

**Dependencies:** Task 3

---

## Task 5: Manual testing and QA

**Status:** pending

**Description:**
Manually test the fix in local dev. Test both the specific bug scenario and related functionality to ensure no regressions.

**Acceptance Criteria:**
- [ ] Original bug scenario works correctly
- [ ] Related features still work (no regressions)
- [ ] Tested with different user roles/permissions
- [ ] Tested edge cases (empty data, null values, etc.)
- [ ] No console errors or warnings

**Estimated Time:** 30 minutes

**Dependencies:** Task 4

---

## Task 6: Deploy fix ${bug.severity === 'critical' || bug.severity === 'high' ? '(URGENT)' : ''}

**Status:** pending

**Description:**
${bug.severity === 'critical'
  ? 'CRITICAL: Deploy as hotfix immediately after PR approval. Monitor closely.'
  : bug.severity === 'high'
  ? 'HIGH: Fast-track PR review and deploy within 24 hours.'
  : 'Deploy through normal release process.'}

**Acceptance Criteria:**
- [ ] PR created with clear description linking to bug spec
- [ ] Code review completed (${bug.severity === 'critical' ? '1 approver minimum' : '2 approvers minimum'})
- [ ] All tests passing in CI
- [ ] Deployed to ${bug.severity === 'critical' || bug.severity === 'high' ? 'production' : 'staging first, then production'}
- [ ] Deployment logged/announced to team

**Estimated Time:** ${bug.severity === 'critical' ? '30 minutes' : '1 hour'}

**Dependencies:** Task 5

---

## Task 7: Monitor and verify fix

**Status:** pending

**Description:**
After deployment, monitor error rates, logs, and metrics to confirm the bug is fixed and no new issues were introduced.

**Acceptance Criteria:**
- [ ] Error rate for this bug dropped to zero (check logs/Sentry)
- [ ] No new errors introduced (check overall error rate)
- [ ] Success rate metrics back to normal
- [ ] No user reports of the issue for 24 hours
- [ ] Post-mortem notes added to spec.md if needed

**Estimated Time:** 2 hours (spread over 24h monitoring period)

**Dependencies:** Task 6

---

## Summary

**Total Tasks:** 7
**Estimated Time:** ${bug.severity === 'critical' ? '~6 hours (fast-track)' : '~7 hours'}
**Critical Path:** Task 1 → 2 → 3 → 4 → 5 → 6 → 7

**Urgency:** ${bug.severity === 'critical'
  ? '🔴 CRITICAL - Drop everything and fix immediately'
  : bug.severity === 'high'
  ? '🟠 HIGH - Prioritize above feature work'
  : bug.severity === 'medium'
  ? '🟡 MEDIUM - Fix in current sprint'
  : '🟢 LOW - Fix when convenient'}
\`\`\`

---

**IMPORTANT GUIDELINES:**
1. **Bug fixes should be fast** - Don't over-engineer, fix the issue
2. **Regression tests are mandatory** - Prevent the bug from coming back
3. **Monitor after deploy** - Bugs can have unexpected side effects
4. **Document root cause** - Help future developers understand what went wrong
5. **Critical bugs** - Hotfix immediately, proper process can wait
6. **Include rollback plan** - Always have a way to undo the fix

**OUTPUT:**
Generate all three documents (spec.md, plan.md, tasks.md). The developer will save them and execute tasks using CodeLens buttons.`;
}

/**
 * Route to the preferred AI agent
 */
async function routeToAgent(prompt: string): Promise<boolean> {
  try {
    const config = vscode.workspace.getConfiguration('speclens');
    const preferredAgent = config.get<string>('preferredAgent', 'auto');

    // Try Copilot
    if (preferredAgent === 'copilot' || preferredAgent === 'auto') {
      const copilotExtension = vscode.extensions.getExtension('GitHub.copilot-chat');
      if (copilotExtension) {
        await vscode.commands.executeCommand('workbench.action.chat.open', { query: prompt });
        return true;
      }
    }

    // Try Claude Code
    if (preferredAgent === 'claude' || preferredAgent === 'auto') {
      const commands = await vscode.commands.getCommands();
      if (commands.includes('claude.chat')) {
        await vscode.commands.executeCommand('claude.chat', prompt);
        return true;
      }
    }

    // Try Cursor
    if (preferredAgent === 'cursor' || preferredAgent === 'auto') {
      const commands = await vscode.commands.getCommands();
      if (commands.includes('composer.startComposerEdit')) {
        await vscode.commands.executeCommand('composer.startComposerEdit', { initialPrompt: prompt });
        return true;
      }
    }

    // No agent detected
    vscode.window.showWarningMessage(
      'No AI coding agent detected. Please install GitHub Copilot, Claude Code, or Cursor.',
      'Learn More'
    ).then(selection => {
      if (selection === 'Learn More') {
        vscode.env.openExternal(vscode.Uri.parse('https://github.com/faizal13/speclens#agent-support'));
      }
    });
    return false;

  } catch (e: any) {
    vscode.window.showErrorMessage(`Failed to open AI agent: ${e.message}`);
    return false;
  }
}
