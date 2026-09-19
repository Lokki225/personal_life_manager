<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Personal Life Manager Agent Instructions

## Project goal
This repository is the Personal Life Manager finance MVP. The product vision is a global life system with a first production domain focused on finance: income, allocation, expense, savings, buffer, exceptions, and financial state tracking.

## Core architecture rules
- Treat Next.js as the delivery layer, not the application architecture.
- Keep business logic in domain-focused modules and keep them framework-independent.
- Follow the flow: UI → use case → domain → repository → database.
- Do not put Prisma calls in components or route files.
- Do not inline finance calculations in server actions or components. Put them in domain logic, preferably under `domain/finance`.
- Repository access should be isolated to infrastructure/repository code only.

## Recommended structure
- `app/`: route entry points and thin UI composition
- `application/finance/`: orchestration and use cases
- `domain/finance/`: entities, calculations, and pure business rules
- `infrastructure/`: Prisma client, repositories, persistence adapters
- `public/`: static assets

## Domain-first expectations
- Prefer pure TypeScript functions for money calculations such as daily budget, remaining allocation, overspending, and savings helpers.
- Keep functions deterministic and testable without database or HTTP dependencies.
- Add or update unit tests for any calculation or finance rule change.
- Treat the V1 scope as finance-only. Avoid broad generic life-system features unrelated to the finance MVP unless explicitly requested.

## Styling and UI
- Use Tailwind CSS classes in Next.js components.
- Keep page and component code lean; move reusable logic to utilities or use cases.
- Prefer minimal, readable, production-quality UI over decorative complexity.

## Scope guardrails
- Do not implement unrelated domains such as career, health, or full project management in this V1 unless the user specifically asks for them.
- Do not add broad “generic intent/goal/task” infrastructure before the finance domain truly needs it.
- Preserve the roadmap’s intent: record intent, actual execution, deviation, explanation, adjustment, and re-plan.

## Workflow for change requests
1. Start from the finance domain and user outcome.
2. Keep changes narrow and targeted.
3. Add tests for new business rules and calculations.
4. Validate with the smallest relevant command, typically `npm run lint` for TypeScript/Next.js changes.
5. Explain trade-offs briefly when choosing between app-level convenience and domain purity.

## Things to avoid
- Direct database access from `app/` or components
- Mixing Prisma models with UI logic
- Storing finance calculations in render code instead of domain functions
- Expanding scope beyond the finance MVP without explicit approval

## Project snapshot
- Stack: Next.js 16 App Router, TypeScript, Tailwind CSS
- Primary domain: finance
- Long-term direction: a life graph with finance as the first concrete implementation
- Current goal: deliver a clearly scoped finance MVP that tracks intended vs actual financial state
