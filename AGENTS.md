# AI Agent Guide

This repository is worked on by AI coding agents. Follow this guide before changing code.

## Current State

- Product: `treasure.loop`, a treasure hunt protocol for Web3 conferences.
- App root: `webapp/`.
- Framework: Next.js App Router, React, TypeScript, Tailwind CSS v4.
- UI system: shadcn/ui `base-nova` components with Base UI primitives and lucide icons.
- The marketing landing page at `/` is design-approved; preserve it.
- The product surfaces (`/app/**`, `/play/**`, `/login`) run on real auth
  (Clerk + SIWE) and real Postgres data. Shared console primitives live in
  `webapp/components/product/`. Strategic and visual context live in
  `PRODUCT.md` and `DESIGN.md` at the repo root.

Read [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) before making non-trivial changes.

## Required Workflow

1. Check `git status --short --branch` before editing.
2. Read the relevant files before making assumptions.
3. Keep changes small and commit each coherent slice.
4. Do not add co-author trailers to commits.
5. Do not rewrite, squash, amend, or reset history unless explicitly asked.
6. Run verification before reporting that work is done.

The user specifically wants a clean git history:

- Commit every small completed change.
- Use normal single-author commits from the configured git identity.
- Do not add `Co-authored-by` lines.
- Keep unrelated changes in separate commits.

## Common Commands

Run commands from `webapp/` unless noted otherwise.

```bash
npm run lint
npm run build
npm run dev -- --port 3000
npm run start -- --port 3000
```

If a port is occupied, use a different one rather than killing unrelated processes.

## Repository Structure

```text
.
├── README.md                         # Product concept
├── AGENTS.md                         # Agent operating guide
├── PROJECT_CONTEXT.md                # Product and technical context
├── PRODUCT.md / DESIGN.md            # Strategic + visual design context
├── ROADMAP.md                        # Phased delivery plan (keep updated)
├── compose.yaml                      # Local Postgres 16
├── contracts/                        # Foundry: TreasureLoopBadge.sol + tests
├── treasureloop-*.png                # Screenshot evidence from prior work
└── webapp/
    ├── app/
    │   ├── page.tsx                  # Marketing landing page (approved)
    │   ├── login/, sign-up/          # Clerk auth screens
    │   ├── app/**                    # Operator console (real data)
    │   ├── play/**                   # Attendee surface (wallet + SIWE)
    │   ├── api/                      # play APIs, health, Clerk webhook
    │   └── globals.css               # Tailwind v4, shadcn tokens, landing CSS, .product-shell
    ├── components/ui/                # shadcn generated components
    ├── components/product/           # Shared console kit
    ├── db/                           # Drizzle schema, migrations, seed
    ├── lib/                          # authz, queries, actions, stores, format
    ├── tests/                        # vitest + PGlite suite
    └── package.json
```

## Design Rules

The project currently mixes a brand surface and product surfaces. Keep their design systems separate.

### Landing Page

- Route: `/`.
- Uses expressive brand design.
- The elegant serif display typography is acceptable here.
- Visual style should feel like a high-end Web3 conference product.
- Preserve the landing design unless explicitly asked to redesign it.

### Product UI

- Routes: `/login`, `/app`.
- These need redesign and are currently only a mock.
- Product UI should be operational, restrained, and trustworthy.
- Avoid oversized editorial typography in dashboards, tables, nav, labels, buttons, and forms.
- Use shadcn components first before custom UI.
- Use semantic tokens such as `bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`.
- Do not override shadcn components with one-off decorative styling unless the design direction is explicit.

### Important Pitfall

Do not let landing-page global CSS affect product routes. In particular:

- Avoid broad selectors like global `h1`, `h2`, or `h3` for display typography.
- Scope landing-specific rules to landing classes such as `.hero h1`, `.section h2`, `.story-band p`.
- shadcn `--font-heading` should remain suitable for product UI unless a design decision changes it.

## shadcn Rules

- Config: `webapp/components.json`.
- Import UI components from `@/components/ui/...`.
- Use `cn()` from `@/lib/utils` for conditional classes.
- Use lucide icons.
- For form layout, prefer `FieldGroup`, `Field`, `FieldLabel`, `FieldDescription`.
- Use full `Card` composition: `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` when appropriate.
- Do not import a shadcn component unless it exists in `webapp/components/ui/`.
- If adding shadcn components, use the CLI from `webapp/`:

```bash
npx shadcn@latest add <component>
```

After adding components, inspect generated files and run verification.

## Seed Data

There is no mock-data module. Dev data comes from `webapp/db/seed.ts`
(`npm run db:seed` against the compose Postgres):

- `ETH Cluj 2026: TreasureLoop Pilot`
- Venue: `Cluj Innovation Hall`
- Network: `base-sepolia`
- 5 checkpoints with TOTP secrets, 5 sponsors, 4 rewards

Keep seed data realistic and coherent. If you change the event size,
update all related rows together. Product screens must only render real
database state — show honest empty states instead of invented numbers.

## Verification Requirements

Before reporting completion, run at least:

```bash
cd webapp
npm run lint
npm run build
```

For UI work, also run a local server and capture screenshots for changed routes:

```bash
npm run start -- --port 3010
npx playwright screenshot --viewport-size=1440,1100 http://localhost:3010/<route> ../<name>.png
```

Check screenshots visually before committing them.

## Known Design Status

- Landing page: design-approved, preserve unless directed otherwise.
- Login / sign-up: real Clerk auth in the split layout; styled via
  `appearance` in `app/layout.tsx` plus `.cl-*` rules in globals.css.
- Operator console: redesigned 2026-06 as a quiet operations tool on the
  shared kit in `webapp/components/product/`. Build on it; don't fork
  one-off page patterns.
- Attendee play surface: phone-first, one primary action per screen
  (`PlayCta`), real event sheet from `GET /api/play/event`.
- The screenshots in the repo are evidence from iterations, not final
  design requirements.

## Commit Guidance

Use short, direct commit messages:

```text
Document agent workflow
Add shadcn app primitives
Mock organizer login
Refine event dashboard layout
```

Do not include:

```text
Co-authored-by: ...
Generated with ...
```

## Before Starting Product UI Redesign

Future agents should not continue patching the current `/app` styling blindly. First decide and document:

1. Who the screen is for: organizer, sponsor, booth staff, attendee, or prize desk operator.
2. What the primary task is.
3. What data matters in the first viewport.
4. Whether the surface is a dashboard, setup wizard, staff console, or attendee web app.
5. Which pieces are mock-only and which are intended architecture.

Then implement in small commits with screenshots.
