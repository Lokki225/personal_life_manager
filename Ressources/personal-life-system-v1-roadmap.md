# Personal Life System — V1 Implementation Roadmap

**Scope:** Finance node only, on top of a minimal global foundation
**Stack:** Next.js (App Router) + TypeScript + PostgreSQL + Prisma
**Principle:** Framework-independent domain logic; Next.js is delivery, not architecture

---

## 0. Non-Goals (restated so scope doesn't creep back in)

Explicitly **not** built in V1:
- Full Career / Personal / Learning / Health nodes
- Complete universal Goal or Intent engine
- Full project-management system
- Bank sync, multiple accounts/wallets, debt management
- Recurring subscriptions engine, account transfers
- Investment tracking, Projection/What-if engine
- AI assistant, automatic financial decisions
- Permissions/collaboration, mobile/native app

If a future node needs a global table that doesn't exist yet, add it then — not now.

---

## 1. Architecture

```text
app/                        → Next.js routes (thin: call use-cases, render)
application/                → Use-cases (orchestration only)
  finance/
    recordIncome.ts
    recordExpense.ts
    recordSaving.ts
    createBudgetException.ts
    recomputeFinanceState.ts
    ...
domain/                      → Pure TypeScript, zero framework/DB imports
  finance/
    entities.ts             → Income, Allocation, Expense, Saving, BudgetException, FinancialGoal
    calculations.ts         → dailyBudget(), deviation(), remainingAllocation(), dailySaving(), overspending()
  shared/
    event.ts                → minimal Event/State/Decision/Metric types used by Finance
infrastructure/
  prisma/
    schema.prisma
    client.ts
  repositories/
    financeRepository.ts    → the ONLY place Prisma is called from
```

**Why this matters:** `domain/` must be testable with plain `vitest` and no DB. If a calculation function imports Prisma, it's in the wrong folder. This is what makes the "framework-independent" principle in the spec real rather than aspirational — it also means the domain layer survives if you ever move off Next.js.

**Rule enforced throughout:** UI → use-case → domain → repository → DB. No component talks to Prisma directly. No use-case contains a calculation inline — it calls `domain/finance/calculations.ts`.

---

## 2. Database Schema (Prisma) — V1 Tables Only

Per the spec's own rule (§23): no theoretical tables before they're needed. V1 creates:

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  createdAt     DateTime @default(now())

  incomes           Income[]
  allocations       Allocation[]
  expenses          Expense[]
  savings           Saving[]
  budgetExceptions  BudgetException[]
  financialGoals    FinancialGoal[]
  projects          Project[]
}

model Income {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  source        String
  amount        Decimal
  frequency     String   // monthly | weekly | occasional | recurring
  expectedDate  DateTime?
  actualDate    DateTime?
  status        String   // expected | received
  notes         String?
  projectId     String?  // optional: income can come from a project
  project       Project? @relation(fields: [projectId], references: [id])
  createdAt     DateTime @default(now())
}

model Allocation {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  amount      Decimal
  period      String   // monthly | weekly | daily
  category    String   // fixed | subscription | daily_living | savings | custom
  startDate   DateTime
  endDate     DateTime?
  recurrence  String?
  notes       String?
  expenses    Expense[]
  createdAt   DateTime @default(now())
}

model Expense {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  amount        Decimal
  category      String
  date          DateTime
  allocationId  String?
  allocation    Allocation? @relation(fields: [allocationId], references: [id])
  projectId     String?
  project       Project?   @relation(fields: [projectId], references: [id])
  description   String?
  notes         String?
  createdAt     DateTime   @default(now())
}

model Saving {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  amount       Decimal
  date         DateTime
  source       String   // planned | underspending
  destination  String   // savings | buffer
  notes        String?
  createdAt    DateTime @default(now())
}

model BudgetException {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  date            DateTime
  plannedAmount   Decimal
  actualAmount    Decimal
  difference      Decimal
  category        String
  reason          String?
  context         String?
  resolution      String?
  createdAt       DateTime @default(now())
}

model FinancialGoal {
  id            String   @id @default(cuid())
  userId        String
  user          User     @relation(fields: [userId], references: [id])
  name          String
  targetAmount  Decimal
  currentAmount Decimal  @default(0)
  createdAt     DateTime @default(now())
}

model Project {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  name      String
  notes     String?
  incomes   Income[]
  expenses  Expense[]
  createdAt DateTime  @default(now())
}
```

**Deliberately excluded from V1 schema:** `intents`, `goals` (generic), `plans`, `tasks`, `events`, `decisions` as standalone tables. Nothing in the V1 flows (§25 of the MVP spec) actually reads or writes them yet — `BudgetException` already carries reason/context/resolution, which covers the "explanation" step of the plan→actual→deviation loop for Finance. Add a generic table only when a second domain needs the same shape.

---

## 3. Authentication

Single-user-first, but not hand-rolled to the point of being a rewrite later:
- **Auth.js (NextAuth) with Credentials provider** — email + password, one `User` row.
- Session via JWT, no OAuth providers needed for V1.
- Every use-case takes `userId` explicitly (never inferred deep in domain code) so multi-user later is a routing/session concern, not a domain rewrite.

---

## 4. Core Calculation Engine (`domain/finance/calculations.ts`)

Pure functions, one responsibility each, all unit-tested independently of the DB:

```text
dailyBudget(allocationAmount, period, referenceDate) → number
  // must use actual days-in-period, never assume 30

remainingAllocation(allocatedAmount, actualSpending) → number
dailyDeviation(actualSpending, dailyBudget) → number
dailySaving(dailyBudget, actualSpending) → number        // max(budget - actual, 0)
overspending(actualSpending, dailyBudget) → number       // max(actual - budget, 0)
financialState(user snapshot) → { income, allocated, spent, remaining,
                                    plannedSavings, actualSavings, buffer, exceptionsCount }
```

These five functions are the entire "plan vs actual vs deviation" engine from the spec. Everything else (dashboard, history, reviews) is aggregation/read-composition on top of them — not new logic.

---

## 5. Use-Cases (`application/finance/`)

One file per V1 operation, matching §26 of the MVP spec exactly:

| Use-case | Calls |
|---|---|
| `createIncome` / `editIncome` / `deleteIncome` / `markIncomeReceived` | repository only |
| `createAllocation` / `editAllocation` / `deleteAllocation` | repository only |
| `recordExpense` | repository → triggers `recomputeFinanceState` |
| `recordSaving` (planned or underspending) | repository, sets destination (savings/buffer) |
| `createBudgetException` | repository, requires category; reason/resolution optional at creation, editable after |
| `createFinancialGoal` / `fundGoal` | repository |
| `attachExpenseToProject` / `attachIncomeToProject` | repository |
| `recomputeFinanceState` | domain calculations → returns current state snapshot |
| `getHistory(period)` | repository query, day/week/month/year |

No use-case does math inline — they call `domain/finance/calculations.ts` and pass results to the repository.

---

## 6. Pages & Navigation

```text
/                    → Home graph: Finance node (collapsed, shows headline state), 
                        placeholder nodes for Projects/Goals if useful, nothing else
/finance             → Finance dashboard (§20): current state, this-period plan vs actual,
                        allocation breakdown, today widget, recent events
/finance/today       → Lightweight daily interaction (§25): budget, spent, remaining,
                        [Record expense] [Save] [Record exception]
/finance/history     → Filterable by day/week/month/year — underlying events, not just aggregates
/finance/goals       → List + create + fund financial goals
/finance/setup       → Monthly setup flow: income → allocations → planned savings → derived daily budget
/projects            → Minimal list + create; attach expense/income from here or from /finance
```

**V1-must vs. deferrable-within-V1:**
- Must: `/finance`, `/finance/today`, `/finance/setup`, expense/saving/exception recording
- Should: `/finance/history`, `/finance/goals`
- Can slip to a fast-follow if needed: rich graph visualization on `/` (a simple card layout satisfies §31's navigation criteria; the animated graph is a UI polish pass, not a functional requirement)

---

## 7. Build Phases

### Phase 1 — Foundation
- Repo, Next.js + TS + Tailwind scaffold
- Prisma schema above, migrations, seed script
- Auth.js wired, single test user
- CI: typecheck + lint on push

### Phase 2 — Setup Flow
- Income CRUD + use-cases
- Allocation CRUD + use-cases
- Daily budget derivation (real period length) — unit-tested first
- `/finance/setup` page

### Phase 3 — Daily Use
- Record expense → recompute state
- Record saving (underspending path) → savings/buffer split
- Record budget exception (overspend path) with category/reason/resolution
- `/finance/today` page — this is the highest-frequency screen, keep it to 2 taps per action

### Phase 4 — Understanding
- Financial state aggregation (`financialState()`)
- `/finance` dashboard
- `/finance/history` with day/week/month/year filters, preserving raw events

### Phase 5 — Goals & Projects
- FinancialGoal CRUD + funding from savings
- Project CRUD + optional expense/income attachment
- Surfacing goal funding progress on dashboard

### Phase 6 — Reviews
- Daily/weekly/monthly/yearly review views (read-composition of existing data, no new tables)
- Reason/exception summaries ("main recorded exceptions this month")

### Phase 7 — Polish & Deploy
- Home graph visual pass (can be simple cards → later a real graph UI)
- Error states, empty states, mobile-responsive pass
- Deployment (Vercel recommended for Next.js; Postgres via Supabase, Neon, or Railway — infra choice independent of app architecture, per your own note that Supabase should not become the architecture)

---

## 8. Testing Strategy

- **Domain layer:** unit tests on every function in `calculations.ts` — this is the highest-value test coverage since it's pure and cheap to test exhaustively (including edge cases: 28/30/31-day months, zero income, negative remaining).
- **Use-cases:** integration tests against a test DB (or mocked repository) for the recompute-on-write behavior.
- **UI:** smoke tests on `/finance/today` (the daily-driver screen) — record expense, verify state updates.

---

## 9. Deferred Questions (unchanged from spec — do not resolve prematurely)

Carried forward as-is from the Finance spec §29 / MVP spec §28: daily-saving-as-transaction-vs-state, bank balance relationship, multi-account, debt/liabilities, subscriptions engine, transfers, category ownership, irregular income, period-length edge cases, buffer/savings interaction, pattern detection, universal-vs-domain calculation boundary, automation-before-confirmation threshold.

None of these block V1. Revisit only if a Phase 3–6 implementation actually forces the question.
