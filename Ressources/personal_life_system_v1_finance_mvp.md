# Personal Life System — V1 Finance MVP

**Version:** 1.0 MVP  
**Status:** Implementation-ready scope  
**Primary domain:** Finance  
**Architecture:** Global Life Graph + specialized Finance domain

## 1. MVP Vision

The Personal Life System is ultimately a connected graph of intents, goals, desired states, milestones, plans, tasks, execution, events, states, evidence, projects, resources, constraints, decisions, metrics, situations and projections.

**V1 implements only Finance as a fully functional domain.** The global concepts exist only to the extent needed to give Finance the correct foundation and future extensibility.

The MVP should answer:

> **What did I intend financially, what actually happened, what changed, and what is my current financial state?**

## 2. Scope Principle

```text
GLOBAL FOUNDATION
├── Intent
├── Goal
├── Desired State
├── Milestone
├── Plan
├── Task
├── Execution
├── Event
├── State
├── Project
├── Resource
├── Constraint
├── Decision
├── Metric
└── Relationships
        │
        ▼
FINANCE DOMAIN
├── Income
├── Allocation
├── Budget
├── Expense
├── Saving
├── Buffer
└── Budget Exception
```

Only Finance receives complete CRUD, calculations, dashboard, history and review interactions in V1.

## 3. Global Concepts

### Intent
**Intent = the will; what the user wants to achieve or change.**

### Goal
**Goal = the final point the user wants to reach.**

### Desired State
**Desired State = the state that should be true when the goal is reached.**

### Milestone
**Milestone = a defined intermediate state or condition that contributes to achievement of a Desired State.**

### Plan
**Plan = the currently intended route toward a desired result.**

### Task
**Task = an intended actionable piece of work.** V1 may keep tasks lightweight, with boolean assertion where needed.

### Execution
**Execution = what was actually carried out.**

### Event
**Event = a recorded occurrence that happened at a specific time and is relevant because it changes, reveals, or influences the state of one or more objects in the system.**

### State
**State = what is true at a given point in time.**

### Project
**Project = a bounded effort intended to produce a result.** Projects are universal: personal and professional projects both exist.

### Resource
Money is a global resource. Finance provides its specialized representation.

### Constraint
A constraint limits what can currently be done. Finance can expose financial capacity versus required amounts.

### Decision
A deliberate choice that can affect state. V1 may store simple financial decisions.

### Metric
A measurable value. Finance provides metrics such as income, spending, savings, savings rate, deviation and buffer.

## 4. Global Adaptation Loop

```text
INTENT
  ↓
DESIRED STATE
  ↓
PLAN / PATH
  ↓
TASK
  ↓
EXECUTION
  ↓
EVENT
  ↓
ACTUAL STATE
  ↓
COMPARISON
  ↓
DEVIATION / GAP
  ↓
RE-EVALUATION
  ↓
NEW PLAN
```

Finance is the first concrete implementation of this pattern.

**Plan not followed does not automatically mean failure.** The system records reality and lets the user understand and adapt.

## 5. Finance Node

Finance represents:

- where money comes from;
- how money is allocated;
- planned versus actual spending;
- daily and periodic savings;
- buffer;
- unexpected financial events;
- deviations and explanations;
- financial capacity and constraints;
- financial history;
- financial effects on other life objects.

It is not merely:

```text
Income → Expense → Balance
```

Instead:

```text
INTENDED FINANCIAL STATE
        ↓
ALLOCATION / PLAN
        ↓
ACTUAL SPENDING
        ↓
DEVIATION
        ↓
EXPLANATION
        ↓
ADJUSTMENT
        ↓
NEW PLAN
```

## 6. Income

An Income represents money entering the financial system.

Minimum fields:

```text
Income
├── id
├── source
├── amount
├── frequency
├── expected_date
├── actual_date
├── status
└── notes
```

Multiple income sources are supported.

## 7. Allocation

Allocation answers:

> **What is this money intended for?**

Example:

```text
Monthly income
300,000 XOF

Allocation
├── Fixed expenses       100,000
├── Subscriptions         20,000
├── Daily living          60,000
└── Planned savings      120,000
```

Minimum fields:

```text
Allocation
├── id
├── name
├── amount
├── period
├── category
├── start_date
├── end_date
├── recurrence
└── notes
```

V1 prioritizes monthly and daily allocation.

## 8. Daily Budget

A daily budget can derive from a broader allocation.

```text
Monthly daily-living allocation
60,000 XOF
        ↓
Daily budget
≈ 2,000 XOF/day
```

The calculation must use the actual period length.

Core comparison:

```text
DAILY PLAN
    ↓
DAILY ACTUAL
    ↓
DEVIATION
```

## 9. Expense / Actual Spending

An Expense represents actual money spent.

Minimum fields:

```text
Expense
├── id
├── amount
├── category
├── date
├── allocation_id
├── project_id (optional)
├── description
└── notes
```

Historical plans must remain distinct from actual spending.

## 10. Daily Saving

Savings can originate from:

### Planned saving

```text
Monthly allocation
→ Savings allocation
```

### Underspending

```text
Daily budget       2,000
Actual spending    1,600
Difference           400
                    ↓
                Daily saving
```

Minimum fields:

```text
Saving
├── id
├── amount
├── date
├── source
│   ├── planned
│   └── underspending
├── destination
│   ├── savings
│   └── buffer
└── notes
```

## 11. Buffer

The buffer is distinct from long-term savings.

```text
Monday
Budget:       2,000
Spent:        1,600
Surplus:        400
Buffer:        +400
```

The user can configure whether surplus goes to long-term savings or available buffer.

## 12. Budget Exception

Overspending is a deviation, not automatically a failure.

```text
Budget:      2,000
Actual:      3,500
Difference: +1,500
```

Minimum fields:

```text
BudgetException
├── id
├── date
├── planned_amount
├── actual_amount
├── difference
├── category
├── reason
├── context
└── resolution
```

Example:

```text
Category: Transportation
Reason: Unexpected trip
Resolution: Covered by buffer
```

## 13. Financial State

The current state is derived from underlying records.

Typical indicators:

```text
Income
Allocated amount
Actual spending
Remaining allocation
Planned savings
Actual savings
Buffer
Exceptions
```

Example:

```text
FINANCE — CURRENT STATE

Income                 300,000 XOF
Allocated              300,000 XOF
Actual spending        165,000 XOF
Remaining allocation   135,000 XOF
Planned savings        120,000 XOF
Actual savings           8,400 XOF
Buffer                   6,000 XOF
Exceptions                    3
```

## 14. Financial Goals

V1 supports a lightweight financial goal representation.

```text
Goal:
Buy computer

Target:
1,000,000 XOF

Current:
600,000 XOF

Remaining:
400,000 XOF
```

The full universal Goal engine remains future scope.

## 15. Finance ↔ Projects

Projects are global objects, not Finance-owned objects.

Finance connects to projects through financial effects.

```text
Project
  ↓
Financial allocation
  ↓
Expense
  ↓
Financial state
```

Projects can also produce income:

```text
Project
  ↓
Revenue
  ↓
Income
  ↓
Finance
```

V1 allows an Expense or Income to optionally reference a Project.

## 16. Finance ↔ Other Future Nodes

Finance must expose relationships without implementing future domains.

Examples:

```text
Career ↔ Finance
Personal ↔ Finance
Learning ↔ Finance
Projects ↔ Finance
Goals ↔ Finance
```

Example:

```text
Career decision:
Leave job and start business.

Finance impact:
├── Salary disappears
├── Savings may become business capital
└── Monthly cash-flow changes
```

This relationship is why Finance must not be an isolated budgeting application.

## 17. Time

V1 supports:

```text
DAY
WEEK
MONTH
YEAR
```

Underlying events remain available while aggregates are calculated:

```text
Daily events
    ↓
Weekly state
    ↓
Monthly state
    ↓
Yearly state
```

## 18. History

Financial history is first-class.

Examples:

```text
17 Sep
Budget Exception
+1,500 XOF
Transportation
Unexpected trip
```

```text
18 Sep
Daily Saving
+400 XOF
```

History should preserve:

- income;
- expenses;
- savings;
- exceptions;
- allocation changes;
- important decisions.

Historical facts must not be rewritten when plans change.

Example:

```text
Old plan:
2,000 XOF/day

Actual:
3,500 XOF

Historical deviation:
+1,500 XOF

New plan:
2,500 XOF/day
```

The old day remains based on the old plan.

## 19. Reviews

### Daily

```text
What was planned?
What actually happened?
How much did I spend?
Did I save?
Did I exceed the budget?
Why?
```

### Weekly

```text
Planned spending
Actual spending
Savings
Exceptions
Major deviations
```

### Monthly

```text
Income
Allocation
Actual spending
Planned savings
Actual savings
Buffer
Exceptions
Major deviations
Financial goals
```

### Yearly

```text
Income evolution
Spending evolution
Savings evolution
Major decisions
Goal evolution
Recurring deviation patterns
```

## 20. Finance Dashboard

Conceptual structure:

```text
┌──────────────────────────────────────────────┐
│ FINANCE                                      │
│                                              │
│ Current State                                │
│ Income       Available       Savings         │
│ ...          ...             ...             │
│                                              │
├──────────────────────────────────────────────┤
│ THIS MONTH                                   │
│ Planned       Actual        Deviation        │
│ ...           ...           ...              │
│                                              │
├──────────────────────────────────────────────┤
│ ALLOCATION                                   │
│ Daily living       ...                       │
│ Fixed expenses     ...                       │
│ Subscriptions      ...                       │
│ Savings            ...                       │
│                                              │
├──────────────────────────────────────────────┤
│ TODAY                                        │
│ Budget              ...                      │
│ Spent               ...                      │
│ Remaining           ...                      │
│                                              │
│ [Add Expense]       [Save]                   │
│                                              │
├──────────────────────────────────────────────┤
│ RECENT EVENTS                                │
│ +400  Daily saving                           │
│ +1,500 Budget exception — transport         │
└──────────────────────────────────────────────┘
```

The UI should optimize for frequent interaction rather than maximum information density.

## 21. Home Graph

The home screen represents the global Life Graph.

```text
                         LIFE
                          │
          ┌───────────────┼───────────────┐
          │               │               │
       FINANCE         PROJECTS         GOALS
          │
          ├── Income
          ├── Allocation
          ├── Budget
          ├── Spending
          ├── Savings
          └── Exceptions
```

Finance is the only fully interactive domain in V1.

Other nodes can be lightweight placeholders or future navigation targets.

## 22. Core Data Model

```text
User
│
├── Finance
│   ├── Income[]
│   ├── Allocation[]
│   ├── Expense[]
│   ├── Saving[]
│   ├── BudgetException[]
│   └── FinancialGoal[]
│
├── Project[]
├── Goal[]
├── Intent[]
├── Plan[]
├── Task[]
├── Event[]
├── Decision[]
└── Metric[]
```

Important relationships:

```text
Income
  └── contributes_to → Finance State

Allocation
  └── defines → Planned Spending

Expense
  └── records → Actual Spending

Planned Spending
  └── compared_with → Actual Spending

Actual Spending
  └── produces → Deviation

Deviation
  └── may produce → Budget Exception

Underspending
  └── produces → Saving

Saving
  └── increases → Savings / Buffer

Expense
  └── optionally affects → Project

Income
  └── optionally comes_from → Project

Financial Goal
  └── funded_by → Saving / Allocation
```

## 23. Minimum Database Entities

Required:

```text
users
incomes
allocations
expenses
savings
budget_exceptions
financial_goals
projects
```

Lightweight global tables only if required:

```text
intents
goals
plans
tasks
events
decisions
```

Do not create a complete database representation for every theoretical concept before implementation requires it.

## 24. Derived Values

Important values should be derived rather than duplicated.

Conceptually:

```text
remaining_allocation
    = allocated_amount - actual_spending

daily_deviation
    = actual_spending - daily_budget

daily_saving
    = max(daily_budget - actual_spending, 0)

overspending
    = max(actual_spending - daily_budget, 0)
```

The exact semantics of bank balances, transfers and multiple accounts are deferred.

## 25. Main User Flows

### Monthly Setup

```text
Open Finance
    ↓
Enter / confirm income
    ↓
Define allocations
    ↓
Define planned savings
    ↓
System derives daily budget
    ↓
Finance state becomes active
```

### Daily Spending

```text
Open Finance
    ↓
See today's budget
    ↓
Record expense
    ↓
System recalculates actual
    ↓
Under budget?
├── Yes → available saving
└── No  → budget exception
```

### Daily Saving

```text
Daily budget
    ↓
Actual spending
    ↓
Remaining amount
    ↓
[Save]
    ↓
Saving record
    ↓
Savings / Buffer updated
```

### Overspending

```text
Daily budget
    ↓
Actual spending
    ↓
Overspending detected
    ↓
[Record exception]
    ↓
Category
    ↓
Reason
    ↓
Resolution
    ↓
Financial history
```

### Monthly Review

```text
Month
 ↓
Plan
 ↓
Actual
 ↓
Deviation
 ↓
Exceptions
 ↓
Savings
 ↓
Review
 ↓
Adjustment
```

## 26. V1 API / Application Operations

### Income

```text
Create
Edit
Delete
Mark received
View history
```

### Allocation

```text
Create
Edit
Delete
View current allocation
```

### Expense

```text
Record
Edit
Correct/delete
View daily expenses
View period expenses
```

### Saving

```text
Record
Record underspending saving
Assign to buffer
Assign to long-term savings
```

### Exception

```text
Create
Add reason
Add resolution
View history
```

### Financial Goal

```text
Create
Set target
Record funding
View remaining amount
```

### Project

```text
Create
Attach financial expense
Attach financial income
```

## 27. What V1 Does NOT Implement

Explicitly outside the first implementation:

- full Career node;
- full Personal node;
- full Learning node;
- full Health node;
- complete universal Goal engine;
- complete universal Intent engine;
- complete Project management system;
- bank synchronization;
- multiple bank accounts/wallets;
- debt management;
- recurring subscriptions engine;
- account transfers;
- investment tracking;
- advanced Projection / What-if engine;
- AI financial assistant;
- automatic financial decisions;
- complex permissions;
- collaboration;
- mobile/native application.

These are expansion points, not MVP blockers.

## 28. Deferred Finance Questions

The existing Finance specification intentionally leaves these unresolved:

1. Whether a daily saving is a transaction, state transition, or both.
2. How bank-account balances relate to the planned model.
3. Multiple accounts/wallets.
4. Debt and liabilities.
5. Recurring subscriptions.
6. Transfers.
7. User-defined versus system-defined categories.
8. Irregular income allocation.
9. Exact behavior for periods with different lengths.
10. Buffer interaction with long-term savings.
11. Automatic recurring-pattern detection.
12. Which calculations belong to the universal engine versus Finance.
13. How much automation should occur before confirmation.

V1 should not solve these prematurely.

## 29. Technical Architecture Direction

Framework-independent modular architecture:

```text
UI
 │
 ▼
Application / Use Cases
 │
 ▼
Domain
 ├── Global concepts
 └── Finance domain
 │
 ▼
Persistence
```

Finance should remain a domain module rather than leaking its internal implementation into the global graph.

## 30. Framework Decision

The implementation can use:

```text
Laravel
```

or:

```text
Next.js
```

The choice belongs to the next phase.

The specification is intentionally framework-independent.

The comparison should consider:

- development speed;
- database integration;
- authentication;
- server architecture;
- UI complexity;
- graph visualization;
- maintainability;
- deployment;
- future API/mobile needs;
- suitability for a single-user first release.

## 31. V1 Success Criteria

The MVP is successful when the user can:

### Setup
- define income;
- define allocations;
- define planned savings;
- obtain a daily budget.

### Daily use
- see today's budget;
- record expenses quickly;
- see remaining budget;
- record daily saving;
- record exceptions.

### Understanding
- see planned versus actual spending;
- see deviations;
- see reasons;
- see savings;
- see buffer;
- inspect history.

### Goals
- define a financial goal;
- see its funding state;
- connect savings to it.

### Projects
- create a project;
- associate financial effects with it.

### Review
- review today;
- review the week;
- review the month;
- inspect historical periods.

### Navigation
- open Finance from the global graph;
- return to the global graph;
- see Finance's major state at a glance.

## 32. Final MVP Boundary

```text
                 PERSONAL LIFE SYSTEM V1
                           │
                           ▼
                    GLOBAL FOUNDATION
                           │
                           ▼
                        FINANCE
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
        PLAN             ACTUAL            STATE
          │                │                │
          ▼                ▼                ▼
     Allocation         Expenses        Dashboard
     Budget             Savings         History
     Goals              Exceptions      Reviews
```

The goal is **not** to build the whole Personal Life System immediately.

The goal is to build a **real, daily-usable Finance application on top of the correct global conceptual foundation**.

## 33. Implementation Phase Boundary

Once this specification is accepted, the next phase is implementation planning only:

```text
1. Choose Laravel vs Next.js
2. Define project structure
3. Define database schema
4. Define authentication
5. Define API / server actions
6. Define Finance services
7. Define calculation rules
8. Define pages and navigation
9. Define graph UI
10. Define daily UX
11. Define review UX
12. Define testing
13. Define deployment
14. Build V1
```

No new conceptual node should be introduced during implementation planning unless an actual implementation problem exposes a genuine contradiction in the model.

## 34. Design Rule

```text
UNDERSTAND
   ↓
DEFINE BOUNDARY
   ↓
DEFINE RELATIONSHIPS
   ↓
TEST WITH REAL EXAMPLES
   ↓
FREEZE A VERSION
   ↓
BUILD
```

The system should evolve through deliberate versions instead of attempting to perfectly model every aspect of life before implementation begins.
