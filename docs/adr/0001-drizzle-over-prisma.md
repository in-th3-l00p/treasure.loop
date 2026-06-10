# 0001 — Drizzle ORM over Prisma

## Context

TreasureLoop needs a persistent Postgres data layer (Phase 1 in
`ROADMAP.md`): events, routes, checkpoints, sponsors, players, scans,
badge mints, redemptions, audit log. The app runs on Next.js App Router
deployed to serverless functions, with Neon Postgres in production and
Docker Postgres / PGlite for local dev and tests.

The realistic choices were **Prisma** and **Drizzle**. Requirements that
shaped the call:

- Type-safe queries without hand-writing row interfaces.
- Small cold-start / bundle footprint on serverless functions.
- Migrations checked into git as plain SQL we can read in review.
- A schema we can `grep` and reason about as ordinary TypeScript.
- No separate schema language or code-generation step in the build.

## Decision

Use **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`).

- The schema is a single TypeScript file (`webapp/db/schema.ts`) using
  `pgTable`, with inferred `$inferSelect` / `$inferInsert` row types
  surfaced across the codebase instead of manual interfaces.
- Migrations are generated with `drizzle-kit generate` and applied via
  `npm run db:migrate`; the SQL lives under `webapp/db/migrations/`.
- Queries are SQL-shaped (`select().from().where()`), which keeps the
  mental model close to the database.

## Consequences

**Positive**
- Smaller and lighter than Prisma's engine — better fit for serverless
  cold starts.
- No `prisma generate` step; the schema is just code.
- Inferred types flow straight into queries and the rest of the app.
- Same Drizzle code runs against Neon HTTP (prod) and PGlite (tests),
  so the in-process test suite needs no Docker.

**Negative / trade-offs**
- Drizzle's `pgTable` syntax is verbose (noted in ROADMAP Phase 1
  risks). Resist over-abstracting it until the verbosity actually hurts.
- A smaller ecosystem than Prisma (fewer GUIs, less Stack Overflow). We
  rely on `drizzle-kit studio` for inspection.
- Migration ergonomics are more manual than Prisma Migrate.

## Status

Accepted — 2026-06. Implemented; Phase 1 shipped (Drizzle + Postgres,
11 tables, PGlite tests).
