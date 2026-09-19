# Personal Life System — V1 Task-Level Roadmap

This expands each of the 7 build phases into concrete tasks, with **how** to do each one. Follow phases in order — each assumes the previous one is done.

---

## Phase 1 — Foundation

### 1.1 Scaffold the Next.js project
**What:** Create the app with TypeScript, App Router, Tailwind.
**How:**
```bash
npx create-next-app@latest personal-life-system --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
cd personal-life-system
```
Choose "No" for Turbopack if prompted (App Router + Prisma tooling is more predictable on webpack for now; switch later if you want).

### 1.2 Create the folder structure
**What:** Set up the layered architecture before writing any feature code, so nothing gets tangled from day one.
**How:** From the project root:
```bash
mkdir -p application/finance domain/finance domain/shared infrastructure/prisma infrastructure/repositories
```
Add a `tsconfig.json` path alias for each so imports read cleanly:
```json
"paths": {
  "@/domain/*": ["domain/*"],
  "@/application/*": ["application/*"],
  "@/infrastructure/*": ["infrastructure/*"]
}
```

### 1.3 Install Prisma and PostgreSQL
**What:** Add the ORM and connect to a database.
**How:**
```bash
npm install prisma @prisma/client
npx prisma init
```
This creates `prisma/schema.prisma` and a `.env` with `DATABASE_URL`. For local dev, the fastest path is a free Postgres instance on **Neon** or **Supabase** (just the DB, not their SDKs) — copy the connection string into `.env`. Alternatively run Postgres locally via Docker:
```bash
docker run --name pls-db -e POSTGRES_PASSWORD=devpass -p 5432:5432 -d postgres:16
```
and set `DATABASE_URL="postgresql://postgres:devpass@localhost:5432/pls"`.

### 1.4 Write the schema and run the first migration
**What:** Paste the full schema from the previous roadmap document into `prisma/schema.prisma` (add `generator client { provider = "prisma-client-js" }` and `datasource db { provider = "postgresql" url = env("DATABASE_URL") }` at the top).
**How:**
```bash
npx prisma migrate dev --name init
```
This creates the tables and generates the typed Prisma client into `node_modules/@prisma/client`. Re-run this command every time you change `schema.prisma`.

### 1.5 Create a single Prisma client instance
**What:** Avoid creating a new Prisma connection on every hot-reload in dev.
**How:** In `infrastructure/prisma/client.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### 1.6 Set up Auth.js (NextAuth) with Credentials
**What:** Single-user login with email + password.
**How:**
```bash
npm install next-auth bcryptjs
```
Create `app/api/auth/[...nextauth]/route.ts` with a `CredentialsProvider` that looks up the user by email via `prisma.user.findUnique`, then compares the password with `bcryptjs.compare`. Store the session strategy as `jwt`. Wrap protected pages with a `getServerSession` check in a layout or middleware — for V1 with one user, a simple `middleware.ts` redirecting unauthenticated requests to `/login` is enough.
**Seed the first user manually** rather than building a signup flow (you're the only user for now):
```bash
npx tsx -e "
import bcrypt from 'bcryptjs'
console.log(await bcrypt.hash('yourpassword', 10))
"
```
Insert that hash directly via `npx prisma studio` (a GUI Prisma gives you for free — run `npx prisma studio` and add the row).

### 1.7 Set up testing tooling
**What:** Get unit tests running before you write the calculation engine, so Phase 2 can be test-driven.
**How:**
```bash
npm install -D vitest
```
Add to `package.json`: `"test": "vitest"`. Create `domain/finance/calculations.test.ts` as an empty placeholder now — it forces the folder to exist before Phase 2.

### 1.8 Set up CI
**What:** Catch typecheck/lint/test failures before they reach you.
**How:** Add `.github/workflows/ci.yml`:
```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm test -- --run
```

**Phase 1 done when:** `npm run dev` shows a login-gated blank app, `npx prisma studio` shows your 8 tables, `npm test` runs (even with 0 tests), CI is green.

---

## Phase 2 — Setup Flow

### 2.1 Write the daily-budget calculation first, with tests
**What:** This is the riskiest piece of math in the whole app (period-length edge cases) — write it test-first.
**How:** In `domain/finance/calculations.ts`:
```ts
export function daysInPeriod(period: 'monthly' | 'weekly', referenceDate: Date): number {
  if (period === 'weekly') return 7
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  return new Date(year, month + 1, 0).getDate() // real days in that month
}

export function dailyBudget(allocationAmount: number, period: 'monthly' | 'weekly', referenceDate: Date): number {
  return allocationAmount / daysInPeriod(period, referenceDate)
}
```
In `calculations.test.ts`, assert `daysInPeriod('monthly', new Date(2026, 1, 1))` returns `28` (Feb 2026) and `new Date(2024, 1, 1)` returns `29` (leap year), and `daysInPeriod('monthly', new Date(2026, 0, 1))` returns `31`. Run `npm test` until green before moving on.

### 2.2 Build the Income repository and use-cases
**What:** CRUD for Income, isolated from any UI.
**How:** In `infrastructure/repositories/financeRepository.ts`, write thin functions that only call Prisma, e.g. `createIncome(userId, data)`, `listIncomes(userId)`, `updateIncome(id, data)`, `deleteIncome(id)`. Then in `application/finance/createIncome.ts`, import the repository and add only the orchestration (e.g. defaulting `status` to `"expected"`). **Do not** put Prisma calls directly in use-case files — always go through the repository, so you can swap persistence later without touching use-cases.

### 2.3 Build the Allocation repository and use-cases
**What:** Same pattern as 2.2, for Allocation.
**How:** Mirror the Income structure exactly. Add one extra use-case, `getCurrentAllocations(userId)`, that filters by `startDate <= today <= (endDate ?? infinity)` — this is what the dashboard and today-view will call.

### 2.4 Build the `/finance/setup` page
**What:** A guided flow: enter income → define allocations → see derived daily budget.
**How:** Use a simple multi-step form (no need for a form library at this scale — `useState` for step index is enough). Step 1 posts to a server action calling `createIncome`. Step 2 posts to `createAllocation` for each category (fixed, subscriptions, daily living, savings). Step 3 is read-only: call `dailyBudget()` on the "daily living" allocation and render it. Use **Next.js Server Actions** (`'use server'` functions exported from `application/finance/*.ts` files, called directly from form `action={}` props) — this avoids hand-building API routes for simple form submissions.

**Phase 2 done when:** you can log in, go to `/finance/setup`, enter a real income + allocations, and see a correct daily budget number that accounts for the actual number of days in the current month.

---

## Phase 3 — Daily Use

### 3.1 Write and test the remaining calculation functions
**What:** `dailySaving`, `overspending`, `remainingAllocation`.
**How:** Add to `calculations.ts`:
```ts
export const dailySaving = (budget: number, actual: number) => Math.max(budget - actual, 0)
export const overspending = (actual: number, budget: number) => Math.max(actual - budget, 0)
export const remainingAllocation = (allocated: number, spent: number) => allocated - spent
```
Test each with the exact numeric examples from the finance spec (2,000 budget / 1,600 actual → 400 saving; 2,000 / 3,500 → 1,500 overspend) so the tests double as living documentation of the spec.

### 3.2 Build `recordExpense`
**What:** The core daily action.
**How:** `application/finance/recordExpense.ts`: takes `{ userId, amount, category, date, allocationId?, projectId?, description? }`, calls `repository.createExpense(...)`, then calls a new `application/finance/recomputeFinanceState.ts` use-case (build this now, in 3.4) so every write leaves the state consistent. Expose it as a Server Action bound to the "Add Expense" form on `/finance/today`.

### 3.3 Build `recordSaving`
**What:** Records underspending as an explicit saving.
**How:** Same pattern as 3.2. The `source` field is `"underspending"` when triggered from the today-page's "[Save]" button (pre-fill `amount` with the computed `dailySaving()` value so the user just confirms), and `"planned"` when triggered elsewhere (e.g. a scheduled monthly savings allocation — for V1 this can just be a manual button too, no cron needed yet).

### 3.4 Build `createBudgetException` and the overspend flow
**What:** When `overspending() > 0`, prompt for category/reason/resolution instead of silently logging a negative number.
**How:** On `/finance/today`, after an expense pushes `actualSpending > dailyBudget`, render the exception form inline (category chips: Transportation / Food / Emergency / Other, per the spec's example — plus a free-text "Other" input). Submit calls `createBudgetException` with `plannedAmount`, `actualAmount`, `difference` computed via `overspending()`. `reason` and `resolution` can be optional at creation and editable later from `/finance/history`.

### 3.5 Build `recomputeFinanceState`
**What:** A single function the other three call, so "state" is never manually kept in sync.
**How:** In `application/finance/recomputeFinanceState.ts`, pull the current period's income, allocations, expenses, and savings for the user via the repository, then run them through `domain/finance/calculations.ts`'s `financialState()` function (write this now — see Phase 4.1, but implement the minimal version here since 3.2–3.4 depend on it existing). Cache nothing yet — recomputing on every read is fine at V1 scale.

### 3.6 Build `/finance/today`
**What:** The highest-frequency screen — must be fast to use.
**How:** Server Component fetches `recomputeFinanceState()` for today; renders Budget / Spent / Remaining. Two buttons: "Add Expense" (opens a 2-field form: amount + category) and, once remaining > 0, "Save" (pre-filled). If remaining < 0, replace "Save" with "Record exception" (opens the form from 3.4). Keep every interaction to 2 taps: tap button → fill 1–2 fields → submit.

**Phase 3 done when:** you can record a real expense, see the remaining budget update immediately, save an underspend, and record an overspend exception with a reason — end to end, no page reload needed if using Server Actions with `revalidatePath`.

---

## Phase 4 — Understanding

### 4.1 Finish `financialState()`
**What:** The full aggregation the spec's dashboard example shows (income, allocated, spent, remaining, planned savings, actual savings, buffer, exceptions count).
**How:** Extend the minimal version from 3.5: sum `Saving` rows by `destination` to split `actualSavings` vs `buffer`, count `BudgetException` rows in the period, sum `Allocation` rows by `category === 'savings'` for `plannedSavings`. Return one typed object — this is what every dashboard widget reads from, nothing computes its own numbers redundantly.

### 4.2 Build `/finance` dashboard
**What:** The at-a-glance view from the spec's §20 mockup.
**How:** One Server Component, four sections rendered from a single `financialState()` call plus a `getCurrentAllocations()` call: Current State cards, This Period plan-vs-actual, Allocation breakdown (loop over allocations), Recent Events (last 5 from a combined query of `Expense`/`Saving`/`BudgetException` sorted by date — a simple `Promise.all` of three queries merged and sorted in JS is fine at this scale, no need for a union view yet).

### 4.3 Build `/finance/history`
**What:** Period-filterable, preserving raw events (not just aggregates).
**How:** Add a use-case `getHistory(userId, period: 'day'|'week'|'month'|'year', referenceDate)` that computes the date range (reuse `daysInPeriod` logic for month boundaries) and queries all four event-producing tables within it. Render as a simple chronological list first — grouping/charting is a polish task, not a V1 blocker. Add inline edit for `reason`/`resolution` on `BudgetException` rows here, since 3.4 allowed leaving them blank.

**Phase 4 done when:** the dashboard shows real numbers that match manual arithmetic on your test data, and history shows every event you've recorded, filterable by period.

---

## Phase 5 — Goals & Projects

### 5.1 Build FinancialGoal CRUD
**What:** Create/list/fund a goal.
**How:** Repository + use-cases mirror Income (2.2). `fundGoal(goalId, amount)` increments `currentAmount` — for V1 this can be a manual "I'm putting X toward this goal" action rather than automatically pulling from `Saving` records; keep the link explicit and user-triggered, matching the spec's "user decides" philosophy for exceptions.

### 5.2 Build Project CRUD + attachment
**What:** Minimal project list; attach an expense or income to one.
**How:** Repository + use-cases mirror Income. On the expense/income forms from Phase 2–3, add an optional `<select>` populated from `listProjects(userId)`, writing to the existing `projectId` field already in the schema — no migration needed here since it was defined in Phase 1.

### 5.3 Build `/finance/goals` and `/projects`
**What:** Two simple list+create pages.
**How:** Same Server Component + Server Action pattern as every prior page. On `/finance/goals`, show a progress bar per goal (`currentAmount / targetAmount`).

**Phase 5 done when:** you can create a goal, fund it manually, create a project, and see an expense tagged to that project on `/finance/history`.

---

## Phase 6 — Reviews

### 6.1 Build the review use-cases
**What:** Daily/weekly/monthly/yearly summaries — read-composition only, no new tables.
**How:** `application/finance/getReview(userId, periodType, referenceDate)` calls `getHistory()` (4.3) plus `financialState()` (4.1) for that range, and additionally groups `BudgetException` rows by `category` with summed `difference` — this answers the spec's "why was actual spending higher than planned" question directly.

### 6.2 Build the review pages
**What:** One page per period type, or one page with a period-type switcher.
**How:** Simplest: a single `/finance/review?period=week` route reading the query param, reusing the dashboard's card components with review-specific data. Don't build four separate pages — the underlying data shape is the same, only the range and grouping differ.

**Phase 6 done when:** you can pull up "this month" and see planned vs actual, savings, exceptions, and a breakdown of which categories caused the most deviation.

---

## Phase 7 — Polish & Deploy

### 7.1 Home graph pass
**What:** Turn the placeholder home page into the spec's collapsed Finance node view.
**How:** Start with a simple card grid (Finance card shows headline numbers from `financialState()`, Projects/Goals cards show counts) — this satisfies the navigation success criteria. Only invest in an actual animated graph (e.g. with `react-flow` or hand-rolled SVG) once the functional app is validated; it's a visual layer over the same data, not new logic.

### 7.2 Error/empty states
**What:** Every list page needs a sane empty state (e.g. "/finance/setup" prompt if no income exists yet); every form needs basic validation feedback.
**How:** Add a guard at the top of `/finance`: if `listIncomes(userId)` is empty, redirect to `/finance/setup` instead of showing a blank dashboard.

### 7.3 Deploy
**What:** Ship it.
**How:**
```bash
npm install -g vercel
vercel
```
Set `DATABASE_URL` and `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`) as environment variables in the Vercel project settings. Point `DATABASE_URL` at your Neon/Supabase Postgres instance (same one from Phase 1, or a fresh production instance — run `npx prisma migrate deploy` against it once). Vercel auto-detects Next.js; no config needed beyond env vars.

**Phase 7 done when:** the app is live at a Vercel URL, you can log in, and every flow from Phase 2–6 works against production data.

---

## Cross-cutting reminder

Every phase above follows the same shape: **domain function (tested) → repository (Prisma only) → use-case (orchestration, often a Server Action) → page (renders + calls the action)**. If a task ever feels like it doesn't fit this shape, that's a signal to stop and re-check which layer it actually belongs in before writing code.
