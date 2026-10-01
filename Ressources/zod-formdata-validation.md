# Form validation and error handling with `FormHandler`

One generic class validates every form in the app and returns errors in one shape. This guide replaces the first version of this file. It explains what was wrong, the target design, a step-by-step build for `/finance/setup`, and the roadmap for the other forms.

Stack this was checked against: Next.js 16.3.5, React 19.2, Zod 4.6.5.

## 1. What is wrong today

- **The setup form cannot save.** The page posts `allocations[0][name]`, but `readSetupFormData` reads `allocationName`. Allocations arrive empty, so `min(1)` always fails.
- **The failure is invisible.** The error lands in `fieldErrors.allocations`; the page renders only `formErrors`.
- **`FormHandler` only fits setup.** Its result type is hard-coded, it throws away the generic `<T>`, and it picks a reader with a `switch` on a form-name string. Every new form would mean editing the class.
- **Row errors are lost.** `error.flatten()` collapses `allocations.0.amount` to `allocations`. It is also deprecated in Zod 4.
- **The action re-reads raw `FormData` after validating**, with silent defaults (a fabricated "Daily Living" allocation of 0).
- **`setup/actions.ts` exposes too much.** Every export of a `'use server'` file is a Server Action and must be treated as reachable by a direct POST. It exports `resolveSessionUserId` and accepts repository objects as extra parameters.
- **The other 8 actions (9 forms) have no usable validation.** The four on the today page read `Number(formData.get('amount') ?? 0)` and pass it on unchecked. The other four check a little and `throw new Error`, which lands on the global error page instead of in the form.

The first version of this guide assumed repeated flat names (`allocationName`, read with `getAll`). The page moved to indexed names and the reader did not. That drift is the root cause, so the new design makes drift impossible: one helper builds the input name and the error key.

## 2. The design

```
<form>  ──FormData──▶  action (auth)  ──▶  form.submit(formData, run)
                                              │ 1. formDataToObject   "a.0.b" → { a: [{ b }] }
                                              │ 2. schema.safeParse   strings → typed data
                                              │ 3. run(data)          use case
                                              ▼
useActionState  ◀──FormState──  { status, fieldErrors, formErrors, values }
```

| File | Role | Edited per new form? |
| --- | --- | --- |
| `lib/forms/formState.ts` | `FormState` type and field helpers. No Zod, no React. | Never |
| `lib/forms/formData.ts` | Decodes `FormData` into a nested object. | Never |
| `lib/forms/FormHandler.ts` | The class: `parse` and `submit`. | Never |
| `lib/forms/fields.ts` | Shared field builders (`moneyField`, `requiredText`). | Rarely |
| `domain/finance/options.ts` | Allowed values (periods, categories). One source of truth. | When a list changes |
| `domain/finance/errors.ts` | `FinanceRuleError` for expected rule violations. | Never |
| `app/<route>/schema.ts` | The form's schema and its `FormHandler` instance. | **Yes, one per form** |
| `app/<route>/actions.ts` | Auth, `form.submit`, revalidate or redirect. | **Yes** |
| `components/ui/field-error.tsx` | Renders one field's error. | Never |

Rules that keep it stable:

1. **`FormHandler` never changes when a form is added.** It is generic over the schema. A form is `new FormHandler(schema)`.
2. **The instance stores only the schema.** It is shared by all requests, so it must never hold submitted data.
3. **One name syntax: dot paths.** `allocations.0.amount` is the input `name`, the decoder path, and the error key. Build it with `fieldName('allocations', 0, 'amount')` everywhere.
4. **The schema is the only gate.** The decoder shapes data; it validates nothing. `z.object` drops unknown keys.
5. **Schemas decode the wire format** (string to number, allowed values). Business rules stay in the domain and use cases, which throw `FinanceRuleError`.
6. **Actions stay plain `export async function`.** A `'use server'` file may export only async functions, so the `FormHandler` instance lives in `schema.ts`.
7. **`redirect()` goes after `submit`, outside any `try`.** It works by throwing.

## 3. Build it for the setup form

Do the steps in order. Steps 1 to 4, 6 and 10 only add files and compile on their own. Steps 5, 7, 8, 9 and 11 are one change: from Step 5 until Step 11 is finished, `app/finance/setup/actions.ts` and `page.tsx` do not compile. That is expected, so do not run lint or tests in between.

### Step 1. Allowed values in the domain

`domain/finance/options.ts`

```ts
export const ALLOCATION_PERIODS = ['monthly', 'weekly'] as const
export const ALLOCATION_CATEGORIES = ['fixed', 'subscription', 'daily_living', 'savings', 'custom'] as const
export const INCOME_FREQUENCIES = ['monthly', 'weekly', 'occasional', 'recurring'] as const

export type AllocationPeriod = (typeof ALLOCATION_PERIODS)[number]
export type AllocationCategory = (typeof ALLOCATION_CATEGORIES)[number]
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number]
```

These lists exist today as four inline copies. Later, point `BudgetPeriod`, `SetupPeriod` and the page's local types at these.

### Step 2. A typed rule error

`domain/finance/errors.ts`

```ts
// An expected business-rule violation, safe to show to the user.
// `field` is the input name the message belongs to, when there is one.
export class FinanceRuleError extends Error {
  readonly field?: string

  constructor(message: string, field?: string) {
    super(message)
    this.name = 'FinanceRuleError'
    this.field = field
  }
}

export const isFinanceRuleError = (error: unknown): error is FinanceRuleError =>
  error instanceof FinanceRuleError
```

It lives in the domain because use cases throw it. `lib/forms` must not import finance code, so the handler receives the guard as an option.

### Step 3. The shared state

`lib/forms/formState.ts`

```ts
export type FormState = {
  status: 'idle' | 'error' | 'success'
  // Keyed by input name, e.g. "incomeAmount" or "allocations.0.amount".
  fieldErrors: Record<string, string[]>
  formErrors: string[]
  // Submitted values, echoed back on error so uncontrolled inputs can restore them.
  values?: Record<string, string>
}

export const initialFormState: FormState = { status: 'idle', fieldErrors: {}, formErrors: [] }

// fieldName('allocations', 0, 'amount') gives "allocations.0.amount".
export function fieldName(...segments: (string | number)[]): string {
  return segments.join('.')
}

export function fieldError(state: FormState, name: string): string | undefined {
  return state.fieldErrors[name]?.[0]
}

// Pass a `scope` when a page holds several forms with the same field names,
// so their error ids stay unique.
export function fieldErrorId(name: string, scope?: string): string {
  return scope ? `${scope}-${name}-error` : `${name}-error`
}

// Spread onto an input: sets its name and links it to its error message.
export function fieldAttributes(state: FormState, name: string, scope?: string) {
  const hasError = fieldError(state, name) !== undefined

  return {
    name,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? fieldErrorId(name, scope) : undefined,
  }
}
```

### Step 4. The decoder

`lib/forms/formData.ts`

```ts
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_DEPTH = 4
const MAX_INDEX = 99
const INDEX_PATTERN = /^\d+$/

type Node = Record<string, unknown> | unknown[]

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

function readChild(node: Node, segment: string): unknown {
  if (Array.isArray(node)) return node[Number(segment)]
  return Object.hasOwn(node, segment) ? node[segment] : undefined
}

function writeChild(node: Node, segment: string, value: unknown) {
  if (Array.isArray(node)) node[Number(segment)] = value
  else node[segment] = value
}

function isValidSegment(node: Node, segment: string): boolean {
  if (segment === '' || FORBIDDEN_KEYS.has(segment)) return false
  return Array.isArray(node) ? INDEX_PATTERN.test(segment) && Number(segment) <= MAX_INDEX : true
}

// "allocations.0.amount" becomes { allocations: [{ amount }] }.
// A digits-only segment is always a row index from 0 to 99, never an id or a
// year: name such fields with a prefix, e.g. "goals.g17.amount".
// Skipped: files, React's "$ACTION_" keys, malformed or unsafe paths, and
// entries that conflict with an earlier one. A repeated key keeps its last value.
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const root: Record<string, unknown> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string' || key.startsWith('$ACTION_')) continue

    const segments = key.split('.')
    if (segments.length > MAX_DEPTH) continue

    setPath(root, segments, value)
  }

  return root
}

function setPath(root: Record<string, unknown>, segments: string[], value: string) {
  // Resolve the whole path before writing, so a rejected entry leaves no trace.
  const pending: { parent: Node; segment: string; child: Node }[] = []
  let node: Node = root

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index]
    if (!isValidSegment(node, segment)) return

    const nextIsIndex = INDEX_PATTERN.test(segments[index + 1])
    const existing = readChild(node, segment)

    if (existing === undefined) {
      const child: Node = nextIsIndex ? [] : {}
      pending.push({ parent: node, segment, child })
      node = child
    } else if (isNode(existing) && Array.isArray(existing) === nextIsIndex) {
      node = existing
    } else {
      return
    }
  }

  const last = segments[segments.length - 1]
  if (!isValidSegment(node, last) || isNode(readChild(node, last))) return

  for (const { parent, segment, child } of pending) writeChild(parent, segment, child)
  writeChild(node, last, value)
}

// Flat string entries of a submission, echoed back on error.
export function formDataToValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}

  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string' && !key.startsWith('$ACTION_') && !FORBIDDEN_KEYS.has(key)) {
      values[key] = value
    }
  }

  return values
}
```

Why these limits: the client controls the keys. The caps and the forbidden-key guard stop a crafted request from building huge arrays or touching object prototypes.

### Step 5. The class

`lib/forms/FormHandler.ts` (replace the current file)

```ts
import type { z } from 'zod'

import { formDataToObject, formDataToValues } from './formData'
import type { FormState } from './formState'

export type ParseResult<T> = { ok: true; data: T } | { ok: false; state: FormState }

export type RuleError = { message: string; field?: string }

type FormHandlerOptions = {
  // Tells an expected rule violation (shown in the form) from a crash (rethrown).
  isRuleError?: (error: unknown) => error is RuleError
}

export class FormHandler<S extends z.ZodType> {
  private readonly schema: S
  private readonly isRuleError?: (error: unknown) => error is RuleError

  constructor(schema: S, options: FormHandlerOptions = {}) {
    this.schema = schema
    this.isRuleError = options.isRuleError
  }

  parse(formData: FormData): ParseResult<z.output<S>> {
    const parsed = this.schema.safeParse(formDataToObject(formData))

    if (parsed.success) {
      return { ok: true, data: parsed.data }
    }

    const fieldErrors: Record<string, string[]> = {}
    const formErrors: string[] = []

    for (const issue of parsed.error.issues) {
      if (issue.path.length === 0) {
        formErrors.push(issue.message)
      } else {
        const key = issue.path.map(String).join('.')
        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
      }
    }

    return {
      ok: false,
      state: { status: 'error', fieldErrors, formErrors, values: formDataToValues(formData) },
    }
  }

  async submit(formData: FormData, run: (data: z.output<S>) => Promise<void>): Promise<FormState> {
    const result = this.parse(formData)

    if (!result.ok) {
      return result.state
    }

    try {
      await run(result.data)
    } catch (error) {
      if (!this.isRuleError?.(error)) {
        throw error
      }

      return {
        status: 'error',
        fieldErrors: error.field ? { [error.field]: [error.message] } : {},
        formErrors: error.field ? [] : [error.message],
        values: formDataToValues(formData),
      }
    }

    return { status: 'success', fieldErrors: {}, formErrors: [] }
  }
}
```

- `parse` is for when you only need the data. `submit` is the normal path for an action.
- `submit` catches only rule errors. Crashes and Next's `redirect()` signal pass through untouched, which is why the class needs no Next import.
- Keys come from `issue.path`, so a row error is `allocations.0.amount`. Do not use `flatten()` or `z.flattenError`; both collapse to `allocations`.
- `values` echoes every string field. Never use it on a form with a password.

### Step 6. Shared field builders

`lib/forms/fields.ts`

```ts
import { z } from 'zod'

export const requiredText = (message: string, max = 120) =>
  z
    .string({ error: message })
    .trim()
    .min(1, message)
    .max(max, `Keep it under ${max} characters.`)

// String first, then number. Never z.coerce.number() on raw input:
// it turns "" into 0 and accepts "1e3".
export const moneyField = z
  .string({ error: 'Enter an amount.' })
  .trim()
  .min(1, 'Enter an amount.')
  .regex(/^\d{1,12}(\.\d{1,2})?$/, 'Use digits only, for example 60000.')
  .transform(Number)
  .pipe(z.number().positive('Enter an amount greater than zero.'))
```

In Zod 4 the options key is `error`, not `message` or v3's `required_error`. A bare string as second argument also works. The 12-digit cap keeps amounts within what a JavaScript number holds exactly.

### Step 7. The setup schema and its handler

`app/finance/setup/schema.ts`

```ts
import { z } from 'zod'

import { isFinanceRuleError } from '@/domain/finance/errors'
import { ALLOCATION_CATEGORIES, ALLOCATION_PERIODS, INCOME_FREQUENCIES } from '@/domain/finance/options'
import { FormHandler } from '@/lib/forms/FormHandler'
import { moneyField, requiredText } from '@/lib/forms/fields'

const allocationSchema = z.object(
  {
    name: requiredText('Enter an allocation name.'),
    amount: moneyField,
    period: z.enum(ALLOCATION_PERIODS, { error: 'Choose a period.' }),
    category: z.enum(ALLOCATION_CATEGORIES, { error: 'Choose a category.' }),
  },
  // Shown when a whole row is missing, e.g. indexes 0 and 2 posted without 1.
  { error: 'Fill in this allocation.' },
)

export const setupPlanSchema = z.object({
  incomeSource: requiredText('Enter an income source.'),
  incomeAmount: moneyField,
  incomeFrequency: z.enum(INCOME_FREQUENCIES, { error: 'Choose a frequency.' }),
  allocations: z
    .array(allocationSchema, { error: 'Add at least one allocation.' })
    .min(1, 'Add at least one allocation.')
    .max(50, 'That is too many allocations.'),
})

export type SetupPlan = z.output<typeof setupPlanSchema>

export const setupForm = new FormHandler(setupPlanSchema, { isRuleError: isFinanceRuleError })
```

The schema and instance live here, not in `actions.ts`, because the tests need to import them and a `'use server'` file may only export async functions.

Then delete `lib/forms/schema.ts`. Its only importers are the old `FormHandler.ts` (replaced in Step 5) and `actions.ts` (replaced in Step 9).

### Step 8. Move the session helper

Create `infrastructure/auth/sessionUser.ts`, with no `'use server'` directive. Move the body of `resolveSessionUserId` into it unchanged, with these imports (the relative paths it uses today do not resolve from the new folder):

```ts
import { getServerSession } from 'next-auth'

import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { prisma } from '@/infrastructure/prisma/client'
```

In `application/finance/setupFinancePlan.test.ts`, change line 5 to `import { resolveSessionUserId } from '@/infrastructure/auth/sessionUser'`. Leave `actions.ts` alone; Step 9 replaces the whole file.

This stops the helper being exported as a Server Action and takes the Prisma import out of the setup action. The other four action files still import `prisma` until roadmap row 11.

### Step 9. The action and the one-time rule

Setup runs once: a principal income and the first allocations. Adding incomes or editing the plan are later features and must not go through this action.

`app/finance/setup/actions.ts` (the whole file)

```ts
'use server'

import { redirect } from 'next/navigation'

import { createSetupPlan } from '@/application/finance/createSetupPlan'
import { resolveSessionUserId } from '@/infrastructure/auth/sessionUser'
import type { FormState } from '@/lib/forms/formState'

import { setupForm } from './schema'

export async function saveSetupPlan(_previousState: FormState, formData: FormData): Promise<FormState> {
  const userId = await resolveSessionUserId()

  const state = await setupForm.submit(formData, (plan) => createSetupPlan(userId, plan))

  if (state.status !== 'success') {
    return state
  }

  redirect('/finance')
}
```

The action uses validated data only. The saving lives in three places:

- `financeRepository.createInitialPlan` writes the income and allocations in one transaction, and writes nothing if the user already has an income.
- `application/finance/createSetupPlan.ts` calls it and throws `FinanceRuleError('Your plan is already set up...')` when it was refused. `FormHandler` turns that into a message above the Save button.
- `app/finance/setup/page.tsx` is a small server page that redirects to `/finance` when a plan exists, and otherwise renders the client form in `setup-form.tsx`.

### Step 10. The error component

`components/ui/field-error.tsx`

```tsx
import { fieldError, fieldErrorId, type FormState } from '@/lib/forms/formState'

export function FieldError({ state, name, scope }: { state: FormState; name: string; scope?: string }) {
  const message = fieldError(state, name)

  if (!message) {
    return null
  }

  return (
    <p id={fieldErrorId(name, scope)} className="text-sm text-destructive-strong">
      {message}
    </p>
  )
}
```

### Step 11. The page

In `app/finance/setup/setup-form.tsx` (the client form):

1. Add the imports:

```tsx
import { FieldError } from '@/components/ui/field-error'
import { fieldAttributes, fieldName, initialFormState, type FormState } from '@/lib/forms/formState'
```

2. Use the shared state: `useActionState(saveSetupPlan, initialFormState)`, and delete the local `initialState`. Submit with `<form onSubmit={handleSubmit}>` instead of `action={formAction}`, where `handleSubmit` calls `event.preventDefault()` then `startTransition(() => formAction(new FormData(event.currentTarget)))`. With `action`, React resets the form after every submit and the controlled selects snap back to their initial option.
3. Delete the two hidden inputs (`allocationCount` and `allocations[i][id]`) and the comment above each. Nothing reads them.
4. On all seven fields (`incomeSource`, `incomeAmount`, `incomeFrequency`, and each row's `name`, `amount`, `period`, `category`), delete the existing `name=...` prop and spread `fieldAttributes` in its place. Change nothing else on the element. It works the same on `NativeSelect`. A leftover `name=` after the spread wins and breaks the form.

```tsx
<Input id="incomeSource" {...fieldAttributes(state, 'incomeSource')} value={incomeSource} onChange={...} className={FIELD_CLASS} />
<FieldError state={state} name="incomeSource" />
```

```tsx
const amountName = fieldName('allocations', index, 'amount')

<Input id={fieldId('amount')} {...fieldAttributes(rowState, amountName)} type="number" ... />
<FieldError state={rowState} name={amountName} />
```

   The page's `fieldId(...)` builds DOM ids for labels; keep it. `fieldName(...)` builds the submitted name.
5. Put each `<FieldError>` as the last child of the field's existing `<div className="... grid gap-2">`, after `<Input />` or after the closing `</NativeSelect>`.
6. Add two more errors: `<FieldError state={state} name="allocations" />` as the first child of the Allocations `<CardContent>`, and `<FieldError state={rowState} name={fieldName('allocations', index)} />` once per row, under its title.
7. Keep rendering `state.formErrors` above the Save button, as now.
8. Row errors are keyed by index, so they point at the wrong row after an add or remove. Remember which result the rows changed under, and hide row errors while it is still the current one:

```tsx
const [staleState, setStaleState] = useState<FormState | null>(null)
const rowState = staleState === state ? initialFormState : state
```

   Call `setStaleState(state)` inside `addAllocation` and in the Trash button's `onClick`, next to its `setAllocations(...)` call. Rows use `rowState`; income fields and the list-level error use `state`. Every submit returns a new state object, so the errors come back on their own.

Keep `type="number"` on the amount inputs. They submit plain strings (`"5000"`, `""` when empty), which `moneyField` handles. Two things to know:

- Without a `step` attribute the browser refuses decimals before the form is sent. Add `step="0.01"` to the three amount inputs only if decision 5 keeps decimals.
- `incomeAmount` is number state that turns an empty field into 0, so its empty-field error reads "greater than zero".

The inputs here are controlled React state, so nothing is lost on error. That is not true for the other forms; see section 4.

### Step 12. Tests

All run under vitest in the node environment, with no Next and no database.

| File | Cases |
| --- | --- |
| `lib/forms/formData.test.ts` | flat keys; `allocations.0.name` builds an array of objects; `$ACTION_` keys skipped; `__proto__.x` and `constructor.x` skipped; index 100 skipped; 5 segments skipped; repeated key keeps the last value; `a` then `a.0` keeps `a`; `File` value skipped |
| `lib/forms/FormHandler.test.ts` | valid input returns typed data; error key is `allocations.1.amount`; a root-level issue goes to `formErrors`; `values` echoed; `submit` does not call `run` when invalid; rule error with `field` goes to `fieldErrors`, without goes to `formErrors`; any other error is rethrown |
| `lib/forms/fields.test.ts` | `moneyField` rejects `""`, `" "`, `"abc"`, `"-3"`, `"1e3"`, `"0x10"`, `"Infinity"`, `"0"`, a 20-digit number; accepts `" 12 "` and `"12.50"` |
| `app/finance/setup/schema.test.ts` | a `FormData` built with `fieldName(...)` parses to the expected plan; zero rows gives `fieldErrors.allocations`; an unknown category gives `allocations.0.category`; only index 1 posted gives `allocations.0` with "Fill in this allocation." |

Build `FormData` in tests with `new FormData()` and `append`. It is a global in Node.

### Step 13. Check it by hand

1. Submit with no allocation: "Add at least one allocation." appears in the card.
2. Add a row, leave the name empty, type `-5` as amount: "Enter an allocation name." and "Use digits only, for example 60000." each sit under their own input. Type `0`: "Enter an amount greater than zero."
3. Fix the row and submit: you land on `/finance` and the rows exist.
4. Run `npm run lint`, then `npx vitest run lib app/finance/setup application/finance/setupFinancePlan.test.ts` to check this work alone. The full `npm test` already has 8 failing tests from the chests work (stale mocks in the `today/actions`, `getHistory`, `getReview` and `recomputeFinanceState` tests); they are not caused by these steps.

## 4. Roadmap for the other forms

Every other form sits in a server-component page and its action is `(formData) => Promise<void>`. Migrating one always means the same four changes:

1. Add `schema.ts` beside the action, with the schema and `export const xForm = new FormHandler(schema, { isRuleError: isFinanceRuleError })`.
2. Change the action to `(_prev: FormState, formData: FormData): Promise<FormState>`, call `xForm.submit`, then `revalidatePath` on success and return the state.
3. Move the `<form>` into a small client component that calls `useActionState`. The page stays a server component.
4. On a page with several forms (today, goals), pass a `scope` to `fieldAttributes` and `FieldError` so two `amount` fields do not share an error id.
5. These inputs are uncontrolled, and React resets a form after its action runs. Restore them with `defaultValue={state.values?.amount}`. Check one `<select>` by hand in the first migration; if it does not restore, give it a `key` built from the echoed value.

Shape of a migrated action:

```ts
export async function createProjectAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await resolveUserId() // the file's existing helper

  if (!userId) {
    return { status: 'error', fieldErrors: {}, formErrors: ['You must be signed in.'] }
  }

  const state = await projectForm.submit(formData, async (data) => {
    await createProject({ userId, ...data })
  })

  if (state.status === 'success') {
    revalidatePath('/projects')
  }

  return state
}
```

Order, simplest first:

| # | Form | Action | Schema fields | Extra work beyond the four changes |
| --- | --- | --- | --- | --- |
| 1 | `/finance/setup` | `saveSetupPlan` | section 3 | The reference build |
| 2 | `/projects` create | `createProjectAction` | `name`, optional `notes` | Add shared `SubmitButton` (uses `useFormStatus`). Keep this action's own `resolveUserId` until row 11 |
| 3 | `/finance/chests` new chest | `createChestAction` | `name`, `type: z.enum(ChestType)` | Today `type` is an unchecked cast. Import `ChestType` from `@/app/generated/prisma/enums` |
| 4 | Fix `recordMovement` | not a form | | It drops `sourceChestId`, `destinationChestId`, `relatedGoalId`, `relatedProjectId` and `notes`. Fix and test before the next rows, or those forms cannot be judged |
| 5 | Transfer (today and chests pages) | `transferBufferToSavings` | `sourceChestId`, `destinationChestId`, `amount` | One schema, two pages. Use cases throw `FinanceRuleError('…', 'destinationChestId')` for same-chest and insufficient balance. Also revalidate `/finance/chests` |
| 6 | Today: add expense | `addExpense` | `amount`, `category`, optional `description` | Needs decision 4. The action also reads `projectId`, which the live form never posts; drop it unless decision 6 keeps `ExpenseQuickAdd` |
| 7 | Today: save remaining | `saveUnderspend` | `amount`, `destinationChestId` | Cap the amount at today's saving in the use case |
| 8 | Today: record exception | `recordException` | `category`, optional `reason` | Stop trusting hidden `plannedAmount` and `actualAmount`; recompute them on the server. The action also reads `resolution`, which no form posts; keep the server default |
| 9 | Goals: create | `createGoalAction` | `name`, `targetAmount`, optional `currentAmount` | Move the chest, goal and movement orchestration out of the action into a use case |
| 10 | Goals: fund | `fundGoalAction` | `goalId`, `sourceChestId`, `amount` | Add a goal ownership check in `fundGoal`: `getGoal` is not scoped by user, so a foreign goal only fails later with "Destination chest not found" |
| 11 | Clean-up | | | Convert remaining `throw new Error` rule violations in use cases to `FinanceRuleError`; narrow `amount: number \| string` inputs to `number`; replace the four copies of `resolveUserId` with the shared helper, after decision 3 (the copies have no `DEFAULT_USER_ID` fallback; the shared helper does); rewrite `app/finance/today/actions.test.ts` |

Out of scope: `/login` (not a server action) and the review and history filters (URL search params, where a silent default is fine).

Optional fields: use `z.string().trim().optional()` and map `''` to `undefined` or `null` inside the action, or add an `optionalText` builder to `fields.ts` when the second form needs it.

## 5. Decisions for you

1. **Re-submitting setup:** decided. Setup runs once; a second save is refused and the page redirects to `/finance`. Multiple incomes and plan editing will be separate features.
2. **Atomic save:** done. One transaction writes the income and allocations.
3. **`DEFAULT_USER_ID` fallback** in `resolveSessionUserId`: keep it, or limit it to development? In production it lets an unauthenticated call act as that user. Settle this before roadmap row 11, when every action starts using this helper.
4. **Expense categories:** one canonical list. Today three live lists disagree (add expense: food, transport, shopping, other; exception: transport, food, emergency, other; history filter: food, transportation, housing, emergency, other), so the history filter can never select `transport` or `shopping` expenses.
5. **Decimals:** XOF has no minor unit, but the today page uses `step="0.01"`. If amounts are whole numbers, change the `moneyField` pattern to `/^\d{1,12}$/`.
6. **`ExpenseQuickAdd`:** it is imported nowhere. Delete it or migrate it?

## 6. Other pitfalls checked against the installed versions

- **Zod 4:** `z.core.toDotPath` gives `allocations[0].amount`, not the dot form. Use `path.map(String).join('.')`.
- **Zod 4:** an object-level `refine` is skipped when a field fails its type check (missing, unknown option) but still runs when a field only fails a check such as `min` or `regex`. It fires inconsistently, so put cross-field rules in the use case.
- **Zod 4:** `safeParse` throws if a schema has an async refinement. Keep schemas synchronous; database checks belong in the use case.
- **Next 16:** the docs say to return expected errors as values and keep `throw` for real failures. Thrown messages are also hidden from users in production.

## 7. Done checklist for each form

- [ ] Input names and error lookups use the same `fieldName(...)` string.
- [ ] Empty, malformed, negative and unknown-option input is rejected with a readable message.
- [ ] Invalid submissions write nothing.
- [ ] Each error shows under its own input, with `aria-invalid` and `aria-describedby`.
- [ ] The action authenticates before anything else and takes no parameter beyond `(previousState, formData)`.
- [ ] The action uses only `submit`'s validated data, never `formData.get`.
- [ ] `actions.ts` exports nothing but actions.
- [ ] Schema tests cover the real field names.
