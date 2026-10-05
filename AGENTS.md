<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Personal Life Manager Agent Instructions

## Project goal
Personal Life Manager is a life graph: a few nodes of a person's life, each with its own screens, sharing one goal engine, one task list and one journal. The specs in `Ressources/` are the source of truth for what to build; the `*-codebase-plan.md` files there record how each one lands in this code.

| Node | State | Code |
|---|---|---|
| Finance | Live for everyone: income, plan, daily budget, expenses, savings and chests, Buffer, debts, exceptions, goals, review | `domain/finance`, `application/finance`, `app/(shell)/finance` |
| Personal | Live for everyone: tasks, sessions, goals and measures, journal (locked entries encrypted), weekly review | `domain/personal`, `application/personal`, `app/(shell)/personal` |
| Career | Being built, administrators only: situation (facts and evidence), goals with criteria, opportunities side by side, weekly loop | `domain/career`, `application/career`, `app/(shell)/career` |
| Projection | Planned ("Coming soon"): ideas, vision, seasons, letters | — |

Shared across nodes:
- **Goal engine** (`domain/goals`, spec `goal-completion-mechanism.md`): goals and conditions in shared tables, each node adds its own measurement sources; results are counts per level, never a percentage.
- **Tasks and journal**: shared tables owned by Personal; Career uses them with `Task.domain = 'career'` and `JournalType.CAREER_LOG`. Personal reads only `domain = 'personal'`.
- **Navigation**: `lib/nav/registry.ts` lists the nodes, their views and who can open them (`all`, `admin`, `none`).
- **Assistant and API**: one operation registry (`application/api`) used by the assistant and by API keys.
- **Offline**: Finance and Personal captures go through an outbox; Career is online only.

## Core architecture rules
- Treat Next.js as the delivery layer, not the application architecture.
- Keep business logic in domain-focused modules and keep them framework-independent.
- Follow the flow: UI → use case → domain → repository → database.
- Do not put Prisma calls in components, route files or use cases. Repository access is isolated to `infrastructure/repositories`.
- Do not inline calculations or rules in server actions or components. Put them in the node's `domain/` folder.
- Every repository method takes the owner's `userId` and filters by it (security plan F1). Every server action checks the session, the node's access and `writesAllowed`.

## Structure
- `app/`: route entry points and thin UI composition (`app/(shell)/<node>` for the nodes)
- `application/<node>/`: orchestration and use cases
- `domain/<node>/`, `domain/goals/`: entities, calculations and pure rules
- `infrastructure/`: Prisma client, repositories, auth, outside services
- `tests/authz/`: integration suites on the development database (`npm run test:authz`), never production
- `public/`: static assets

## Domain-first expectations
- Prefer pure TypeScript functions for rules and calculations; keep them deterministic and testable without a database or HTTP.
- Add or update unit tests for any rule or calculation change, and authorization cases for any new record a person owns.
- Dates are wall-clock dates on the person's clock: call `setClockZone` in each action and page, and pass `now` into domain functions.
- Every user-facing text goes through `t()` / `m()` and has a French translation in `lib/i18n/fr.ts` (the i18n test checks it).

## Styling and UI
- Use Tailwind CSS classes in Next.js components; each node has its accent (`--node-accent`).
- Keep page and component code lean; move reusable logic to utilities or use cases.
- Prefer minimal, readable, production-quality UI over decorative complexity.

## Scope guardrails
- Build what the specs in `Ressources/` describe, in the order of their codebase plan; a node in progress stays `admin` in the registry until it launches.
- Do not build from outdated specs (`career_node_specification_v0.3.md`, `career_node_roadmap.md`).
- Preserve the loop every node follows: intent, execution, deviation, explanation, adjustment, re-plan.
- Ask before adding a node or a shared concept the specs do not describe.

## Workflow for change requests
1. Start from the node's spec and the user outcome.
2. Keep changes narrow; one step of a plan per pull request.
3. Add tests for new rules, and authorization cases for new owned records.
4. Validate with lint, `npx vitest run`, `npm run test:authz` and `npm run build`.
5. Explain trade-offs briefly when choosing between app-level convenience and domain purity.

## Things to avoid
- Direct database access from `app/`, components or use cases
- Mixing Prisma models with UI logic
- Storing calculations in render code instead of domain functions
- Keeping a node's sensitive data (pay, locked journal text) on the device
- Running tests, seeds or load tests against production

## Project snapshot
- Stack: Next.js 16 App Router, TypeScript, Tailwind CSS, Prisma 7 on Neon Postgres, deployed on Vercel (merging to `main` deploys)
- Nodes: Finance and Personal live, Career in progress (admin only), Projection planned
- Long-term direction: the life graph, with each node tracking intended vs actual
