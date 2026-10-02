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
`language` (`fr`, `en` or null) and `timeZone`.

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

### `GET /finance/review`
Planned against actual. `period` as above. Includes spending and overspend by
category, and a `trend` per day (or per month for a year).

## Record

These need a key that can record.

### `POST /finance/expenses`
Records an expense made today. Answers with the day as it now stands (the same
shape as `/finance/today`).

```json
{ "amount": 1500, "category": "food", "description": "Lunch" }
```

- `category`: `food`, `transport`, `shopping` or `other`.
- When the amount is more than what was left, the expense is also recorded as
  an exception. Say why with `cause` (`transport`, `food`, `emergency`,
  `other`) and an optional `reason`.

### `PATCH /finance/expenses/{id}`
Corrects one of today's expenses. Send any of `amount`, `category`,
`description`. Past days cannot be changed.

### `DELETE /finance/expenses/{id}`
Deletes one of today's expenses.

### `POST /finance/savings`
Puts part of what is left today into a chest.

```json
{ "amount": 500, "chestId": "..." }
```

Without `chestId` it goes to the Buffer. No more than `savable` can be saved.

### `POST /notifications`
Sends a notification to the person's devices.

```json
{ "title": "Halfway through the month", "body": "You are 4,000 under your pace.", "url": "/finance/review" }
```

`url` is the page of the app to open when it is tapped. The answer gives
`delivered`: how many devices received it. `0` means the person has not turned
notifications on.

## Example

```
curl https://<your-site>/api/v1/finance/today \
  -H "Authorization: Bearer plm_..."
```
