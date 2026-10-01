# Personal Life System --- Finance Node Specification

**Document status:** Conceptual / evolving\
**Version:** 0.2\
**Purpose:** Preserve the current design of the Finance node and its
connections to the global Life Graph so future nodes can be designed
against the same foundation.

------------------------------------------------------------------------

## 1. Role of the Finance Node

Finance is a **domain node** inside the global personal system.

It is not merely a transaction tracker or a budgeting screen. Its
purpose is to represent:

-   where money comes from;
-   how available money is allocated;
-   what is planned versus actually spent;
-   daily and monthly savings;
-   unexpected financial events;
-   deviations from the plan;
-   explanations for those deviations;
-   financial capacity and constraints;
-   the effect of financial decisions on other parts of life.

The Finance node therefore acts as both:

1.  a **specialized domain model**, and
2.  a participant in the **global Life Graph**.

The Finance node is now considered **conceptually frozen for V1**, with the
understanding that implementation may expose genuine contradictions that
require a future version. The current model incorporates the Chest, Goal,
and money-flow discoveries made during V1 design.

------------------------------------------------------------------------

# 2. Core Finance Model

The basic flow is:

``` text
INCOME
  ↓
ALLOCATION PLAN
  ↓
┌─────────────────────────────────────────┐
│                                         │
├── Fixed expenses                         │
├── Periodic expenses                      │
├── Subscriptions                          │
├── Daily living allocation                │
└── Savings allocation                      │
                                          │
                  ↓                       │
              DAILY BUDGET                 │
                  ↓                       │
              ACTUAL SPENDING              │
                  ↓                       │
          ┌───────┴────────┐               │
          ↓                ↓               │
   UNDER BUDGET       OVER BUDGET          │
          ↓                ↓               │
  DAILY SAVING       BUDGET EXCEPTION      │
                           ↓               │
                    REASON / JUSTIFICATION │
                           ↓               │
                    FINANCIAL HISTORY      │
```

The system should distinguish **planned financial state** from
**observed financial state**.

------------------------------------------------------------------------

# 3. Income

An Income represents money entering the financial system.

Examples:

-   salary;
-   freelance payment;
-   business revenue;
-   occasional income;
-   recurring income;
-   other sources.

An income should contain at least:

``` text
Income
├── Source
├── Amount
├── Frequency
├── Expected date
├── Actual date
└── Status
```

Example:

``` text
Salary
├── Amount: 300,000 XOF
├── Frequency: Monthly
├── Expected: Monthly
└── Status: Expected / Received
```

Multiple incomes may exist simultaneously.

``` text
Finance
├── Salary
├── Freelance
└── Other income
```

------------------------------------------------------------------------

# 4. Allocation

Income should not automatically equal "available spending money".

The user allocates income according to their financial plan.

Example:

``` text
Monthly income
300,000 XOF

        ↓

Allocation
├── Fixed expenses       100,000
├── Subscriptions         20,000
├── Daily living          60,000
└── Planned savings      120,000
```

Allocation is therefore a first-class financial concept.

It answers:

> "What is this money intended for?"

An allocation may be:

-   monthly;
-   weekly;
-   daily;
-   event-based;
-   goal-based;
-   recurring;
-   temporary.

------------------------------------------------------------------------

# 5. Daily Budget

A daily allocation can be derived from a broader allocation.

Example:

``` text
Monthly daily-living allocation
60,000 XOF

        ↓

Daily target
≈ 2,000 XOF/day
```

The exact calculation must account for the configured period and should
not blindly assume every month has 30 days.

The important concept is:

``` text
DAILY PLAN
    ↓
DAILY ACTUAL
    ↓
DEVIATION
```

------------------------------------------------------------------------

# 6. Daily Saving

A user can save money by spending less than the daily allocation.

Example:

``` text
Daily budget:       2,000 XOF
Actual spending:    1,600 XOF
────────────────────────────
Daily saving:         +400 XOF
```

The user can record the 400 XOF as a daily saving.

This means savings can originate from two different mechanisms:

``` text
PLANNED SAVING
    ↓
Explicit monthly / periodic allocation

OPPORTUNISTIC / DAILY SAVING
    ↓
Actual spending below allocated budget
```

Both contribute to the financial state.

------------------------------------------------------------------------

# 7. Budget Exceptions

Spending above the planned daily allocation should not simply be treated
as failure.

It is a **Budget Exception**.

Example:

``` text
Daily budget:       2,000 XOF
Actual spending:    3,500 XOF
────────────────────────────
Excess:             1,500 XOF
```

The user should be able to capture:

``` text
Budget Exception
├── Date
├── Planned amount
├── Actual amount
├── Difference
├── Category
├── Reason / justification
├── Optional context
└── Resolution / funding source
```

Example:

``` text
Date: 17 Sep
Planned: 2,000 XOF
Actual: 3,500 XOF
Excess: 1,500 XOF

Category:
Transportation

Reason:
Unexpected trip

Resolution:
Covered by accumulated buffer
```

The system must allow exceptions without forcing the user to classify
them as "bad".

An unexpected expense is a deviation from a plan, not automatically an
error.

------------------------------------------------------------------------

# 8. Plan vs Actual vs Deviation

This pattern is fundamental to the Finance node.

``` text
PLAN
 ↓
ACTUAL
 ↓
DEVIATION
 ↓
EXPLANATION
 ↓
ADJUSTMENT
```

Example:

``` text
Plan:
2,000 XOF/day

Actual:
3,500 XOF

Deviation:
+1,500 XOF

Explanation:
Unexpected transportation

Adjustment:
Use accumulated buffer
```

The same abstraction should later be reusable by non-financial nodes.

------------------------------------------------------------------------

# 9. Rollover / Buffer

Daily savings may optionally become a financial buffer instead of being
immediately assigned to long-term savings.

Example:

``` text
Monday
Budget:       2,000
Spent:        1,600
Surplus:        400

        ↓

Buffer:         +400
```

Then:

``` text
Tuesday
Budget:       2,000
Buffer:         400
Available:    2,400
```

If Tuesday spending is 2,300:

``` text
Available:    2,400
Spent:        2,300
Remaining:      100
```

The system should therefore distinguish:

``` text
LONG-TERM SAVINGS
vs
AVAILABLE BUFFER
```

The user can configure the behavior.

------------------------------------------------------------------------

# 10. Chests

A **Chest** is a first-class Finance entity representing a financial
container that holds money and defines how that money can be accessed,
transferred, or reserved.

A Chest is not a Goal, allocation, or transaction. It is the place/state
in which money is currently held.

``` text
Chest
├── Identity
├── Type / access policy
├── Balance
├── Money movements
└── Optional relationships to Goals / Projects
```

## 10.1 Chest Types

V1 defines two Chest types:

### Available Chest

Money is normally available for transfer out of the Chest.

``` text
Type: AVAILABLE
```

### Secure Chest

Money is intentionally protected from casual transfer out. A secure
Chest may require additional authorization, such as a password, and may
optionally remain closed until a configured date.

``` text
Type: SECURE

Access policy
├── Password required
└── Optional locked-until date
```

Secure does not mean permanently inaccessible. It means that additional
protection or friction is required before money leaves the Chest.

## 10.2 V1 Main Chests

The Finance node begins with two principal Chests:

``` text
SECURE CHEST
Monthly Savings

Receives planned monthly savings allocations.
Protected against casual removal.

AVAILABLE CHEST
Base Chest

Receives:
├── Daily / monthly allocation leftovers
├── Weekly Buffer consolidation
└── Other explicitly permitted transfers
```

The user may create additional Chests as necessary.

Examples:

``` text
Base Chest
Monthly Savings
Laptop Chest
Emergency Chest
Travel Chest
```

The Base Chest is therefore not the mandatory location of all savings. It
is the main **available reserve** for money that remains available after
planned spending flows.

## 10.3 Chest Balance

A Chest balance should be traceable through financial movements.

Conceptually:

``` text
Opening balance
      +
Money entering
      -
Money leaving
      =
Current balance
```

Moving money between Chests does **not** change total money held by the
Finance system.

Example:

``` text
Before:
Base Chest       100,000
Laptop Chest       0
Total            100,000

Transfer:
Base → Laptop     30,000

After:
Base Chest        70,000
Laptop Chest      30,000
Total            100,000
```

Money leaving the financial system through an actual expense does reduce
the total held amount.

## 10.4 Money Movement

Chest balances change through traceable financial movements.

A movement may conceptually contain:

``` text
Money Movement
├── Source
├── Destination
├── Amount
├── Currency
├── Date / time
├── Type / context
├── Reason
├── Related Goal (optional)
└── Related Project (optional)
```

V1 should distinguish at least the conceptual cases of:

``` text
IN
OUT
TRANSFER
```

with contextual reasons such as:

``` text
DAILY_SAVING
BUFFER_CONSOLIDATION
GOAL_FUNDING
WITHDRAWAL
EXPENSE
```

The final technical representation can be refined during implementation.

## 10.5 Buffer and Chests

Daily remaining money may be directed to the Buffer or to another Chest
according to the user's decision/configuration.

``` text
Daily Budget
     ↓
Actual Spending
     ↓
Remaining
     ├──→ Buffer
     └──→ Any permitted Chest
```

The Buffer is distinct from a Chest in the current conceptual model. It
is an available short-term financial reserve generated from daily budget
surplus.

At the configured weekly consolidation point:

``` text
Weekly Buffer
      ↓
Base Chest
```

This means the Base Chest can accumulate available money from weekly
buffer consolidation without being confused with the planned monthly
savings held in a Secure Chest.

## 10.6 Chests and Goals

A Goal does not own a Chest. A Goal may instead be associated with one or
more Chests that provide funding or evidence for its financial condition.

For the common V1 case, one financial Goal may use one dedicated Chest:

``` text
Goal
"Save 30,000 XOF for headphones"
        │
        │ evaluates
        ▼
Headphones Chest
        │
        └── balance >= 30,000 XOF
```

The Goal is achieved when its configured condition is satisfied; the
Chest remains the financial container.

A Chest may also exist without a Goal.

------------------------------------------------------------------------

# 11. Financial Goals

Finance goals use the global Goal concept rather than introducing a
completely separate financial-goal system.

A Goal represents a **desired condition that reality should satisfy**.
It is evaluated from actual financial state rather than requiring the
user to manually update a generic progress percentage.

Examples:

``` text
Goal A
Save 30,000 XOF for an item

Goal B
Do not exceed 3 monthly deviations
AND
Keep total monthly deviation amount below 10,000 XOF
```

These goals have different evaluation shapes.

## 11.1 Goal Structure

A Goal should conceptually contain:

``` text
Goal
├── Identity
├── Domain
├── Intent relationship (optional)
├── Desired State
├── Conditions
├── Evaluation
├── Time / evaluation period
├── Financial resources / Chests (optional)
├── Projects (optional)
├── Tasks / execution relationships (optional)
└── History
```

The Goal itself should not store a universal `progress_percentage` as its
fundamental truth. Progress is derived from the conditions and current
state and may be visualized differently depending on the goal.

## 11.2 Goal Condition

A condition defines what must be true.

Conceptually:

``` text
Condition
├── Measurement
├── Operator
├── Target value
├── Unit
└── Evaluation period
```

Examples:

``` text
Measurement:
Headphones Chest balance

Operator:
>=

Target:
30,000 XOF

Evaluation period:
None
```

Or:

``` text
Measurement:
Monthly deviation count

Operator:
<=

Target:
3

Evaluation period:
Monthly
```

## 11.3 Condition Groups

A Goal may contain multiple conditions.

V1 should support the simple logical forms:

``` text
ALL conditions must be satisfied
ANY condition may be satisfied
```

Example:

``` text
Goal: Monthly Budget Discipline

ALL:
├── Monthly deviation count <= 3
└── Monthly deviation amount < 10,000 XOF
```

More complex boolean expressions are deferred until genuinely needed.

## 11.4 Goal Evaluation

Goal evaluation follows:

``` text
Goal
  ↓
Conditions
  ↓
Measurements from actual state
  ↓
Comparison with targets
  ↓
Evaluation result
```

For a savings goal:

``` text
Target: 30,000 XOF
Current Chest balance: 18,400 XOF
Gap: 11,600 XOF
Satisfied: No
```

For a deviation goal:

``` text
Deviation count: 2 / 3       ✓
Deviation amount: 7,200 / 10,000 XOF   ✓
Overall condition:           ✓
```

A goal can therefore be **observable through the actual financial state**
rather than through manual progress updates.

## 11.5 Goal Funding

A financial Goal may receive money through explicit financial movements.

Example:

``` text
Base Chest
      ↓
30,000 XOF transfer
      ↓
Laptop Chest
      ↓
Goal condition evaluated
```

Daily remaining money may also fund a Goal Chest directly when the user
chooses it:

``` text
Daily Budget
      ↓
Actual Spending
      ↓
Remaining
      ↓
Save to Goal Chest
      ↓
Goal state updated
```

The same actual financial movement can therefore both change Chest state
and affect Goal evaluation.

------------------------------------------------------------------------

# 10. Financial State

The Finance node should expose a current state rather than only raw
transactions.

Possible state indicators include:

``` text
Income
Allocated amount
Spent amount
Remaining allocation
Planned savings
Daily savings
Accumulated buffer
Actual savings
Unexpected expenses
Monthly deviation
Savings progress
```

A simplified state could be:

``` text
FINANCE — CURRENT STATE

Income              300,000 XOF
Allocated            300,000 XOF
Spent                165,000 XOF
Planned savings      120,000 XOF
Additional savings     8,400 XOF
Buffer                 6,000 XOF
Exceptions             3
```

These values are illustrative; the application should derive them from
actual user data.

------------------------------------------------------------------------

# 11. Historical Financial Events

Financial deviations should remain part of history.

Example:

``` text
17 Sep
Budget Exception
+1,500 XOF
Transport
Unexpected trip
```

This allows the system to answer questions later such as:

> "Why was my actual spending higher than planned this month?"

Instead of only showing:

``` text
Budget: 60,000
Actual: 68,500
```

the system can explain:

``` text
Difference: +8,500 XOF

Main recorded exceptions:
├── Transportation  +4,000
├── Food             +2,500
└── Other            +2,000
```

This turns Finance into a tool for understanding behavior, not merely
recording it.

------------------------------------------------------------------------

# 12. Period Aggregation

The same financial model should work at different temporal scales.

``` text
DAILY
  ↓
WEEKLY
  ↓
MONTHLY
  ↓
YEARLY
```

A daily event should contribute to the corresponding weekly, monthly,
and yearly state.

The user should be able to inspect:

-   today;
-   this week;
-   this month;
-   this year;
-   historical periods.

The aggregation should preserve the underlying events rather than
replacing them.

------------------------------------------------------------------------

# 13. Finance and Goals / Intents

Finance can be both a **resource** and a **constraint** for other
intents.

Example:

``` text
Intent:
Buy a new computer

        ↓

Requirement:
1,000,000 XOF available

        ↓

Finance
├── Current savings
├── Monthly saving capacity
├── Existing commitments
└── Projected acquisition date
```

Another example:

``` text
Intent:
Move into a new apartment

        ↓

Financial requirements
├── Deposit
├── Rent
├── Furniture
└── Emergency buffer

        ↓

Finance
```

The Finance node therefore does not own these intents.

It provides financial state and capabilities that those intents depend
on.

------------------------------------------------------------------------

# 14. Finance and Projects

Personal and professional projects can consume or produce financial
resources.

Examples:

``` text
Project:
Build an application

        ↓
May require
├── Hosting
├── Domain
├── Software
└── Hardware
```

Finance can represent these as:

``` text
Project cost
    ↓
Financial allocation
    ↓
Actual expense
    ↓
Deviation
```

Conversely, a project can produce income:

``` text
Project
  ↓
Revenue
  ↓
Income
  ↓
Finance
```

Projects therefore connect to Finance through **financial effects**, not
because Finance owns the project.

------------------------------------------------------------------------

# 15. Finance and Resources

Money is one of the global system's resources.

The relationship is:

``` text
Finance
  ↓
Financial Resource
  ↓
Consumed by / allocated to
├── Projects
├── Goals
├── Commitments
├── Requirements
└── Life activities
```

This is one of the most important global connections.

Finance should therefore expose a standardized resource representation
that the rest of the system can understand.

------------------------------------------------------------------------

# 16. Finance and Time

Financial planning is time-dependent.

Examples:

``` text
Monthly income
      ↓
Monthly allocation
      ↓
Daily budget
      ↓
Daily actual
      ↓
Monthly result
```

Therefore Finance connects to the global **Time** model.

A financial event should have temporal information such as:

``` text
Expected time
Actual time
Period
Recurrence
```

This makes it possible to project future financial states.

------------------------------------------------------------------------

# 17. Finance and Constraints

Financial constraints can block or modify other plans.

Example:

``` text
Intent:
Enroll in Master's

        ↓

Requirement:
Tuition

        ↓

Constraint:
Current financial capacity

        ↓

Finance
```

The system should be able to represent:

``` text
Current capacity
vs
Required amount
vs
Projected capacity
```

This does not automatically decide what the user should do.

It exposes the relationship so the user can decide.

------------------------------------------------------------------------

# 18. Finance and Metrics

Metrics provide measurable state.

Examples:

``` text
Savings rate
Average daily spending
Average daily saving
Monthly surplus
Monthly deviation
Unexpected expense frequency
Buffer size
Goal funding progress
```

A metric can be attached to Finance while remaining part of the global
Metric model.

This allows other nodes to use the same metric abstraction.

------------------------------------------------------------------------

# 19. Finance and Situations

The global system may detect a **Situation** from Finance data.

Example:

``` text
Situation:
Repeated transportation exceptions

Evidence:
├── 8 exceptions in recent history
├── Repeated category
└── Significant cumulative deviation
```

The system may surface:

> "Transportation has repeatedly caused deviations from the current
> daily budget."

Possible user actions:

``` text
[Review]
[Adjust allocation]
[Keep current plan]
[Ignore]
```

The system should expose evidence rather than silently modifying the
user's financial model.

------------------------------------------------------------------------

# 20. Finance and Decisions

Financial decisions can affect multiple nodes.

Example:

``` text
Decision:
Buy a new computer now

        ↓

Finance
├── Savings decreases
└── Buffer decreases

        ↓

Projects
└── Development capacity may increase

        ↓

Intent
└── App development timeline may change
```

This is a candidate use case for the future **Projection / What-if
Engine**.

------------------------------------------------------------------------

# 21. Finance Node in the Global Life Graph

The Finance node should be represented as a major domain node in the
home graph.

Conceptually:

``` text
                             LIFE
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
       CAREER             FINANCE             PERSONAL
          │                   │                   │
          │          ┌────────┼────────┐          │
          │          │        │        │          │
          │        INCOME  SAVINGS  BUDGET        │
          │          │        │        │          │
          │          │        │        └──→ EXCEPTIONS
          │          │        │                   │
          │          │        └──→ FINANCIAL GOALS
          │          │                            │
          │          └────────→ RESOURCES         │
          │                                      │
          └──────────────────────────────────────┘
```

The graph is not required to display every internal Finance entity
simultaneously.

The Finance node can collapse into a domain-level node on the home
screen and expand when opened.

------------------------------------------------------------------------

# 22. Oriented Global Connections

The principal relationships should be treated as directed relationships.

``` text
Income
  ──provides──→ Financial Resource

Financial Resource
  ──allocated_to──→ Budget / Project / Goal / Commitment

Budget
  ──defines──→ Planned Spending

Planned Spending
  ──compared_with──→ Actual Spending

Actual Spending
  ──produces──→ Deviation

Deviation
  ──explained_by──→ Financial Event / Reason

Underspending
  ──produces──→ Daily Saving

Daily Saving
  ──increases──→ Savings or Buffer

Financial Resource
  ──enables──→ Intent / Project / Requirement

Financial Constraint
  ──constrains──→ Intent / Project / Plan

Financial Decision
  ──affects──→ Financial State

Financial State
  ──affects──→ Projection
```

------------------------------------------------------------------------

# 23. Finance as a Specialized Node, Not a Separate Universe

The architecture should avoid creating an entirely different system for
Finance.

Instead:

``` text
GLOBAL SYSTEM
│
├── Intent
├── Outcome
├── State
├── Requirement
├── Project
├── Execution
├── Action
├── Resource
├── Constraint
├── Event
├── Metric
├── Decision
├── Situation
├── Plan
└── Projection
       │
       ↓
SPECIALIZED DOMAIN
       │
    FINANCE
       │
       ├── Income
       ├── Allocation
       ├── Budget
       ├── Expense
       ├── Saving
       ├── Buffer
       └── Budget Exception
```

The Finance-specific concepts are domain objects built on top of the
universal system.

This approach should make it possible to add other domains later without
rebuilding the core.

------------------------------------------------------------------------

# 24. Finance Node Page

A possible Finance node page:

``` text
┌────────────────────────────────────────────┐
│ FINANCE                                    │
│                                            │
│ Current state                              │
│ Income             300,000 XOF             │
│ Available           ...                    │
│ Savings             ...                    │
│ Buffer              ...                    │
│                                            │
├────────────────────────────────────────────┤
│ THIS PERIOD                                │
│                                            │
│ Planned spending      ...                  │
│ Actual spending       ...                  │
│ Planned savings       ...                  │
│ Actual savings        ...                  │
│ Deviations            ...                  │
│                                            │
├────────────────────────────────────────────┤
│ ALLOCATION                                 │
│                                            │
│ Daily budget          ...                  │
│ Subscriptions         ...                  │
│ Fixed expenses        ...                  │
│ Savings               ...                  │
│                                            │
├────────────────────────────────────────────┤
│ RECENT EVENTS                              │
│                                            │
│ +400  Daily saving                         │
│ +800  Daily saving                         │
│ +1,500 Budget exception — transport       │
│                                            │
├────────────────────────────────────────────┤
│ CONNECTIONS                                │
│                                            │
│ → Savings goals                            │
│ → Projects                                 │
│ → Commitments                              │
│ → Financial constraints                    │
│ → Decisions                                │
└────────────────────────────────────────────┘
```

This is a conceptual structure, not a final UI specification.

------------------------------------------------------------------------

# 25. Daily Finance Interaction

The daily interaction should be lightweight.

Example:

``` text
TODAY

Budget
2,000 XOF

Spent
1,600 XOF

Remaining
400 XOF

[Save 400]
```

If spending exceeds the budget:

``` text
TODAY

Budget
2,000 XOF

Spent
3,500 XOF

Exceeded
1,500 XOF

[Record exception]
```

Then:

``` text
Why?

[Transportation]
[Food]
[Emergency]
[Other]

Reason:
____________________

[Save]
```

The system should minimize friction because Finance is expected to be
used frequently.

------------------------------------------------------------------------

# 28. Daily / Weekly / Monthly / Yearly Reviews

Finance participates in the broader review system.

## Daily

``` text
What was planned?
What actually happened?
Did I save?
Did I exceed the allocation?
Why?
```

## Weekly

``` text
How did actual spending compare with the plan?
What exceptions occurred?
How much was saved?
What patterns appeared?
```

## Monthly

``` text
Income
Allocation
Actual spending
Savings
Exceptions
Major deviations
Financial goals
```

## Yearly

``` text
Income evolution
Spending evolution
Savings evolution
Major financial decisions
Goal progress
Recurring deviation patterns
```

The same review engine should eventually combine Finance with other
domains.

------------------------------------------------------------------------

# 29. Important Architectural Principle

Finance should not be modeled as:

``` text
Income → Expense → Balance
```

The richer model is:

``` text
INTENDED STATE
      ↓
ALLOCATION / PLAN
      ↓
ACTUAL STATE
      ↓
DEVIATION
      ↓
EXPLANATION
      ↓
ADJUSTMENT / DECISION
      ↓
NEW PLAN
```

This pattern is expected to be reusable across the entire application.

Examples outside Finance:

``` text
Project:
Plan → Actual → Delay → Cause → Adjustment

Chess:
Training target → Actual training → Deviation → Reason → Adjustment

Career:
Target milestone → Actual progress → Gap → Cause → Decision

Learning:
Study plan → Actual study → Deviation → Context → Reschedule
```

------------------------------------------------------------------------

# 30. Current Decisions

The Finance node currently establishes these principles:

- Finance is a major node in the global Life Graph.
- Finance has a specialized domain model.
- Income is modeled separately from allocation.
- Allocation is a first-class concept.
- Daily budgets can derive from broader allocations.
- Underspending can become explicit daily savings.
- Daily remaining money may feed the Buffer or another permitted Chest.
- Weekly Buffer consolidation may transfer available money into the Base Chest.
- Planned monthly savings may be allocated directly to a Secure Chest.
- The Base Chest is an Available Chest for accumulated available reserves.
- Finance defines two V1 Chest types: Available and Secure.
- Secure Chests can require additional authorization and may be locked until a date.
- Users may create additional Chests as necessary.
- Chest balances are traceable through financial movements.
- Transfers between Chests do not change total money held by Finance.
- Money leaving through an actual expense does change total money held.
- A Chest may exist without being associated with a Goal.
- A Goal may use one or more Chests as funding/evidence resources.
- Goals represent desired conditions and are evaluated from actual state.
- Goal conditions are based on measurements, operators, targets, units, and evaluation periods.
- V1 Goal condition groups support ALL / ANY evaluation.
- Goal progress is derived rather than being the fundamental stored truth.
- Financial goals may be realized through ordinary financial movements and daily actions.
- Overspending creates a Budget Exception rather than simply a failure state.
- Exceptions store amount, category, date, and justification/reason.
- Plan vs Actual vs Deviation is a reusable system pattern.
- Financial events remain historically traceable.
- Finance aggregates from daily to weekly, monthly, and yearly views.
- Finance connects to goals/intents, projects, resources, constraints, decisions, metrics, situations, time, and projections.
- Personal and professional projects can both consume financial resources.
- Finance does not own external goals or projects; it exposes financial relationships to them.
- The global graph is the navigation layer.
- A Finance node page provides the specialized view of the domain.
- The model is conceptually frozen for V1; future changes should be driven by implementation evidence or genuine contradictions.

# 31. Open Questions for Later

These are intentionally **not resolved yet**. Questions resolved by the
Chest and Goal discoveries have been removed from this list.

1. Whether a daily saving should be represented technically as a movement,
   a state transition, or both.
2. How bank-account balances relate to the planned Finance model.
3. How multiple external accounts/wallets should be represented.
4. Whether debt should be a Finance-specific concept or a general
   Liability/Obligation concept.
5. How recurring subscriptions connect to Commitments.
6. How transfers between external accounts should be represented.
7. Whether financial categories should be user-defined, system-defined,
   or both.
8. How irregular income affects allocation.
9. Exact behavior for periods with different lengths.
10. How automatic recurring-pattern detection should work.
11. Which calculations belong to the universal engine versus Finance.
12. How much automation should be allowed before the user confirms a
    financial state change.
13. Whether Buffer should eventually support configurable consolidation
    schedules beyond the current weekly V1 flow.
14. Whether Secure Chest access policies should evolve beyond password and
    locked-until date.
15. How external bank/wallet synchronization should map into Chests.

These questions should be answered only after real usage or surrounding
domain design exposes a genuine need.

# 32. Next Design Target

The Finance node is currently:

**CONCEPTUALLY FROZEN FOR V1.**

Future nodes should be designed using the same method:

``` text
1. Define the node's purpose
2. Identify its specialized concepts
3. Define its internal flow
4. Define Plan vs Actual vs Deviation where applicable
5. Define its state
6. Define its daily interaction
7. Define weekly/monthly/yearly review
8. Define oriented connections to the global graph
9. Define connections to shared resources
10. Identify unresolved questions
11. Update the global ontology
```

The goal is to progressively build a set of node specifications that can
later be synthesized into the complete **Personal Life System**
architecture.
