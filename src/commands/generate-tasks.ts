import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Generate tasks.md from an approved plan.md
 *
 * This command takes a completed implementation plan and breaks it down
 * into incremental, testable tasks with acceptance criteria.
 * Tasks can then be executed one-by-one using CodeLens buttons.
 */
export async function generateTasksFromPlan(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Step 1: Find all plan.md files in specs/ folder
  const planFiles = await vscode.workspace.findFiles('specs/*/plan.md');

  if (planFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No plan.md files found. Create a plan first using "Generate Plan from Spec"'
    );
    return;
  }

  // Step 2: Let user select which plan to generate tasks from
  let selectedPlanUri: vscode.Uri;

  if (planFiles.length === 1) {
    selectedPlanUri = planFiles[0];
  } else {
    const items = planFiles.map(uri => {
      const featureName = path.basename(path.dirname(uri.fsPath));
      return {
        label: featureName,
        description: uri.fsPath,
        uri: uri
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a plan to generate tasks from',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedPlanUri = selected.uri;
  }

  // Step 3: Read the plan.md content
  const planContent = await vscode.workspace.fs.readFile(selectedPlanUri);
  const planText = Buffer.from(planContent).toString('utf8');

  // Step 4: Read the spec.md content (for context)
  const featureFolder = path.dirname(selectedPlanUri.fsPath);
  const featureName = path.basename(featureFolder);
  const specUri = vscode.Uri.file(path.join(featureFolder, 'spec.md'));

  let specText = '';
  try {
    const specContent = await vscode.workspace.fs.readFile(specUri);
    specText = Buffer.from(specContent).toString('utf8');
  } catch {
    // spec.md doesn't exist, continue without it
  }

  // Step 5: Determine tasks.md path
  const tasksUri = vscode.Uri.file(path.join(featureFolder, 'tasks.md'));

  // Step 6: Check if tasks.md already exists
  try {
    await vscode.workspace.fs.stat(tasksUri);
    const overwrite = await vscode.window.showWarningMessage(
      `tasks.md already exists for "${featureName}". Regenerate?`,
      'Yes', 'No'
    );
    if (overwrite !== 'Yes') {
      return;
    }
  } catch {
    // File doesn't exist, continue
  }

  // Step 7: Build AI prompt for tasks generation
  const prompt = buildTasksPrompt(specText, planText, featureName);

  // Step 8: Route to AI agent
  vscode.window.showInformationMessage(
    `📋 Generating tasks for "${featureName}"...`
  );

  const success = await routeToAgent(prompt);

  if (success) {
    vscode.window.showInformationMessage(
      `✅ AI agent opened! Review the generated tasks and save to:\n${tasksUri.fsPath}\n\nThen use CodeLens "Start Task" buttons to execute!`
    );
  }
}

/**
 * Build the AI prompt for tasks generation
 */
function buildTasksPrompt(specText: string, planText: string, featureName: string): string {
  const specSection = specText ? `**APPROVED SPEC:**
\`\`\`markdown
${specText}
\`\`\`

` : '';

  return `You are a technical project manager breaking down an implementation plan into executable tasks.

**CONTEXT:**
The team has approved a plan.md for "${featureName}". Your job is to:
1. Read the plan thoroughly
2. Break it into small, incremental tasks (2-4 hours each)
3. Define clear acceptance criteria for each task
4. Order tasks by dependencies
5. Create a tasks.md file that developers can execute one-by-one

${specSection}**APPROVED PLAN:**
\`\`\`markdown
${planText}
\`\`\`

**YOUR TASK:**
Create a comprehensive tasks.md following GitHub Spec Kit format:

\`\`\`markdown
# Tasks: ${featureName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

## Task List

### ✅ Completed Tasks
<!-- Completed tasks will appear here automatically -->

### 🚧 In Progress
<!-- Current task will appear here -->

### 📋 Pending Tasks

---

## Task 1: Set up project structure and dependencies

**Status:** pending

**Description:**
Initialize the project with the tech stack defined in plan.md. Install dependencies, configure TypeScript, set up linting, and create folder structure.

**Acceptance Criteria:**
- [ ] TypeScript configured (tsconfig.json with strict mode)
- [ ] ESLint + Prettier configured
- [ ] Folder structure created (src/, tests/, prisma/)
- [ ] Core dependencies installed (see plan.md tech stack)
- [ ] npm run dev starts successfully
- [ ] npm run build completes without errors

**Estimated Time:** 2 hours

**Dependencies:** None

**Files to Create/Modify:**
- package.json
- tsconfig.json
- .eslintrc.js
- src/index.ts
- README.md (setup instructions)

---

## Task 2: Set up database schema and migrations

**Status:** pending

**Description:**
Create Prisma schema based on the data models in plan.md. Set up database connection, create initial migration, and add seed data for testing.

**Acceptance Criteria:**
- [ ] Prisma schema matches plan.md data models exactly
- [ ] Database migrations run successfully
- [ ] Seed script creates test users
- [ ] npx prisma studio opens and shows tables
- [ ] All indexes defined in plan.md are created
- [ ] Foreign keys and cascades configured

**Estimated Time:** 3 hours

**Dependencies:** Task 1

**Files to Create/Modify:**
- prisma/schema.prisma
- prisma/migrations/
- prisma/seed.ts

---

## Task 3: Implement password hashing utilities

**Status:** pending

**Description:**
Create utilities for secure password hashing using bcrypt. Include functions for hashing, verification, and validation. Write unit tests.

**Acceptance Criteria:**
- [ ] hashPassword(password: string) function with cost factor 12
- [ ] verifyPassword(password: string, hash: string) function
- [ ] Password strength validation (min 8 chars, complexity)
- [ ] Unit tests: hash uniqueness, verification success/failure
- [ ] Test coverage > 90% for password utilities
- [ ] No plain-text passwords logged or stored

**Estimated Time:** 2 hours

**Dependencies:** Task 1

**Files to Create/Modify:**
- src/utils/password.ts
- tests/utils/password.test.ts

---

## Task 4: Implement session token generation and validation

**Status:** pending

**Description:**
Create utilities for generating secure session tokens and validating them. Use crypto.randomBytes for token generation.

**Acceptance Criteria:**
- [ ] generateSessionToken() returns 32-byte random hex string
- [ ] createSession(userId: string) creates DB record with expiry
- [ ] validateSession(token: string) checks expiry and returns user
- [ ] deleteSession(token: string) invalidates session
- [ ] Unit tests for token uniqueness and validation
- [ ] Test coverage > 90%

**Estimated Time:** 2 hours

**Dependencies:** Task 2

**Files to Create/Modify:**
- src/utils/session.ts
- tests/utils/session.test.ts

---

## Task 5: Build POST /api/auth/signup endpoint

**Status:** pending

**Description:**
Create signup endpoint with email/password registration. Validate input, hash password, create user record, generate session, return session cookie.

**Acceptance Criteria:**
- [ ] POST /api/auth/signup accepts { email, password }
- [ ] Input validation: valid email, password strength
- [ ] Duplicate email returns 409 Conflict
- [ ] Password hashed with bcrypt (cost 12)
- [ ] User record created in database
- [ ] Session token generated and returned as httpOnly cookie
- [ ] Response includes { user: { id, email } }
- [ ] Integration test: successful signup flow
- [ ] Integration test: duplicate email error

**Estimated Time:** 3 hours

**Dependencies:** Task 3, Task 4

**Files to Create/Modify:**
- src/routes/auth/signup.ts
- tests/routes/auth/signup.test.ts

---

## Task 6: Build POST /api/auth/login endpoint

**Status:** pending

**Description:**
Create login endpoint with email/password authentication. Verify credentials, generate session, implement rate limiting.

**Acceptance Criteria:**
- [ ] POST /api/auth/login accepts { email, password }
- [ ] Email validation (exists in database)
- [ ] Password verification (bcrypt)
- [ ] Invalid credentials return 401 Unauthorized
- [ ] Rate limiting: max 5 attempts per 15min per IP
- [ ] Session token generated and returned as httpOnly cookie
- [ ] Response includes { user: { id, email } }
- [ ] Integration test: successful login
- [ ] Integration test: invalid credentials
- [ ] Integration test: rate limiting triggers

**Estimated Time:** 3 hours

**Dependencies:** Task 3, Task 4

**Files to Create/Modify:**
- src/routes/auth/login.ts
- src/middleware/rate-limit.ts
- tests/routes/auth/login.test.ts

---

## Task 7: Build authentication middleware

**Status:** pending

**Description:**
Create middleware to protect authenticated routes. Extract session token from cookie, validate session, attach user to request object.

**Acceptance Criteria:**
- [ ] requireAuth middleware checks session cookie
- [ ] Invalid/missing token returns 401 Unauthorized
- [ ] Expired session returns 401 and deletes cookie
- [ ] Valid session attaches user to request (req.user)
- [ ] Middleware is reusable across routes
- [ ] Unit tests for auth success and failure cases

**Estimated Time:** 2 hours

**Dependencies:** Task 4

**Files to Create/Modify:**
- src/middleware/auth.ts
- tests/middleware/auth.test.ts

---

## Task 8: Build GET /api/auth/me endpoint

**Status:** pending

**Description:**
Create endpoint to get current authenticated user. Protected route using auth middleware.

**Acceptance Criteria:**
- [ ] GET /api/auth/me requires authentication
- [ ] Returns current user: { id, email, emailVerified }
- [ ] Unauthenticated request returns 401
- [ ] Integration test: authenticated request succeeds
- [ ] Integration test: unauthenticated request fails

**Estimated Time:** 1 hour

**Dependencies:** Task 7

**Files to Create/Modify:**
- src/routes/auth/me.ts
- tests/routes/auth/me.test.ts

---

## Task 9: Build POST /api/auth/logout endpoint

**Status:** pending

**Description:**
Create logout endpoint that invalidates session and clears cookie.

**Acceptance Criteria:**
- [ ] POST /api/auth/logout requires authentication
- [ ] Deletes session from database
- [ ] Clears session cookie (set expiry to past)
- [ ] Returns 200 OK
- [ ] Integration test: logout invalidates session
- [ ] Integration test: subsequent requests fail with 401

**Estimated Time:** 1 hour

**Dependencies:** Task 7

**Files to Create/Modify:**
- src/routes/auth/logout.ts
- tests/routes/auth/logout.test.ts

---

## Task 10: Implement CSRF protection

**Status:** pending

**Description:**
Add CSRF protection middleware for state-changing requests (POST, PUT, DELETE). Use double-submit cookie pattern.

**Acceptance Criteria:**
- [ ] CSRF token generated on GET requests
- [ ] CSRF middleware validates token on POST/PUT/DELETE
- [ ] Missing/invalid token returns 403 Forbidden
- [ ] Token validation uses constant-time comparison
- [ ] Integration tests for CSRF protection

**Estimated Time:** 2 hours

**Dependencies:** Task 1

**Files to Create/Modify:**
- src/middleware/csrf.ts
- tests/middleware/csrf.test.ts

---

## Task 11: Build email verification system

**Status:** pending

**Description:**
Implement email verification with token-based confirmation. Send verification email on signup, verify token endpoint.

**Acceptance Criteria:**
- [ ] generateVerificationToken() creates unique token
- [ ] Signup sends verification email (via email service)
- [ ] POST /api/auth/verify validates token and marks email verified
- [ ] Expired tokens (24 hours) return error
- [ ] Integration test: full verification flow

**Estimated Time:** 3 hours

**Dependencies:** Task 5

**Files to Create/Modify:**
- src/services/email.ts
- src/routes/auth/verify.ts
- tests/routes/auth/verify.test.ts

---

## Task 12: Implement password reset flow

**Status:** pending

**Description:**
Add password reset functionality: request reset (email), verify reset token, update password.

**Acceptance Criteria:**
- [ ] POST /api/auth/reset-password sends reset email
- [ ] Reset token expires after 1 hour
- [ ] POST /api/auth/reset-password/confirm validates token + updates password
- [ ] Old password hash invalidated
- [ ] All existing sessions invalidated on reset
- [ ] Integration test: full reset flow

**Estimated Time:** 3 hours

**Dependencies:** Task 11

**Files to Create/Modify:**
- src/routes/auth/reset-password.ts
- tests/routes/auth/reset-password.test.ts

---

## Task 13: Add OAuth (Google) integration

**Status:** pending

**Description:**
Implement Google OAuth using next-auth or arctic. Handle OAuth callback, link accounts, create/login user.

**Acceptance Criteria:**
- [ ] GET /api/auth/google redirects to Google OAuth
- [ ] GET /api/auth/google/callback handles OAuth response
- [ ] New user created if email doesn't exist
- [ ] Existing user linked if email matches
- [ ] Session created on successful OAuth
- [ ] Integration test: OAuth flow (mocked)

**Estimated Time:** 4 hours

**Dependencies:** Task 5, Task 7

**Files to Create/Modify:**
- src/routes/auth/google.ts
- src/services/oauth.ts
- tests/routes/auth/google.test.ts

---

## Task 14: Add OAuth (GitHub) integration

**Status:** pending

**Description:**
Implement GitHub OAuth similar to Google OAuth.

**Acceptance Criteria:**
- [ ] GET /api/auth/github redirects to GitHub OAuth
- [ ] GET /api/auth/github/callback handles OAuth response
- [ ] Account linking works correctly
- [ ] Integration test: OAuth flow (mocked)

**Estimated Time:** 2 hours

**Dependencies:** Task 13

**Files to Create/Modify:**
- src/routes/auth/github.ts
- tests/routes/auth/github.test.ts

---

## Task 15: Build frontend signup form

**Status:** pending

**Description:**
Create React signup form with client-side validation, error handling, loading states.

**Acceptance Criteria:**
- [ ] Form fields: email, password, confirm password
- [ ] Client-side validation (Zod + React Hook Form)
- [ ] Password strength indicator
- [ ] Error messages for validation failures
- [ ] Loading state during submission
- [ ] Success: redirect to verification page
- [ ] OAuth buttons (Google, GitHub)

**Estimated Time:** 3 hours

**Dependencies:** Task 5

**Files to Create/Modify:**
- src/components/auth/SignupForm.tsx
- src/components/auth/PasswordStrength.tsx

---

## Task 16: Build frontend login form

**Status:** pending

**Description:**
Create React login form with validation, error handling, "Forgot password?" link.

**Acceptance Criteria:**
- [ ] Form fields: email, password
- [ ] Client-side validation
- [ ] Error messages for invalid credentials
- [ ] Loading state during submission
- [ ] Success: redirect to dashboard
- [ ] "Forgot password?" link
- [ ] OAuth buttons

**Estimated Time:** 2 hours

**Dependencies:** Task 6

**Files to Create/Modify:**
- src/components/auth/LoginForm.tsx

---

## Task 17: E2E tests for critical auth flows

**Status:** pending

**Description:**
Write Playwright E2E tests for signup, login, logout, OAuth flows.

**Acceptance Criteria:**
- [ ] E2E test: Signup → verify email → login → logout
- [ ] E2E test: Login with invalid credentials (shows error)
- [ ] E2E test: Password reset flow
- [ ] E2E test: OAuth login (mocked)
- [ ] All tests pass in CI
- [ ] Screenshots captured on failure

**Estimated Time:** 4 hours

**Dependencies:** Task 15, Task 16

**Files to Create/Modify:**
- tests/e2e/auth.spec.ts
- tests/e2e/fixtures/

---

## Task 18: Security audit and hardening

**Status:** pending

**Description:**
Run security scans, fix vulnerabilities, ensure OWASP Top 10 compliance.

**Acceptance Criteria:**
- [ ] npm audit shows 0 high/critical vulnerabilities
- [ ] Snyk scan passes
- [ ] Helmet.js middleware configured (CSP, HSTS, etc.)
- [ ] Rate limiting on all auth endpoints
- [ ] SQL injection prevented (ORM parameterized queries)
- [ ] XSS prevented (input sanitization + CSP)
- [ ] CSRF protection verified
- [ ] Security headers tested (securityheaders.com)

**Estimated Time:** 3 hours

**Dependencies:** Task 10

**Files to Create/Modify:**
- src/middleware/security.ts
- SECURITY.md

---

## Task 19: Performance testing and optimization

**Status:** pending

**Description:**
Load test with Artillery, optimize slow queries, add caching where needed.

**Acceptance Criteria:**
- [ ] Artillery test: 1000 concurrent users
- [ ] Login response time < 200ms (p95)
- [ ] Signup response time < 300ms (p95)
- [ ] Database queries optimized (EXPLAIN ANALYZE)
- [ ] Connection pooling configured (max 10)
- [ ] Redis caching for user sessions (optional)
- [ ] Performance report generated

**Estimated Time:** 3 hours

**Dependencies:** Task 6, Task 8

**Files to Create/Modify:**
- tests/load/artillery.yml
- docs/performance-report.md

---

## Task 20: CI/CD pipeline and deployment

**Status:** pending

**Description:**
Set up GitHub Actions for automated testing, linting, building, and deployment.

**Acceptance Criteria:**
- [ ] GitHub Actions workflow: lint, test, build
- [ ] Tests run on every PR
- [ ] Auto-deploy to staging on main branch merge
- [ ] Database migrations run on deploy
- [ ] Environment variables configured
- [ ] Health check endpoint (GET /health)
- [ ] Monitoring configured (Sentry/Axiom)

**Estimated Time:** 3 hours

**Dependencies:** Task 17, Task 18

**Files to Create/Modify:**
- .github/workflows/ci.yml
- .github/workflows/deploy.yml
- src/routes/health.ts

---

## Summary

**Total Tasks:** 20
**Estimated Time:** ~55 hours (~7 days for 1 developer)

**Dependencies Flow:**
1. Task 1 (setup) → Task 2, 3, 10
2. Task 2 (database) → Task 4
3. Task 3, 4 → Task 5, 6
4. Task 4 → Task 7
5. Task 7 → Task 8, 9
6. Task 5 → Task 11, 15
7. Task 11 → Task 12
8. Task 5, 7 → Task 13
9. Task 13 → Task 14
10. Task 6 → Task 16
11. Task 15, 16 → Task 17
12. Task 10 → Task 18
13. Task 17, 18 → Task 20

**Critical Path:** Task 1 → 2 → 4 → 7 → Tasks in parallel → 17 → 20

**How to Execute:**
1. Start with Task 1
2. Use CodeLens "Start Task" buttons in this file
3. Each task opens AI agent with full context
4. Complete acceptance criteria before moving to next task
5. Update task status (pending → in-progress → completed)
\`\`\`

**IMPORTANT GUIDELINES:**
1. Each task should be 2-4 hours (no larger tasks)
2. Every task must have clear, testable acceptance criteria
3. Tasks must be ordered by dependencies
4. Include test writing in each task (TDD approach)
5. First task is always project setup
6. Last task is always deployment
7. Security tasks should be explicit (CSRF, rate limiting, etc.)
8. Include both unit tests and integration tests
9. Add E2E tests for critical flows
10. Estimate time realistically (include testing time)

**OUTPUT:**
Generate the tasks.md content. Each task will be executed one-by-one using CodeLens buttons in VS Code.`;
}

/**
 * Route to the preferred AI agent with the tasks generation prompt
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
