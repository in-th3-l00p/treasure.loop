# Contributing to TreasureLoop

TreasureLoop is a treasure-hunt protocol for Web3 conferences. This guide
covers local setup, the dev/test/build loop, and the project conventions
you must follow. Read it before opening a change.

Start with the context docs: `PROJECT_CONTEXT.md` (product + stack),
`ROADMAP.md` (phased plan), `AGENTS.md` (working agreement), and the
per-package READMEs in `webapp/` and `contracts/`.

## Repository layout

```text
.
├── webapp/        Next.js 16 app (operator console, attendee play, APIs)
├── contracts/     Foundry project — TreasureLoopBadge.sol (ERC-721 badge)
├── docs/          Runbook, ADRs (docs/adr/), operator docs
├── compose.yaml   Local Postgres 16 (port 5433)
├── PROJECT_CONTEXT.md / ROADMAP.md / AGENTS.md / README.md
```

## Prerequisites

- **Node.js** — version matching `webapp/.nvmrc` / `engines` if present;
  otherwise current LTS (the app targets Next.js 16 / React 19).
- **npm** — the project's package manager (do not use yarn/pnpm).
- **Docker** (+ Compose) — for the local Postgres 16 used by dev.
- **Foundry** — only if you're working on `contracts/`
  (`forge`, `cast`; install from <https://book.getfoundry.sh>).

## First-time setup (webapp)

Run everything from `webapp/` unless noted.

1. **Install dependencies**
   ```bash
   cd webapp
   npm install
   ```

2. **Start local Postgres** (from the repo root; container exposes
   `localhost:5433`)
   ```bash
   docker compose up -d
   ```

3. **Configure environment.** Create `webapp/.env.local`. The variables
   the app reads:

   | Variable | Required | Purpose |
   |---|---|---|
   | `DATABASE_URL` | yes | Postgres connection. Local: `postgres://postgres:postgres@localhost:5433/treasureloop` |
   | `PLAY_SESSION_SECRET` | prod (dev has a fallback) | 32+ char secret for the encrypted attendee session cookie |
   | `SCAN_URL_SECRET` | prod (dev fallback) | HMAC key for signed scan URLs |
   | `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` | for mint/prize-desk | Deployed badge contract address |
   | `BADGE_SIGNER_PRIVATE_KEY` | for mint | Server signing key for EIP-712 mint permits (server-only; keep secret) |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | optional | WalletConnect Cloud id for mobile-wallet deeplinks; injected wallets work without it |
   | `ALLOW_UNSECURED_SCANS` | dev/test only | Set `1` to let scans through on checkpoints without a TOTP secret |
   | Clerk keys (`NEXT_PUBLIC_CLERK_*`, `CLERK_SECRET_KEY`, webhook secret) | for operator console | Operator auth via Clerk Organizations |

   Never commit secrets. `BADGE_SIGNER_PRIVATE_KEY` must live only on the
   server — anyone with it can authorize arbitrary mints.

4. **Apply migrations**
   ```bash
   npm run db:migrate
   ```

5. **Seed the pilot event** (ETH Cluj 2026 — 5 checkpoints, sponsors,
   rewards)
   ```bash
   npm run db:seed
   ```

6. **Run the app**
   ```bash
   npm run dev -- --port 3000
   ```

## Day-to-day scripts (`webapp/package.json`)

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server (`-- --port <n>` to pick a port) |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint (`eslint-config-next`) |
| `npm test` | Vitest, single run |
| `npm run test:watch` | Vitest in watch mode |
| `npm run db:generate` | Generate a Drizzle migration from schema changes |
| `npm run db:migrate` | Apply migrations (`tsx db/migrate.ts`) |
| `npm run db:seed` | Seed the pilot event (`tsx db/seed.ts`) |
| `npm run db:studio` | Drizzle Studio (inspect the DB) |

**Before reporting a change done**, run from `webapp/`:
```bash
npm run lint
npm run build
```
For UI work, also run a local server and capture screenshots of the
changed routes (see `AGENTS.md` / `PROJECT_CONTEXT.md` for the exact
Playwright commands).

## Working with Next.js (important)

This repo pins a specific, modern Next.js (16.x) whose APIs and
conventions may differ from older versions you've seen. Per
`webapp/AGENTS.md`: **read the bundled docs in
`webapp/node_modules/next/dist/docs/` before writing Next.js code**, and
heed deprecation notices. Don't assume App Router behavior from memory.

Other UI conventions (from `AGENTS.md`):
- Use existing **shadcn/ui** components from `@/components/ui/...` before
  building custom primitives; add new ones via `npx shadcn@latest add`.
- Use the shared console kit in `webapp/components/product/` for operator
  surfaces.
- Use semantic tokens (`bg-card`, `text-muted-foreground`, `bg-primary`).
- Do not let landing-page global CSS leak into product routes.
- Preserve the marketing landing page (`/`) unless explicitly asked to
  change it. No fake numbers, no dead links/buttons.

## Tests

- **Webapp:** Vitest. The data-layer tests run against **PGlite**
  (in-process Postgres), so `npm test` needs **no Docker**. Auth policy,
  SIWE, the player store, mint permits, rate limiting, and middleware
  config all have unit coverage. Add tests with your change — policy
  actions in particular should cover allowed/denied role permutations.
- **Contracts:** Foundry. From `contracts/`, run `forge test`
  (see `contracts/README.md`).

## Git policy

A clean, readable history is required (from `PROJECT_CONTEXT.md` /
`AGENTS.md`):

- Commit each coherent change as a **short, single-purpose** commit.
- Use normal **single-author** commits from your configured git identity.
- **Do not add co-author trailers** (`Co-authored-by:`) or
  "Generated with…" lines.
- **Do not amend, squash, rebase, or reset** history unless explicitly
  asked.
- Keep unrelated changes in separate commits.
- Don't commit generated artifacts (`node_modules`, `.next`) or secrets.
- Keep the working tree clean before handing off.

Example messages:
```text
Add prize-desk on-chain verification
Harden tokenId capture on mint retries
Document agent workflow
```

## Before you open a PR

1. `npm run lint` and `npm run build` pass (from `webapp/`).
2. `npm test` passes; new behavior has tests.
3. Contract changes: `forge build && forge test` pass (from `contracts/`).
4. UI changes: screenshots of affected routes reviewed.
5. Commits follow the git policy above.
6. If you made a non-obvious technical decision, add an ADR under
   `docs/adr/` (see `docs/adr/README.md`).
