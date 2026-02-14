import * as vscode from 'vscode';
import * as path from 'path';

/**
 * Generate plan.md from an approved spec.md
 *
 * This command takes a completed spec (requirements) and generates
 * an implementation plan including architecture, tech stack, data models,
 * API design, and implementation phases.
 */
export async function generatePlanFromSpec(): Promise<void> {
  const ws = vscode.workspace.workspaceFolders?.[0];
  if (!ws) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }

  // Step 1: Find all spec.md files in specs/ folder
  const specFiles = await vscode.workspace.findFiles('specs/*/spec.md');

  if (specFiles.length === 0) {
    vscode.window.showErrorMessage(
      'No spec.md files found. Create a spec first using "Elaborate BA Notes → Spec"'
    );
    return;
  }

  // Step 2: Let user select which spec to generate plan from
  let selectedSpecUri: vscode.Uri;

  if (specFiles.length === 1) {
    selectedSpecUri = specFiles[0];
  } else {
    const items = specFiles.map(uri => {
      const featureName = path.basename(path.dirname(uri.fsPath));
      return {
        label: featureName,
        description: uri.fsPath,
        uri: uri
      };
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a spec to generate plan from',
      ignoreFocusOut: true
    });

    if (!selected) {
      return; // User cancelled
    }

    selectedSpecUri = selected.uri;
  }

  // Step 3: Read the spec.md content
  const specContent = await vscode.workspace.fs.readFile(selectedSpecUri);
  const specText = Buffer.from(specContent).toString('utf8');

  // Step 4: Determine feature folder and plan.md path
  const featureFolder = path.dirname(selectedSpecUri.fsPath);
  const featureName = path.basename(featureFolder);
  const planUri = vscode.Uri.file(path.join(featureFolder, 'plan.md'));

  // Step 5: Check if plan.md already exists
  try {
    await vscode.workspace.fs.stat(planUri);
    const overwrite = await vscode.window.showWarningMessage(
      `plan.md already exists for "${featureName}". Regenerate?`,
      'Yes', 'No'
    );
    if (overwrite !== 'Yes') {
      return;
    }
  } catch {
    // File doesn't exist, continue
  }

  // Step 6: Build AI prompt for plan generation
  const prompt = buildPlanPrompt(specText, featureName);

  // Step 7: Route to AI agent
  vscode.window.showInformationMessage(
    `🏗️ Generating implementation plan for "${featureName}"...`
  );

  const success = await routeToAgent(prompt);

  if (success) {
    vscode.window.showInformationMessage(
      `✅ AI agent opened! Review the generated plan and save it to:\n${planUri.fsPath}`
    );
  }
}

/**
 * Build the AI prompt for plan generation
 */
function buildPlanPrompt(specText: string, featureName: string): string {
  return `You are a software architect helping to create an implementation plan from an approved specification.

**CONTEXT:**
The team has approved a spec.md for "${featureName}". Your job is to:
1. Read the spec thoroughly
2. Design the architecture and technical approach
3. Make technology decisions
4. Create a detailed implementation plan (plan.md)

**APPROVED SPEC:**
\`\`\`markdown
${specText}
\`\`\`

**YOUR TASK:**
Create a comprehensive plan.md following GitHub Spec Kit format:

\`\`\`markdown
# Implementation Plan: ${featureName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}

## Architecture Overview
[High-level architecture diagram or description]
[System components and how they interact]
[Data flow: user request → frontend → API → database → response]

## Tech Stack
### Frontend
- Framework: [e.g., React 18, Next.js 14]
- State Management: [e.g., Zustand, React Query]
- UI Components: [e.g., Tailwind CSS, shadcn/ui]
- Form Validation: [e.g., React Hook Form, Zod]

### Backend
- Runtime: [e.g., Node.js 20, Bun]
- Framework: [e.g., Express, Fastify, Hono]
- API Style: [e.g., REST, GraphQL, tRPC]
- Validation: [e.g., Zod, Joi]

### Database
- Primary DB: [e.g., PostgreSQL 16, MongoDB]
- ORM/Query Builder: [e.g., Prisma, Drizzle, TypeORM]
- Caching: [e.g., Redis, in-memory]
- Search: [e.g., PostgreSQL full-text, Meilisearch]

### Infrastructure
- Hosting: [e.g., Vercel, Railway, AWS]
- CI/CD: [e.g., GitHub Actions]
- Monitoring: [e.g., Sentry, Axiom]

## Data Models

### Database Schema
\`\`\`typescript
// Prisma schema example
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String?
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  sessions      Session[]
  oauthAccounts OAuthAccount[]
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}
\`\`\`

### API Contracts
\`\`\`typescript
// Request/Response types
interface SignupRequest {
  email: string;
  password: string;
}

interface SignupResponse {
  user: {
    id: string;
    email: string;
  };
  session: {
    token: string;
    expiresAt: string;
  };
}
\`\`\`

## API Design

### Endpoints
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | /api/auth/signup | Create account | None |
| POST | /api/auth/login | Login | None |
| POST | /api/auth/logout | Logout | Required |
| GET | /api/auth/me | Get current user | Required |
| POST | /api/auth/verify | Verify email | None |
| POST | /api/auth/reset-password | Request reset | None |

### Authentication Flow
1. User submits credentials
2. Backend validates + hashes password (bcrypt, cost 12)
3. Create user record
4. Generate session token (crypto.randomBytes)
5. Return session cookie (httpOnly, secure, sameSite)

## Security Considerations
- Password hashing: bcrypt with cost factor 12
- Session tokens: 32-byte random (crypto.randomBytes)
- HTTPS-only cookies (secure flag)
- CSRF protection (double-submit cookie pattern)
- Rate limiting: max 5 login attempts per 15min per IP
- Input validation: Zod schemas for all endpoints
- SQL injection prevention: ORM with parameterized queries
- XSS prevention: Content-Security-Policy headers

## Performance Optimizations
- Database indexing: email (unique), session.token (unique), session.userId
- Connection pooling: max 10 connections
- Response caching: Cache user profile for 5min (Redis)
- Lazy loading: OAuth components loaded on-demand
- Bundle splitting: Auth UI separate chunk

## Testing Strategy
- Unit tests: Password hashing, token generation, validation
- Integration tests: API endpoints with test database
- E2E tests: Signup flow, login flow, password reset
- Load tests: 1000 concurrent users (Artillery)
- Security tests: OWASP Top 10 checks

## Implementation Phases

### Phase 1: Database & Models (2 days)
- Set up Prisma with PostgreSQL
- Define User, Session, OAuthAccount models
- Create initial migration
- Seed test data

### Phase 2: Core Authentication (3 days)
- POST /api/auth/signup (email/password)
- POST /api/auth/login
- POST /api/auth/logout
- Session management middleware
- Password hashing utilities

### Phase 3: Email Verification (2 days)
- Email service integration (e.g., Resend)
- POST /api/auth/verify endpoint
- Verification token generation
- Email templates

### Phase 4: OAuth Integration (3 days)
- Google OAuth setup (next-auth or arctic)
- GitHub OAuth setup
- Link OAuth accounts to existing users
- Handle OAuth errors

### Phase 5: Frontend UI (3 days)
- Signup form with validation
- Login form
- Email verification flow
- OAuth buttons
- Error handling

### Phase 6: Testing & Security (2 days)
- Write unit + integration tests
- E2E test critical flows
- Security audit (OWASP checks)
- Rate limiting implementation

### Phase 7: Deployment (1 day)
- Set up CI/CD pipeline
- Environment variables
- Database migration on deploy
- Monitoring + error tracking

## Rollout Plan
1. Deploy to staging with test users
2. Run security scan (npm audit, Snyk)
3. Performance test (Artillery)
4. Deploy to production with feature flag
5. Enable for 10% of users
6. Monitor error rates
7. Gradual rollout to 100%

## Success Metrics (from spec.md)
- 90%+ of new users complete signup within 2 minutes
- Login success rate > 95%
- Zero plain-text passwords in database
- Login response time < 200ms (p95)
- Support 1000+ concurrent users

## Open Questions
- [ ] Which email service? (Resend, SendGrid, AWS SES)
- [ ] Should we use next-auth or build custom?
- [ ] Redis for session storage or PostgreSQL?
- [ ] Do we need refresh tokens or just access tokens?

## References
- [Next.js App Router Auth](https://nextjs.org/docs/app/building-your-application/authentication)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
\`\`\`

**IMPORTANT GUIDELINES:**
1. Base ALL decisions on the approved spec (don't add out-of-scope features)
2. Choose modern, production-ready tech stack
3. Prioritize security (bcrypt, HTTPS, CSRF, rate limiting)
4. Design for the performance requirements in the spec
5. Break implementation into realistic phases (with time estimates)
6. Include data models with proper TypeScript types
7. Specify exact API endpoints with auth requirements
8. Plan for testing at each phase
9. Include rollout/deployment strategy

**OUTPUT:**
Generate the plan.md content. The team will review and then generate tasks.md from this plan.`;
}

/**
 * Route to the preferred AI agent with the plan generation prompt
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
