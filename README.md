# Personal Life Manager

A finance-first personal life manager built with Next.js, Prisma, and PostgreSQL. The MVP focuses on helping a user track expected income, allocations, actual expenses, savings, buffer management, exceptions, and financial goals in one system.

## Product vision

This project is the first step toward a broader personal life system. The current V1 scope is intentionally finance-only and designed around the flow:

- Income
- Allocation
- Expense tracking
- Savings and buffer management
- Budget deviations and exceptions
- Goal and project-based planning

## Core architecture

The application follows a domain-first structure:

- UI layer: Next.js App Router pages and components
- Application layer: orchestration/use cases
- Domain layer: pure finance calculations and business rules
- Infrastructure layer: Prisma repositories and DB access

This keeps business logic independent from the framework and easier to test.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- NextAuth for authentication
- Vitest for unit tests

## Current MVP capabilities

- Track income sources and expected/actual payment status
- Define monthly or recurring allocations
- Record actual expenses against allocations
- Capture savings and buffer behavior
- Detect variances and budget exceptions
- Track financial goals and project-based finances
- Keep finance calculations in a deterministic domain layer

## Project structure

```bash
app/
  api/
  login/
  page.tsx
application/
domain/
  finance/
infrastructure/
prisma/
public/
```

## Requirements

- Node.js 20+
- PostgreSQL database
- npm

## Local setup

1. Clone the repository.
2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file and set the required environment variables:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"
```

4. Generate Prisma client and apply the schema:

```bash
npx prisma generate
npx prisma migrate dev
```

5. Start the app:

```bash
npm run dev
```

Then open http://localhost:3000.

## Scripts

```bash
npm run dev        # start the development server
npm run build      # production build
npm run start      # start production server
npm run lint       # run ESLint
npm test           # run Vitest suite
npm run test:watch # watch mode for tests
```

## Finance domain rules

The project includes domain-level calculations for values such as:

- days in the current period
- daily budget
- remaining allocation
- daily saving
- overspending

These are intentionally kept in the domain layer so the logic remains testable and framework-independent.

## Validation

The project includes automated checks for the core finance rules and TypeScript validation. Use:

```bash
npm test
npm run lint
npx tsc --noEmit
```

## Roadmap intent

This project is scoped to the finance MVP with a long-term goal of expanding into a broader personal life system. The immediate focus is recording intent vs. actual execution, identifying deviations, and planning adjustments.

## License

This project is currently for personal use and local development unless otherwise specified by the repository owner.
