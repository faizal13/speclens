# SpecLens - Comprehensive Testing Guide

This guide provides detailed, step-by-step examples for testing all SpecLens features in VS Code.

---

## Prerequisites

1. **Install VS Code Extension**
   - Press `F5` in VS Code (opens Extension Development Host)
   - OR: Package and install: `npm run package` → Install `.vsix` file

2. **Install AI Agent** (choose one)
   - GitHub Copilot Chat
   - Claude Code
   - Cursor IDE

3. **Optional: Install everything-copilot** (for advanced agent routing)
   ```bash
   npx everything-copilot init
   ```

---

## Test Scenario 1: Feature Development (BA→Spec→Plan→Tasks→Implementation)

### Scenario: User Authentication Feature

**Step 1: Elaborate BA Notes → Spec**

1. Open Command Palette: `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Windows)
2. Type: `SpecLens: Elaborate`
3. Select: `SpecLens: 🧠 Elaborate BA Notes → Spec`

4. **Paste rough BA notes:**
   ```
   We need user authentication for our web app. Users should be able to sign up
   with email and password, and also login with Google and GitHub. We need to
   keep users logged in across sessions. Also need password reset functionality.
   ```

5. **Select project type:**
   - Choose: `Monolith/General Feature`

6. **Enter feature name:**
   ```
   user-authentication
   ```

7. **Context documents:**
   - Choose: `No` (for this example)
   - (In real scenario, you'd attach architecture diagrams, DB schema, etc.)

8. **AI generates spec:**
   - AI opens in Copilot Chat / Claude Code / Cursor
   - Reviews rough notes
   - Asks clarifying questions (if needed):
     - "Should users verify email before login?"
     - "What password requirements?"
     - "Session expiry time?"
   - Generates formal spec.md with:
     - Overview
     - Goals (authentication, OAuth, session management)
     - User stories (sign up, login, reset password)
     - Success metrics (90% login success rate, <200ms response time)
     - Technical requirements (bcrypt, JWT, CSRF protection)
     - Data models (User, Session interfaces)

9. **Save the spec:**
   - Copy generated content
   - Save to: `specs/user-authentication/spec.md`

**Step 2: Generate Plan from Spec**

1. Open Command Palette
2. Run: `SpecLens: 🏗️ Generate Plan from Spec`
3. Select: `user-authentication`

4. **AI generates plan.md:**
   - Architecture overview (frontend → API → database flow)
   - Tech stack:
     - Frontend: React, Zod validation
     - Backend: Node.js, Express
     - Database: PostgreSQL, Prisma
     - Auth: JWT, bcrypt, OAuth libraries
   - Data models (Prisma schema)
   - API endpoints (POST /api/auth/signup, /login, /logout)
   - Security considerations (CSRF, XSS, rate limiting)
   - Implementation phases (7 phases with time estimates)

5. **Save the plan:**
   - Save to: `specs/user-authentication/plan.md`

**Step 3: Generate Tasks from Plan**

1. Open Command Palette
2. Run: `SpecLens: 📋 Generate Tasks from Plan`
3. Select: `user-authentication`

4. **AI generates tasks.md:**
   - ~20 tasks (2-4 hours each)
   - Task 1: Set up project structure
   - Task 2: Set up database schema (Prisma)
   - Task 3: Implement password hashing utilities
   - Task 4: Build POST /api/auth/signup endpoint
   - Task 5: Build POST /api/auth/login endpoint
   - ...
   - Task 20: CI/CD pipeline and deployment

5. **Save the tasks:**
   - Save to: `specs/user-authentication/tasks.md`

**Step 4: Execute Tasks with CodeLens**

1. Open: `specs/user-authentication/tasks.md`
2. Scroll to Task 1
3. Click CodeLens button: **[▶ Start Task]**

4. **AI agent opens with full context:**
   - Spec context (what we're building)
   - Plan context (tech stack, architecture)
   - Task details (acceptance criteria)

5. **If everything-copilot is installed:**
   - SpecLens detects task type: "setup" → Routes to `@architect` agent
   - Shows notification: "🤖 Routing to @architect (Strategic planner) - Model: OPUS"
   - Copilot Chat opens with `@architect` prefix + context

6. **Implement the task:**
   - Follow AI suggestions
   - Run tests
   - Verify acceptance criteria

7. **Mark complete:**
   - Click CodeLens button: **[✓ Complete]**
   - Task status updates to "done"

8. **Repeat for Task 2, 3, 4...**

**Expected Result:**
- ✅ Formal spec.md from rough notes
- ✅ Detailed plan.md with architecture
- ✅ 20 executable tasks
- ✅ Incremental implementation with AI guidance

---

## Test Scenario 2: Bug Fix in Production

### Scenario: Password Reset Returns 500 Error

**Step 1: Document Bug & Create Fix Plan**

1. Open Command Palette
2. Run: `SpecLens: 🐛 Document Bug & Create Fix Plan`

3. **Describe the bug:**
   ```
   Users can't reset password - getting 500 error when submitting email
   ```

4. **Select severity:**
   - Choose: `🔴 Critical` (production down, affects many users)

5. **Reproduction steps (optional):**
   ```
   1. Go to /forgot-password
   2. Enter email: test@example.com
   3. Click "Send Reset Link"
   4. See 500 Internal Server Error
   ```

6. **Error message (optional):**
   ```
   TypeError: Cannot read property 'email' of undefined
   at sendPasswordReset (auth.controller.ts:89)
   ```

7. **AI generates 3 documents:**

   **spec.md (Bug Analysis):**
   - Summary: Null pointer error in password reset
   - Severity: CRITICAL - All password resets failing
   - Impact: 100% of users affected, security feature broken
   - Root cause hypothesis: User lookup returning undefined
   - Success criteria: 0 errors, regression test added

   **plan.md (Fix Plan):**
   - Investigation steps (reproduce, debug, verify scope)
   - Fix approach: Add null check before accessing user.email
   - Code changes (before/after example)
   - Testing strategy (unit test, regression test)
   - Deployment: Hotfix branch → immediate production deploy

   **tasks.md (7 Tasks):**
   - Task 1: Reproduce bug locally (30 min)
   - Task 2: Debug and identify root cause (1 hour)
   - Task 3: Implement fix (1 hour)
   - Task 4: Write regression test (1 hour)
   - Task 5: Manual testing (30 min)
   - Task 6: Deploy hotfix (30 min) **URGENT**
   - Task 7: Monitor and verify (2 hours)

8. **Save all documents:**
   - `specs/bugfix-2024-1234/spec.md`
   - `specs/bugfix-2024-1234/plan.md`
   - `specs/bugfix-2024-1234/tasks.md`

**Step 2: Execute Bug Fix Tasks**

1. Open: `specs/bugfix-2024-1234/tasks.md`
2. Click **[▶ Start Task]** on Task 1
3. AI helps reproduce the bug
4. Click **[▶ Start Task]** on Task 2
   - **everything-copilot routing:** Detects "debug" → Routes to `@implement` agent
5. AI helps identify root cause
6. Click **[▶ Start Task]** on Task 3
   - Implement null check:
     ```typescript
     const user = await findUserByEmail(email);
     if (!user) {
       throw new Error('User not found');
     }
     sendEmail(user.email, resetLink); // ✅ Safe now
     ```
7. Click **[▶ Start Task]** on Task 4
   - **everything-copilot routing:** Detects "test" → Routes to `@tdd` agent
   - AI writes regression test that reproduces bug

8. Deploy hotfix and monitor

**Expected Result:**
- ✅ Bug documented with root cause
- ✅ Fix plan with 7 focused tasks
- ✅ Hotfix deployed in ~6 hours
- ✅ Regression test prevents recurrence

---

## Test Scenario 3: Microservice Development

### Scenario: Add Stripe Payment Integration to Payment Service

**Step 1: Elaborate Spec for Microservice**

1. Run: `SpecLens: 🧠 Elaborate BA Notes → Spec`

2. **Paste rough notes:**
   ```
   We need to integrate Stripe for payment processing in our payment service.
   Users should be able to create payments, and we need to handle webhooks
   for payment status updates. Need to emit events when payments succeed/fail.
   ```

3. **Select project type:**
   - Choose: `Microservice Feature`

4. **Enter service name:**
   ```
   payment-service
   ```

5. **Enter feature name:**
   ```
   payment-service-stripe-integration
   ```

6. **Context documents:**
   - Choose: `Yes`
   - Attach files:
     - `architecture.png` (system diagram showing microservices)
     - `api-gateway-config.yaml` (current routing rules)
     - `event-bus-schema.json` (Kafka topic schemas)

7. **AI generates microservice spec:**

   **spec.md includes:**
   ```markdown
   ## Service Context
   **Service:** payment-service
   **Type:** Microservice feature
   **Responsibility:** Handle payment processing, subscriptions, refunds

   ## Service Dependencies
   ### Upstream Services
   - user-service: GET /api/users/:id (customer data)
   - order-service: GET /api/orders/:id (order total)

   ### Downstream Services
   - email-service: Listens to payment.completed event
   - order-service: Listens to payment.completed event

   ### External Dependencies
   - Stripe API: Payment processing

   ## API Contract
   | Method | Path | Description | Auth | Request | Response |
   |--------|------|-------------|------|---------|----------|
   | POST | /api/payments/create | Create payment intent | Required | CreatePaymentRequest | PaymentResponse |
   | POST | /api/payments/confirm | Confirm payment | Required | ConfirmPaymentRequest | PaymentResponse |
   | POST | /webhooks/stripe | Stripe webhook | API Key | StripeEvent | 200 OK |

   **Request/Response Types:**
   ```typescript
   interface CreatePaymentRequest {
     orderId: string;
     amount: number;
     currency: string;
   }

   interface PaymentResponse {
     id: string;
     status: 'pending' | 'succeeded' | 'failed';
     clientSecret: string;
   }
   ```

   ### Events Published
   - `payment.created`: Published when payment intent created
     ```json
     {
       "eventType": "payment.created",
       "paymentId": "uuid",
       "orderId": "uuid",
       "amount": 9999,
       "timestamp": "2024-01-15T10:30:00Z"
     }
     ```

   - `payment.completed`: Published when payment succeeds
   - `payment.failed`: Published when payment fails

   ### Events Consumed
   - `order.created`: Triggers payment intent creation
   ```

**Step 2: Generate Plan with Microservice Architecture**

1. Run: `SpecLens: 🏗️ Generate Plan from Spec`
2. Select: `payment-service-stripe-integration`

3. **AI generates plan.md with:**
   - **Architecture:** Service discovery, API gateway routing, Kafka event bus
   - **Tech Stack:** Node.js, Express, Stripe SDK, Kafka client
   - **API Design:** Endpoints match spec contract
   - **Event Bus:** Kafka topic definitions, event schemas
   - **Testing Strategy:**
     - **Contract tests:** Pact tests for API contract
     - **Event testing:** Verify published events match schema
     - **Integration tests:** Mock Stripe API
   - **Service Communication:** REST for synchronous, Kafka for async

**Step 3: Generate Tasks with Contract Testing**

1. Run: `SpecLens: 📋 Generate Tasks from Plan`
2. **AI generates tasks including:**
   - Task 5: Implement POST /api/payments/create with Stripe
   - Task 8: Set up Kafka producer for payment events
   - Task 12: **Write contract tests (Pact)** ← Microservice-specific
   - Task 14: **Implement Stripe webhook handler**
   - Task 16: **Event schema validation tests** ← Microservice-specific

**Expected Result:**
- ✅ Microservice-aware spec with API contracts
- ✅ Plan includes service discovery, event bus
- ✅ Tasks include contract testing
- ✅ Integration points clearly defined

---

## Test Scenario 4: Context Documents

### Scenario: Product Reviews with Existing Architecture

**Step 1: Prepare Context Documents**

Create test files in `/tmp/`:
- `architecture.png` (any architecture diagram)
- `database-schema.sql`:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
  );

  CREATE TABLE products (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    price DECIMAL(10,2) NOT NULL
  );
  ```
- `api-conventions.md`:
  ```markdown
  # API Conventions
  - Use REST naming: GET /api/reviews not /reviews/list
  - Always include pagination: ?page=1&limit=20
  - Error format: { error: string, code: number }
  ```

**Step 2: Elaborate Spec with Context**

1. Run: `SpecLens: 🧠 Elaborate BA Notes → Spec`

2. **Paste rough notes:**
   ```
   We need a product review system. Users can rate products 1-5 stars
   and write text reviews. Need moderation to prevent spam.
   ```

3. **Context documents:**
   - Choose: `Yes`
   - Select files:
     - `/tmp/architecture.png`
     - `/tmp/database-schema.sql`
     - `/tmp/api-conventions.md`

4. **AI generates spec using context:**
   - **Data model** extends existing schema:
     ```sql
     CREATE TABLE reviews (
       id UUID PRIMARY KEY,
       product_id UUID REFERENCES products(id),
       user_id UUID REFERENCES users(id),  -- Uses existing users table
       rating INT CHECK (rating >= 1 AND rating <= 5),
       text TEXT,
       created_at TIMESTAMP DEFAULT NOW()
     );
     ```

   - **API follows conventions:**
     ```
     GET /api/reviews?page=1&limit=20  -- ✅ Follows REST naming
     POST /api/reviews                 -- ✅ Follows REST naming
     ```

   - **Respects existing architecture:**
     - Uses existing auth middleware
     - Integrates with existing user service
     - Follows established error format

5. **Context files copied:**
   - `specs/product-reviews/context/architecture.png`
   - `specs/product-reviews/context/database-schema.sql`
   - `specs/product-reviews/context/api-conventions.md`

6. **When generating plan:**
   - Context auto-loaded from context/ folder
   - AI references existing schema
   - Plan aligns with current architecture

**Expected Result:**
- ✅ Spec aligned with existing patterns
- ✅ No reinventing existing auth/user systems
- ✅ API follows established conventions
- ✅ Database schema extends existing tables

---

## Test Scenario 5: everything-copilot Integration

### Part A: Specialized Agent Routing

**Setup:**
```bash
npx everything-copilot init
```

**Test Task Routing:**

1. Open: `specs/user-authentication/tasks.md`

2. **Task 1: "Set up project structure and dependencies"**
   - Click **[▶ Start Task]**
   - SpecLens detects: "setup" → Routes to `@architect`
   - Notification: "🤖 Routing to @architect - Model: OPUS"
   - Copilot Chat opens with `@architect` prefix

3. **Task 4: "Write unit tests for password hashing"**
   - Click **[▶ Start Task]**
   - SpecLens detects: "test" → Routes to `@tdd`
   - Notification: "🤖 Routing to @tdd - Model: SONNET"
   - Copilot Chat opens with `@tdd` prefix
   - AI uses TDD approach (write test first, then implementation)

4. **Task 10: "Implement CSRF protection"**
   - Click **[▶ Start Task]**
   - SpecLens detects: "CSRF", "security" → Routes to `@security-reviewer`
   - Notification: "🤖 Routing to @security-reviewer - Model: OPUS"
   - AI reviews against OWASP Top 10

5. **Task 17: "E2E tests for critical auth flows"**
   - Click **[▶ Start Task]**
   - SpecLens detects: "e2e" → Routes to `@e2e`
   - Notification: "🤖 Routing to @e2e - Model: SONNET"
   - AI writes Playwright tests

**Expected Result:**
- ✅ Right agent for each task type
- ✅ Cost optimization (Opus only for strategic tasks)
- ✅ Better quality output (specialized expertise)

---

### Part B: Spec-as-Skill Embedding

**Step 1: Create AI Skill from Spec**

1. Ensure everything-copilot is installed:
   ```bash
   npx everything-copilot init
   ```

2. Complete: `specs/user-authentication/spec.md` and `plan.md`

3. Run: `SpecLens: 🍒 Create AI Skill from Spec`

4. Select: `user-authentication`

5. **File pattern trigger:**
   - Default shown: `src/**/*user-authentication*`
   - Or customize: `src/auth/**` (any file in auth folder)
   - Enter: `src/auth/**`

6. **Skill created:**
   - File: `.copilot-agents/skills/spec-user-authentication.md`
   - Config: `.copilot-agents/config.json`
   - Trigger: Loads when editing files in `src/auth/`

**Step 2: Test Auto-Loading**

1. Create: `src/auth/login.ts`

2. In the file, ask Copilot:
   ```
   // What are the authentication requirements for this feature?
   ```

3. **Copilot response includes spec context:**
   - "Based on the user-authentication spec, you need:"
   - "- Password hashing with bcrypt (cost factor 12)"
   - "- Session management with JWT"
   - "- CSRF protection"
   - "- Rate limiting (max 5 login attempts per 15min)"

4. Ask: "What's the expected login response format?"

5. **Copilot references plan.md:**
   ```typescript
   interface LoginResponse {
     user: {
       id: string;
       email: string;
     };
     session: {
       token: string;
       expiresAt: string;
     };
   }
   ```

**Expected Result:**
- ✅ Spec auto-loads when editing auth files
- ✅ AI responses aligned with approved spec
- ✅ No manual context copying
- ✅ Prevents implementation drift

---

## Test Scenario 6: No AI Agent Installed

**Test Graceful Degradation:**

1. Disable Copilot / Claude Code / Cursor

2. Run: `SpecLens: 🧠 Elaborate BA Notes → Spec`

3. **Expected behavior:**
   - Warning: "No AI coding agent detected..."
   - Button: "Learn More" → Opens GitHub page

4. Run: `SpecLens: 🍒 Create AI Skill from Spec`

5. **Expected behavior:**
   - Warning: "everything-copilot is not installed..."
   - Button: "Install Now" → Opens terminal with `npx everything-copilot init`

**Expected Result:**
- ✅ Helpful error messages
- ✅ Installation guidance
- ✅ No crashes

---

## Quick Reference: All Commands

| Command | Description | When to Use |
|---------|-------------|-------------|
| `SpecLens: 🧠 Elaborate BA Notes → Spec` | Transform rough notes → formal spec | Start of feature |
| `SpecLens: 🏗️ Generate Plan from Spec` | Create implementation plan | After spec approved |
| `SpecLens: 📋 Generate Tasks from Plan` | Break plan into tasks | After plan approved |
| `SpecLens: 🐛 Document Bug & Create Fix Plan` | Document production bugs | Bug reported |
| `SpecLens: 🍒 Create AI Skill from Spec` | Embed spec as auto-loading skill | After spec/plan created |

---

## Troubleshooting

### Issue: "No spec.md files found"
**Solution:** Create a spec first using `Elaborate BA Notes → Spec`

### Issue: "No AI coding agent detected"
**Solution:** Install GitHub Copilot, Claude Code, or Cursor

### Issue: CodeLens buttons not showing
**Solution:**
- Ensure file is `tasks.md` in `specs/*/` folder
- Reload VS Code window

### Issue: everything-copilot not routing
**Solution:**
- Run `npx everything-copilot init` first
- Check `.copilot-agents/` folder exists

### Issue: Context files not loading
**Solution:**
- Verify files copied to `specs/[feature]/context/`
- Check file sizes (<2000 chars per file)

---

## Success Criteria

After following these tests, you should have:

✅ **Feature Development:**
- specs/user-authentication/spec.md (formal spec from rough notes)
- specs/user-authentication/plan.md (architecture, tech stack)
- specs/user-authentication/tasks.md (20 executable tasks)

✅ **Bug Fix:**
- specs/bugfix-2024-1234/spec.md (bug analysis)
- specs/bugfix-2024-1234/plan.md (fix approach)
- specs/bugfix-2024-1234/tasks.md (7 focused tasks)

✅ **Microservice:**
- specs/payment-service-stripe/spec.md (with API contracts, events)
- specs/payment-service-stripe/plan.md (service architecture)
- specs/payment-service-stripe/tasks.md (with contract tests)

✅ **Context Documents:**
- specs/product-reviews/context/ (architecture, schema, conventions)
- Spec aligned with existing patterns

✅ **everything-copilot:**
- .copilot-agents/ folder
- Specialized agent routing working
- Spec-as-skill auto-loading

---

## Next Steps

1. **Test the extension** using these scenarios
2. **Report issues** on GitHub
3. **Customize** prompts for your team's needs
4. **Share feedback** to improve SpecLens

Happy testing! 🚀
