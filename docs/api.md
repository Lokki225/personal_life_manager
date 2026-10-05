# Personal Life Manager API (v1)

The API lets a program act for one person: read their finances, record for
them, and send them notifications. It is what an assistant uses to work with
the app.

Base address: `https://<your-site>/api/v1`

## Keys

Create a key in the app under **My account → API keys**. A key belongs to the
person who made it and reaches only their data. Choose what it may do:

| Kind | Can do |
| --- | --- |
| Only read | Every `GET` endpoint. |
| Read, record and notify | Everything, including `POST`, `PATCH` and `DELETE`. |

The key is shown once. Send it with every request:

```
Authorization: Bearer plm_...
```

A key may make 120 requests a minute. Deleting it in the app stops it at once.

What a key changes is marked with its name in the history, and its owner gets
a notification about it (at most one an hour per key).

## Answers

Everything is JSON. A success wraps the result in `data`:

```json
{ "data": { "left": 500 } }
```

A failure explains itself:

```json
{ "error": { "code": "refused", "message": "You can save at most 500 today.", "field": "amount" } }
```

| Status | `code` | Meaning |
| --- | --- | --- |
| 400 | `invalid_request` | The request is not understood. `field` names the problem. |
| 401 | `unauthorized` | No key, or one that does not exist. |
| 403 | `forbidden` | The key can only read. |
| 404 | `not_found` | Nothing at this address. |
| 422 | `refused` | A rule of the app says no. The message can be shown to the person. |
| 429 | `rate_limited` | Too many requests. Wait a minute. |

Messages are in English.

## Conventions

- **Amounts** are numbers in the currency given by `currency` (XOF), without
  decimals.
- **Dates** are on the person's own clock, written without a time zone:
  `2026-10-03T19:30:00`. "Today" is their today (see `timeZone` in `/me`).
- Reading the finance endpoints first closes any day that ended since the
  person's last visit (leftover to the Buffer, weekly Buffer transfer), exactly
  as opening the app does. The figures therefore match what they see.

## Read

### `GET /me`
Who the key belongs to: `name`, `callName` (how to greet them), `email`,
`language` (`fr`, `en` or null), `timeZone`, and `bufferTransferDay` (the weekday
the Buffer is emptied into the Base Chest: 0 is Sunday, 6 Saturday).

### `GET /finance/today`
The day as it stands.

| Field | Meaning |
| --- | --- |
| `status` | `within`, `over`, or `none` when the plan gives no daily budget. |
| `budget`, `spent`, `saved`, `left`, `over` | The day's figures. |
| `savable` | What could still be put in a chest today. |
| `coveredFromBuffer` | Taken from the Buffer today to pay for an overspend. |
| `expenses` | Today's expenses: `id`, `amount`, `category`, `description`, `at`. |
| `incomesToConfirm` | Incomes waiting for the person to confirm they arrived. |
| `month` | `budget`, `spent`, `left` and `exceptions` for the month. |

### `GET /finance/plan`
`incomes`, `allocations`, their totals, what is `unallocated`, and the
`dailyBudget` they produce.

### `GET /finance/chests`
`total` (everything except borrowed money) and each chest with its `balance`.
`holdsBorrowedMoney` marks the Debts Chest.

### `GET /finance/goals`
Each goal: `reached`, its `conditions` with `target` and `actual`, and how
much of it was `borrowed` and is `stillOwed`.

### `GET /finance/debts`
Each debt or loan: `direction` (`BORROWED` or `LENT`), `counterparty`,
`outstanding`, `dueDate`, `settled`.

### `GET /finance/history`
What was recorded, newest first.

| Query | Values | Default |
| --- | --- | --- |
| `period` | `day`, `week`, `month`, `year` | `month` |
| `type` | `all`, `expense`, `exception`, `movement` | `all` |
| `category` | an expense category | all |

Each entry has `recordedBy`: `"assistant"`, `"api:<key name>"`, or null when
the person recorded it in the app (or the app did, like closing a day).

### `GET /finance/review`
Planned against actual. `period` as above. Includes spending and overspend by
category, and a `trend` per day (or per month for a year).

## Record

These need a key that can record. A `POST` that creates something answers 201.
Each one answers with the part of the app it changed, in the same shape as the
matching `GET`. In a `PATCH`, what is left out stays as it was.

### Today

| Endpoint | Body | Does |
| --- | --- | --- |
| `POST /finance/expenses` | `amount`, `category`, `description`?, `cause`?, `reason`?, `chestId`? | Records an expense made today. With `chestId`, that chest pays at once and today's budget is left alone. |
| `PATCH /finance/expenses/{id}` | any of `amount`, `category`, `description` | Corrects one of today's expenses. |
| `DELETE /finance/expenses/{id}` | | Deletes one of today's expenses. |
| `POST /finance/savings` | `amount`, `chestId`? | Puts part of what is left today into a chest (the Buffer by default). No more than `savable`. |
| `POST /finance/today/exception` | `cause`, `reason`? | Says why today went over budget. |
| `POST /finance/today/cover` | | Pays for today's overspend out of the Buffer. |

- `category`: `food`, `transport`, `shopping` or `other`.
- `cause`: `transport`, `food`, `emergency` or `other`.
- An expense larger than what was left is recorded as an exception too; give
  its `cause` in the same request.
- An expense paid from a chest never goes over the day and is never an
  exception; it cannot take more than the chest holds, nor come out of a
  locked chest. In `/finance/today` it carries `paidFromChest`, and it is not
  in `spent`; `/finance/review` totals them in `paidFromChests`.
- Past days cannot be changed.

```json
{ "amount": 1500, "category": "food", "description": "Lunch" }
```

### Plan

| Endpoint | Body | Does |
| --- | --- | --- |
| `POST /finance/incomes` | `source`, `amount`, `payDay` (1 to 31) | Adds a monthly income. |
| `PATCH /finance/incomes/{id}` | any of `source`, `amount`, `payDay` | Changes an income. |
| `DELETE /finance/incomes/{id}` | | Removes an income. The plan keeps at least one. |
| `POST /finance/incomes/{id}/confirm` | `amount`? | Confirms the income arrived this month. Without `amount`, the usual one. Answers with today. |
| `POST /finance/allocations` | `name`, `amount`, `category`, `period`? | Adds an allocation. |
| `PATCH /finance/allocations/{id}` | any of `name`, `amount`, `category`, `period` | Changes an allocation. |
| `DELETE /finance/allocations/{id}` | | Removes an allocation. |

- Allocation `category`: `fixed`, `subscription`, `daily_living`, `savings` or
  `custom`. `daily_living` feeds the daily budget; `savings` is set aside in a
  chest.
- `period`: `monthly` (default) or `weekly`.
- The chests follow the plan: an allocation takes its money from the Base
  Chest, and gives it back when removed.

### Chests

| Endpoint | Body | Does |
| --- | --- | --- |
| `POST /finance/chests` | `name`, `type`?, `lockedUntil`? | Creates a chest. |
| `DELETE /finance/chests/{id}` | | Deletes an empty chest that no goal uses. |
| `POST /finance/transfers` | `fromChestId`, `toChestId`, `amount` | Moves money between two chests. |
| `PATCH /finance/settings` | `bufferTransferDay` (0 to 6) | Chooses the weekday the Buffer is emptied into the Base Chest. |

- `type`: `AVAILABLE` (default) or `SECURE`. A secure chest can be locked
  until a date (`"2026-12-31"`): nothing leaves it before.

### Goals

| Endpoint | Body | Does |
| --- | --- | --- |
| `POST /finance/goals` | `name`, and `targetAmount` or `conditions` | Creates a goal. |
| `POST /finance/goals/{id}/fund` | `amount`, `fromChestId` | Moves money into the chest of a savings goal. |

A savings goal gets its own chest; `alreadySaved` says what is put aside
already:

```json
{ "name": "Laptop", "targetAmount": 400000 }
```

A custom goal is built from up to 5 conditions, `logic` saying whether `ALL`
(default) or `ANY` must hold:

```json
{ "name": "Calm month", "conditions": [{ "measurement": "monthly_deviation_count", "operator": "LTE", "targetValue": 0 }] }
```

- `measurement`: `chest_balance` (needs `chestId`), `monthly_deviation_count`
  or `monthly_deviation_amount`.
- `operator`: `GTE`, `LTE`, `EQ`, `GT` or `LT`.

### Debts

| Endpoint | Body | Does |
| --- | --- | --- |
| `POST /finance/debts` | `direction`, `counterparty`, `amount`, `interestType`?, `interestValue`?, `chestId`?, `goalId`?, `dueDate`? | Records money borrowed or lent. |
| `POST /finance/debts/{id}/payments` | `amount`, `chestId`? | Records a repayment. |

- `direction`: `BORROWED` (the money goes into the Debts Chest, or into the
  chest of the goal given by `goalId`) or `LENT` (it leaves the Buffer, Base
  Chest or Debts Chest given by `chestId`).
- `interestType`: `NONE` (default), `PERCENT` or `FIXED`, with `interestValue`.
- Repaying borrowed money takes it from `chestId`. Lent money that is repaid
  comes back into the Base Chest.

### Notifications

`POST /notifications` sends a notification to the person's devices.

```json
{ "title": "Halfway through the month", "body": "You are 4,000 under your pace.", "url": "/finance/review" }
```

`url` is the page of the app to open when it is tapped. The answer gives
`delivered`: how many devices received it. `0` means the person has not turned
notifications on.

## Personal

| Call | Does |
| --- | --- |
| `GET /personal/today` | The day's tasks, how full the day is, session time, the one line about today. |
| `GET /personal/goals` | Goals with their status, progress, steps and pace. |
| `POST /personal/tasks` | `title`, for today unless `date`, or `inbox: true`. |
| `POST /personal/tasks/{id}/done` | Ticks a task for today, or `done: false` to untick. |
| `POST /personal/sessions` | `minutes` already spent, ending now; optional `goalId`, `note`. |
| `POST /personal/journal` | A journal entry for today: `text`, optional `kind` and `title`. |

## Career

Results are `MET`, `EXCEEDS`, `GAP` or `UNKNOWN` (a missing value is never
zero), summarised as counts per level, never a percentage. A goal whose
required criteria hold is `CRITERIA_MET`; the person marks it achieved.

| Call | Does |
| --- | --- |
| `GET /career/situation` | Facts true today, the main position, the person's places. |
| `GET /career/goals` | Goals, their status and each criterion's result. |
| `GET /career/opportunities` | Opportunities, their status, deadline, terms and goals. |
| `GET /career/week` | This week's focus, the log, deadlines and the runway. |
| `POST /career/facts` | A fact: `kind` (`POSITION`, `QUALIFICATION`, `SKILL`, `EXPERIENCE`), `title`, optional `since` and terms (`monthlyPay`, `workArrangement`, `contractType`, `weeklyHours`, `place`), `issuer`, `level`. |
| `POST /career/facts/{id}/end` | The fact is no longer true from `date` (today by default). |
| `POST /career/evidence` | Evidence: `title`, optional `url`, `factIds` it documents. |
| `POST /career/goals` | A goal: `name`, optional `why`, `deadline`, `importance`. |
| `POST /career/goals/{id}/criteria` | A criterion: `{ kind: 'number' \| 'choice' \| 'evidence' \| 'judgement', level, ... }`. |
| `POST /career/criteria/{id}/judgement` | The person's verdict: `result`, optional `note`, `opportunityId`. |
| `POST /career/opportunities` | An opportunity: `title`, `organisation`, `kind`, `link`, `deadline`, terms, `goalIds`. |
| `POST /career/opportunities/{id}/status` | `status`; closing needs an `outcome`. |
| `POST /career/focus` | A focus item for this week (3 at most). |
| `POST /career/focus/{id}/done` | Ticks a focus item, or `done: false`. |
| `POST /career/log` | A line in the quick log, optional `goalId`, `opportunityId`. |

Accepting an offer in full (new position, end of the current one, judgements
copied) is done in the app.

## Not in the API

Deleting a goal or a debt, changing a past day, and the first setup of the
plan are not possible through the API, as most are not in the app either.

## Example

```
curl https://<your-site>/api/v1/finance/today \
  -H "Authorization: Bearer plm_..."
```
