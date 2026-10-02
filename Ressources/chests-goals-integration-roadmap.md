# Chests & Goals Integration — Task Roadmap (Spec v0.2)

**Context:** No real data in production yet, so this is a clean schema rewrite, not a migration. `Expense` and `BudgetException` are untouched — only saved/reserved money (Chests, Movements) and the goal system change.

Work top to bottom — Part B depends on Part A being deployed first.

---

# PART A — Backend & Data Model

## A.1 Update the Prisma schema

**What:** Remove `Saving` and `FinancialGoal`. Add `Chest`, `MoneyMovement`, `Goal`, `GoalCondition`, and their enums.

**How:** Open `prisma/schema.prisma`. Delete the `model Saving { ... }` and `model FinancialGoal { ... }` blocks entirely, and remove their relation fields from `model User` (`savings Saving[]` and `financialGoals FinancialGoal[]`). Add:

```prisma
enum ChestType { AVAILABLE SECURE }
enum MovementType { IN OUT TRANSFER }
enum MovementReason { DAILY_SAVING PLANNED_SAVING BUFFER_CONSOLIDATION GOAL_FUNDING WITHDRAWAL EXPENSE }
enum GoalLogic { ALL ANY }
enum ConditionOperator { GTE LTE EQ GT LT }
enum EvalPeriod { NONE DAILY WEEKLY MONTHLY YEARLY }

model Chest {
  id           String    @id @default(cuid())
  userId       String
  user         User      @relation(fields: [userId], references: [id])
  name         String
  type         ChestType
  isSystem     Boolean   @default(false)
  passwordHash String?
  lockedUntil  DateTime?
  createdAt    DateTime  @default(now())
  movementsOut MoneyMovement[] @relation("SourceChest")
  movementsIn  MoneyMovement[] @relation("DestinationChest")
  conditions   GoalCondition[]
}

model MoneyMovement {
  id                 String         @id @default(cuid())
  userId             String
  user               User           @relation(fields: [userId], references: [id])
  sourceChestId      String?
  sourceChest        Chest?         @relation("SourceChest", fields: [sourceChestId], references: [id])
  destinationChestId String?
  destinationChest   Chest?         @relation("DestinationChest", fields: [destinationChestId], references: [id])
  amount             Decimal
  type               MovementType
  reason             MovementReason
  date               DateTime
  relatedGoalId      String?
  relatedGoal        Goal?          @relation(fields: [relatedGoalId], references: [id])
  relatedProjectId   String?
  relatedProject     Project?       @relation(fields: [relatedProjectId], references: [id])
  notes              String?
  createdAt          DateTime       @default(now())
}

model Goal {
  id         String          @id @default(cuid())
  userId     String
  user       User            @relation(fields: [userId], references: [id])
  name       String
  domain     String          @default("finance")
  logic      GoalLogic       @default(ALL)
  conditions GoalCondition[]
  movements  MoneyMovement[]
  createdAt  DateTime        @default(now())
}

model GoalCondition {
  id          String            @id @default(cuid())
  goalId      String
  goal        Goal              @relation(fields: [goalId], references: [id])
  measurement String
  chestId     String?
  chest       Chest?            @relation(fields: [chestId], references: [id])
  operator    ConditionOperator
  targetValue Decimal
  unit        String?
  period      EvalPeriod        @default(NONE)
}
```

Add the matching relation fields to `model User`: `chests Chest[]`, `moneyMovements MoneyMovement[]`, `goals Goal[]`. Add `movements MoneyMovement[]` and `relatedGoalId`/relation back-reference to `model Project` (it already has `projectId` on other models, so just add `moneyMovements MoneyMovement[]` there too).

## A.2 Reset and apply the migration

**What:** Since there's no real data, wipe and recreate rather than writing a careful incremental migration.

**How:**
```bash
npx prisma migrate reset --force
```
This drops the DB, re-runs every migration from scratch, and re-runs your seed script (A.13) if one is configured in `package.json`'s `"prisma": { "seed": "..." }` field. Then generate the client:
```bash
npx prisma generate
```
Commit both the updated `schema.prisma` and the new migration folder Prisma creates under `prisma/migrations/`.

## A.3 Seed default chests when a user is created

**What:** Every user needs a Base Chest and a Buffer chest to exist automatically — the app shouldn't work without them, so don't make chest creation manual for these two.

**How:** In `application/finance/` create `ensureDefaultChests.ts`:
```ts
export async function ensureDefaultChests(userId: string) {
  const existing = await chestRepository.listChests(userId)
  if (existing.some(c => c.name === 'Base Chest')) return // already set up

  await chestRepository.createChest({ userId, name: 'Base Chest', type: 'AVAILABLE', isSystem: true })
  await chestRepository.createChest({ userId, name: 'Buffer', type: 'AVAILABLE', isSystem: true })
  await chestRepository.createChest({ userId, name: 'Monthly Savings', type: 'SECURE', isSystem: false })
}
```
Call this once, right after user creation in your signup/seed flow (Phase 1's manually-seeded user — call it once via `npx tsx` the same way you generated the password hash, or add it to your Prisma seed script directly).

## A.4 Build the Chest repository and use-cases

**What:** CRUD + balance lookup for chests.

**How:** In `infrastructure/repositories/chestRepository.ts`, add thin Prisma-only functions: `createChest(data)`, `listChests(userId)`, `getChest(id)`, `deleteChest(id)` (guard: refuse if `isSystem === true`). In `domain/finance/chests.ts`, write the balance calculation as a pure function — this is the important one, test it:
```ts
export function chestBalance(chestId: string, movements: MoneyMovement[]): number {
  return movements.reduce((balance, m) => {
    if (m.destinationChestId === chestId) return balance + m.amount
    if (m.sourceChestId === chestId) return balance - m.amount
    return balance
  }, 0)
}
```
In `application/finance/`, add `createChest.ts` (calls repository, rejects duplicate names for the user) and `getChestsWithBalances.ts` (lists chests, fetches all movements for the user once, then runs `chestBalance()` per chest in memory — one query, not N).

## A.5 Build the core Money Movement primitive

**What:** One function everything else calls, so "conservation of money" is enforced in exactly one place.

**How:** In `application/finance/recordMovement.ts`:
```ts
export async function recordMovement(input: {
  userId: string
  amount: number
  type: 'IN' | 'OUT' | 'TRANSFER'
  reason: MovementReason
  sourceChestId?: string
  destinationChestId?: string
  relatedGoalId?: string
  relatedProjectId?: string
  notes?: string
}) {
  if (input.amount <= 0) throw new Error('Movement amount must be positive')
  if (input.type === 'TRANSFER' && (!input.sourceChestId || !input.destinationChestId)) {
    throw new Error('Transfer requires both a source and destination chest')
  }
  return movementRepository.create({ ...input, date: new Date() })
}
```
Every other use-case below (transfer, daily saving, buffer consolidation, goal funding) calls this instead of writing to the repository directly. Do not let any other file call `movementRepository.create` — that's the rule that keeps the ledger consistent.

## A.6 Build `transferBetweenChests`

**What:** The generalized version of "Move buffer to savings."

**How:** `application/finance/transferBetweenChests.ts` — validates both chests belong to the user and the source chest isn't locked (`SECURE` type with `lockedUntil` in the future rejects the transfer), then calls `recordMovement({ type: 'TRANSFER', reason: 'BUFFER_CONSOLIDATION' or manual, sourceChestId, destinationChestId, amount })`. Pass a `reason` parameter through so a manual user-initiated transfer can be tagged `WITHDRAWAL` while a scripted consolidation is tagged `BUFFER_CONSOLIDATION` — reuse the same function for both.

## A.7 Rework daily saving to target a chest

**What:** Replace the old `recordSaving` (which wrote a `Saving` row) with a version that writes a movement.

**How:** Rename to `application/finance/recordDailySaving.ts`:
```ts
export async function recordDailySaving(userId: string, amount: number, destinationChestId: string) {
  return recordMovement({ userId, amount, type: 'IN', reason: 'DAILY_SAVING', destinationChestId })
}
```
Default `destinationChestId` to the user's Buffer chest in the UI layer (pre-filled, not hardcoded here) so the "Save" quick action on `/finance/today` keeps working with one tap, but power users can pick a different chest from a dropdown.

## A.8 Build `consolidateBuffer`

**What:** Weekly Buffer → Base Chest sweep. Manual button for V1, matching the spec's "V1 flow" note — no cron needed yet.

**How:** `application/finance/consolidateBuffer.ts` reads the Buffer chest's current balance via `chestBalance()`, then calls `transferBetweenChests(userId, bufferId, baseChestId, balance, reason: 'BUFFER_CONSOLIDATION')`. Wire it to a "Consolidate now" button rather than a scheduled job — you already have this exact interaction as "Move buffer to savings" in your current UI, this just generalizes the destination.

## A.9 Build the Goal + GoalCondition repository and use-cases

**What:** CRUD for goals and their conditions.

**How:** `infrastructure/repositories/goalRepository.ts`: `createGoal(data)`, `addCondition(goalId, condition)`, `listGoals(userId)`, `getGoal(id)` (include `conditions` and `chest` relations). `application/finance/createGoal.ts` takes `{ name, logic, conditions: [...] }` in one call and creates the goal plus all its conditions in a single Prisma transaction (`prisma.$transaction`) so a goal never exists with zero conditions.

## A.10 Build goal evaluation

**What:** The function that turns "Headphones Chest balance >= 30,000" into satisfied/not-satisfied.

**How:** In `domain/finance/goals.ts` (pure, tested):
```ts
export function evaluateCondition(operator: ConditionOperator, actual: number, target: number): boolean {
  switch (operator) {
    case 'GTE': return actual >= target
    case 'LTE': return actual <= target
    case 'EQ':  return actual === target
    case 'GT':  return actual > target
    case 'LT':  return actual < target
  }
}
export function evaluateGoal(logic: 'ALL'|'ANY', results: boolean[]): boolean {
  return logic === 'ALL' ? results.every(Boolean) : results.some(Boolean)
}
```
In `application/finance/evaluateGoal.ts`, for each condition: if `measurement === 'chest_balance'`, fetch that chest's balance via `chestBalance()`; if it's `monthly_deviation_count` or `monthly_deviation_amount`, pull from `getHistory()`'s `BudgetException` rows for the current period. Compare each to `targetValue` with `evaluateCondition`, then combine with `evaluateGoal`. Return `{ satisfied: boolean, conditionResults: [...] }` so the UI can show which specific condition is unmet, not just a pass/fail.

## A.11 Update `recomputeFinanceState`

**What:** The dashboard's single source of truth needs chest balances and goal summaries added.

**How:** Extend the return shape from `application/finance/recomputeFinanceState.ts` to include `chests: [{ id, name, type, balance }]` (from A.4) and `goals: [{ id, name, satisfied, conditionResults }]` (from A.10, evaluated for every goal). Every page in Part B reads from this one extended object — don't compute chest balances a second time in a page component.

## A.12 Fix every call site that referenced the old models

**What:** `Saving` and `FinancialGoal` are gone — anything importing them will fail to compile.

**How:** Run `grep -rn "FinancialGoal\|prisma.saving\|from.*Saving" app application infrastructure` to find every reference. Expect to touch: the old `/finance/today` "Save" button handler (now calls `recordDailySaving`), the old `/finance/goals` page (now reads `Goal`/`GoalCondition`), and `financialState()`'s savings/buffer fields (now derived from chest balances instead of summed `Saving` rows). Fix each one before moving to Part B — `npx tsc --noEmit` will list every remaining error.

## A.13 Update your Prisma seed script

**What:** Local dev needs realistic Chests/Goals data, same way you seeded Income/Allocation before.

**How:** In `prisma/seed.ts`, after creating the test user, call `ensureDefaultChests(userId)` (A.3), then create one example goal: "Save 30,000 XOF for headphones" with a single `chest_balance` condition (`operator: GTE, targetValue: 30000`) against a newly created "Headphones" chest — this gives you a non-trivial goal to test the evaluation logic against immediately.

---

# PART B — UI Changes

Your existing dark theme (rounded cards, pill segmented control, green for positive values, bottom nav) stays — these tasks extend it, not replace it.

## B.1 Replace the "Actual savings" card with a Chests section

**What:** One flat number becomes a short list of chest balances.

**How:** On `/finance/today` and `/finance` (dashboard), replace the single card with a card that maps over `state.chests` from A.11:
```tsx
<div className="rounded-2xl bg-neutral-900 p-4">
  <p className="text-sm text-neutral-400 mb-3">Chests</p>
  {state.chests.map(chest => (
    <div key={chest.id} className="flex justify-between items-center py-2 border-t border-neutral-800 first:border-t-0">
      <span className="text-sm text-neutral-300">{chest.name}</span>
      <span className={`font-medium ${chest.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
        {formatFcfa(chest.balance)}
      </span>
    </div>
  ))}
</div>
```
This keeps your existing card visual language (dark surface, rounded-2xl, green for positive) and just changes what's inside it from one row to N rows.

## B.2 Generalize "Move buffer to savings" into a Transfer flow

**What:** Instead of one hardcoded button, let the user pick source and destination.

**How:** Replace the single "Transfer to savings" button with a small form: two `<select>` elements populated from `state.chests` (source, destination), an amount input pre-filled with the source chest's full balance, and a "Transfer" button calling `transferBetweenChests` (A.6) as a Server Action. Keep a shortcut: if the source is Buffer and destination is Base Chest with the full balance, that's still a single tap — pre-select those two as defaults so the common case doesn't get slower.

## B.3 Update the "Save to buffer" quick action

**What:** Let the destination chest be chosen, defaulting to Buffer.

**How:** Add a small chest `<select>` next to the existing "Save remaining" button, defaulting to the Buffer chest's id. Submitting calls `recordDailySaving(userId, amount, selectedChestId)` (A.7) instead of the old flat saving use-case. Visually this is a one-line addition under the existing button, not a new section.

## B.4 Build a Chests page

**What:** A dedicated view for creating chests and seeing all balances at once, since the Today page only has room for a summary.

**How:** New route `/finance/chests`. Server Component fetches `getChestsWithBalances()` (A.4). Render each chest as a card showing name, type badge (Available/Secure — use a small pill, same visual pattern as your existing "SAFE" badge), balance, and a lock icon with the unlock date if `SECURE` and `lockedUntil` is in the future. Add a "New chest" button opening a small form (name, type, optional locked-until date) calling `createChest`.

## B.5 Build a Goals page

**What:** List goals with real progress, not a manually-updated percentage.

**How:** New route `/finance/goals`. Fetch `state.goals` (A.11, already evaluated). For each goal, render a progress bar: for a single `chest_balance` condition, width = `min(actualBalance / targetValue, 1) * 100%`; for count/amount-based conditions (deviation goals), show each condition as a small checklist row with a checkmark or X icon rather than forcing everything into one bar — a goal with two different-shaped conditions doesn't fit one progress bar honestly, and forcing it to would misrepresent the ALL/ANY logic. Add a "New goal" flow: name, logic (ALL/ANY radio), then a repeatable condition builder (measurement dropdown, operator dropdown, target value input, optional chest picker when measurement is `chest_balance`).

## B.6 Fold Money Movements into History

**What:** Transfers and goal funding should show up in the activity timeline, not just expenses and exceptions.

**How:** In `getHistory()` (already built for expenses/exceptions), add a third query for `MoneyMovement` in the date range, and merge all three into one sorted list before rendering. Give each movement type a distinct small icon/label in the list (e.g. a transfer arrow icon for `TRANSFER`, a plus icon for `DAILY_SAVING`) so the history reads as one coherent timeline rather than three visually identical sections.

## B.7 Add goal evaluation to Reviews

**What:** Monthly/weekly reviews should say whether goals are on track, not just show raw numbers.

**How:** On `/finance/review`, add a section below the existing plan-vs-actual cards: loop over `state.goals`, show each goal's name with a satisfied/not-satisfied badge, and for unsatisfied goals show which specific condition failed (using the `conditionResults` array from A.10) — e.g. "Monthly deviation count: 4 / 3 ✗" — so the review explains the gap instead of just flagging it.

## B.8 Update navigation

**What:** Your current bottom nav (History / Today / Review) has no room for Chests and Goals.

**How:** Two options — pick based on how central these are day-to-day:
- **Simplest:** keep Chests and Goals as links reachable from the dashboard (`/finance`) rather than the bottom nav, since they're checked less often than Today. Add two small nav cards/rows at the top of `/finance`.
- **If you expect frequent use:** expand the bottom nav to 5 items (History / Chests / Today / Goals / Review), keeping Today centered and visually primary (larger icon or the pill-highlighted style your current "TODAY" tab already has).
Given Chests/Goals are check-in-occasionally features rather than daily-interaction ones, I'd default to the first option — it matches the spec's own framing of Finance's daily interaction as lightweight (§25).

## B.9 General UI polish pass

**What:** You flagged the pages as "a bit lacking" overall — here's where to spend that effort now that the data model additions are settled, so you're not polishing UI that's about to change shape again.

**How:** Once B.1–B.7 are wired, do a consistency pass:
- Standardize card padding/radius across every page to match your current Today page (`rounded-2xl`, consistent `p-4`/`p-5`)
- Add empty states everywhere a list can be empty (no chests beyond the two defaults yet, no goals yet, no history yet) — one line of muted text plus a call-to-action button, not a blank card
- Add loading skeletons (simple pulsing gray blocks matching card shapes) for any page doing a server fetch, so navigation doesn't feel like a blank flash
- Confirm color use stays consistent: green only for positive/under-budget, red only for over-budget/exceptions/negative balances — don't let chest type badges or icons borrow those same two colors for anything else, or "green" stops meaning "good" at a glance

---

## Suggested build order

1. A.1 → A.2 (schema + migration) — nothing else compiles until this is done
2. A.3 → A.4 → A.5 → A.6 (chests + movements + transfer) — test with `npx prisma studio` before touching UI
3. A.7 → A.8 (daily saving + buffer consolidation onto the new movement system)
4. B.1 → B.2 → B.3 (Today page catches up to the new backend — app is usable again here)
5. A.9 → A.10 → A.11 (goals, backend only)
6. B.4 → B.5 (Chests and Goals pages)
7. B.6 → B.7 (History and Review catch up)
8. A.12 (final compile-error sweep — do this last as a safety net, but run `tsc --noEmit` after every step above too)
9. A.13, then B.8 → B.9 (seed data polish, nav decision, visual consistency pass)
