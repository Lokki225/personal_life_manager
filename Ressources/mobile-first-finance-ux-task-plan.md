# Mobile-First Finance UX Task Plan

This file translates the finance-layer foundation into a task-oriented implementation plan focused on a phone-first daily experience. The goal is to keep the strong financial logic while improving how the app behaves and feels in real use.

---

## Product principle

The app should feel like a daily financial companion, not a desktop accounting tool.

Users on mobile need:
- instant clarity on today’s position
- very fast data entry
- visible decisions: safe / caution / overspent
- quick actions that update financial state immediately
- compact summaries instead of long forms and dense tables

---

## Phase 1 — Mobile-first Today screen

### Task 1.1: Make Today the primary landing screen
**Goal:** The app opens on the current daily state, not on a generic dashboard.

**Implementation:**
- Build a top header with current date and a status badge:
  - Safe
  - Caution
  - Overspent
- Render the following summary cards:
  - Daily remaining
  - Monthly remaining
  - Buffer amount
  - Actual savings
- Keep the layout to a single column on mobile.

**Acceptance criteria:**
- A user sees their financial position before anything else.
- The top summary is legible without scrolling.
- The status text clearly reflects whether today is safe or problematic.

**Tests:**
- Unit test for recomputed state values
- UI test for status rendering
- Snapshot test for mobile layout when no expenses exist

---

### Task 1.2: Add quick action row
**Goal:** Make the core actions easy to reach with one hand.

**Implementation:**
- Add action chips or buttons beneath the summary cards:
  - Add expense
  - Save remaining to buffer
  - Record exception
- Use a sticky action zone if needed for thumb reach.

**Acceptance criteria:**
- The main actions are visible immediately.
- No deeper navigation is required for the most common tasks.

**Tests:**
- UI test: action row renders correctly
- Functional test: save action updates buffer state

---

### Task 1.3: Display today’s expenses in a compact activity list
**Goal:** Let the user understand what has already happened today.

**Implementation:**
- List expenses with:
  - amount
  - category
  - project label if attached
  - optional description
- Keep list items compact and readable.
- Add empty-state text when there are no expenses for today.

**Acceptance criteria:**
- The user can quickly scan today’s spending.
- Project or category information is visible without opening details.

**Tests:**
- UI test for empty state
- UI test for list item rendering

---

### Task 1.4: Add a clear insight strip
**Goal:** The app should explain the current situation in plain language.

**Implementation:**
- Example messages:
  - “You can still save $120 today.”
  - “You are over budget by $85.”
  - “Your weekly buffer is ready to transfer.”
- Use color-coded text with simple wording.

**Acceptance criteria:**
- The insight is understandable without reading financial jargon.
- It directly supports the user’s next action.

**Tests:**
- Unit test for insight generation from state
- UI test for message color logic

---

## Phase 2 — Fast action flows

### Task 2.1: Add expense bottom sheet
**Goal:** Reduce friction when logging money out.

**Implementation:**
- Create a mobile bottom sheet modal for adding an expense.
- Fields:
  - amount
  - category
  - project (optional)
  - description (optional)
- Keep default values minimal and mobile-friendly.

**Acceptance criteria:**
- A user can add an expense in under 10 seconds.
- The form is compact and scroll-safe on a phone.

**Tests:**
- Functional test for new expense creation
- Validation test for invalid amount
- UI test for modal open/close behavior

---

### Task 2.2: Save remaining to buffer flow
**Goal:** Make the user’s “save” action feel intentional and accurate.

**Implementation:**
- When remaining today is positive, expose a button:
  - Save remaining to buffer
- Pre-fill with calculated remaining amount.
- Record it as a saving with destination `buffer`.
- After save, ensure the remaining today value is no longer treated as spendable.

**Acceptance criteria:**
- The daily remaining is reduced as expected.
- The buffer increases as expected.
- The daily action becomes unavailable after the state is cleared.

**Tests:**
- Unit test: save flow updates buffer and remaining correctly
- UI test: button appears only when applicable

---

### Task 2.3: Record exception flow
**Goal:** Capture overspend clearly and with explanation.

**Implementation:**
- If overspend is detected, show a dedicated exception action.
- Fields:
  - category
  - reason
  - resolution (optional)
  - planned vs actual values
- Save to `BudgetException` with computed difference.

**Acceptance criteria:**
- Overspend is tracked without hiding the deviation.
- Users can explain why it happened.

**Tests:**
- Functional test: exception is stored with correct difference
- UI test: exception form appears only if overspend > 0

---

## Phase 3 — Weekly buffer and monthly saving flow

### Task 3.1: Expose the buffer as a first-class state
**Goal:** Buffer should be visible, meaningful, and separate from actual savings.

**Implementation:**
- Add a dedicated buffer card on Today and dashboard.
- Show the current total and its current purpose.
- Distinguish it from actual monthly savings.

**Acceptance criteria:**
- Buffer is clearly separate from savings.
- Users understand it represents a temporary financial reserve.

**Tests:**
- Unit test: saving to buffer updates buffer total only

---

### Task 3.2: Add weekly transfer action
**Goal:** Make the transfer from weekly buffer to monthly savings explicit.

**Implementation:**
- Add a CTA when buffer has value:
  - Transfer to savings
- On confirmation, move the amount from buffer to actual savings.
- Update all derived state immediately.

**Acceptance criteria:**
- The transfer is reflected in both buffer and actual savings totals.
- The app does not double-count the amount.

**Tests:**
- Unit test for transfer math
- UI test for CTA visibility

---

### Task 3.3: Prevent stale daily remaining after saving
**Goal:** The system should not leave leftover money both “available” and “buffered”.

**Implementation:**
- Recompute state after buffer saving.
- Ensure the daily action is no longer available once the remaining amount has been transferred or saved.

**Acceptance criteria:**
- A saved amount is no longer treated as available cash.
- The UI reflects zero remaining if that amount was already buffered.

**Tests:**
- Unit regression test for exact user scenario described in the finance flow

---

## Phase 4 — History as a mobile timeline

### Task 4.1: Convert history into a timeline
**Goal:** Make history feel like a sequence of events instead of a raw table.

**Implementation:**
- Render the history as cards grouped by date.
- Each card includes:
  - label
  - amount
  - category
  - project if attached
  - date

**Acceptance criteria:**
- A quick scan shows the recent cash movement clearly.
- The mobile layout is readable and compact.

**Tests:**
- UI test for sorted timeline
- Unit test for date-based grouping

---

### Task 4.2: Add period and type chips
**Goal:** Let users filter their financial movements without friction.

**Implementation:**
- Filter chips:
  - all
  - expense
  - saving
  - exception
  - day / week / month / year
- Apply filter instantly without reload.

**Acceptance criteria:**
- Users can narrow the event list quickly.
- The filter result matches the selected period exactly.

**Tests:**
- Unit test for filter logic
- UI test: chip selection updates list

---

### Task 4.3: Show project names on tagged expenses
**Goal:** Make project tagging useful in real life.

**Implementation:**
- When an expense has a project ID, display project name in the list and detail summary.
- Include project color or label if the design supports it.

**Acceptance criteria:**
- Project-tagged expenses are obvious and traceable.
- Users can understand where the money went without reading the raw database record.

**Tests:**
- Unit test: project name appears on history event

---

## Phase 5 — Goals and projects hub

### Task 5.1: Create a compact goals list
**Goal:** Progress should be clear and motivating.

**Implementation:**
- Show goal name, current amount, target, and progress bar.
- Include a quick manual fund action.

**Acceptance criteria:**
- A user can see goal progress without navigating to a separate page.
- Funding a goal updates progress immediately.

**Tests:**
- Unit test: progress math
- UI test: manual funding flow

---

### Task 5.2: Create a compact project list
**Goal:** Projects should be lightweight and useful on mobile.

**Implementation:**
- Show project name and tagged expense total.
- Add quick create action.
- Allow selecting the project during expense entry.

**Acceptance criteria:**
- Expense tagging is quick and visible.
- The project appears in history and project summaries.

**Tests:**
- Unit test: project association saves correctly
- UI test: project selection field works

---

## Phase 6 — Review scoreboard

### Task 6.1: Keep review as deep-dive insight, not primary entry
**Goal:** Review should explain the financial story, not dominate the app.

**Implementation:**
- Show summary metrics:
  - planned budget
  - actual spent
  - remaining
  - exceptions count
- Group by category and display as bars or simple list cards.

**Acceptance criteria:**
- The user can understand deviations without scanning dense rows.
- It feels like an insight screen, not a spreadsheet.

**Tests:**
- Unit test for review aggregation values
- UI test for breakdown rendering

---

## Phase 7 — Mobile shell and navigation

### Task 7.1: Replace desktop navigation with a compact mobile shell
**Goal:** Keep the app easy to use on one hand.

**Implementation:**
- Use a bottom tab bar with a maximum of 5 destinations:
  - Today
  - History
  - Review
  - Goals
  - More / Projects
- Keep deeply nested flows to a minimum.

**Acceptance criteria:**
- Common tasks are reached in no more than one tap from the main shell.
- The nav does not feel crowded on a phone.

**Tests:**
- UI test for bottom navigation visibility
- UI test for selection states

---

### Task 7.2: Add sticky action button
**Goal:** Most important action should be always at hand.

**Implementation:**
- Add a floating action button or sticky CTA:
  - Add expense
- Place it near the bottom edge for thumb reach.

**Acceptance criteria:**
- The core action is available without scrolling back to the top.
- It remains visible while browsing lists

**Tests:**
- UI test for sticky CTA behavior

---

## Phase 8 — Polish and trust-building

### Task 8.1: Loading, empty, and error state design
**Goal:** Reduce user uncertainty when state is empty or when a write fails.

**Implementation:**
- Add empty states for no expenses, no buffer, no goals, and no history.
- Add minimal loading spinners to action buttons.
- Add inline validation and unsuccessful action feedback.

**Acceptance criteria:**
- The app feels stable and deliberate.
- User always knows if something has failed or is loading.

**Tests:**
- UI tests for empty states
- UI tests for failed submissions

---

### Task 8.2: Consistent visual hierarchy
**Goal:** The app should feel calm and trustworthy.

**Implementation:**
- Strong typography for amounts and status states
- Use display and accent colors only for status, not decoration
- Keep cards visually consistent

**Acceptance criteria:**
- The app reads clearly on a small screen.
- The financial state is the focus, not design noise.

**Tests:**
- Visual regression test for card hierarchy
- Mobile responsiveness tests

---

## Suggested execution order

1. Today screen
2. Add expense + save buffer + exception flows
3. Weekly buffer transfer logic
4. History timeline and filters
5. Goals and projects hub
6. Review screen
7. Mobile navigation shell
8. Loading/empty/error polish

This sequencing keeps the app coherent and ensures each design improvement is tied to a real financial behavior, rather than adding superficial UI layers before the behavior is correct.

---

## Definition of done for the UX upgrade

The app is considered “mobile-first ready” when:
- the user can open the app and immediately understand today’s money situation
- they can add an expense in under 10 seconds
- they can save remaining to buffer with one clear action
- they can see their weekly buffer and monthly savings separately
- the history screen is usable on a phone
- goals and projects are visible without clutter
- the review screen remains a summary layer, not the main interaction

This is the point where the app stops feeling like a tool you maintain and starts feeling like a tool you use every day.
