# TreasureLoop — Proof-of-Concept quickstart

Run the whole product locally with **no funded keys, no deployed
contract, no paid services**. The blockchain is mocked; everything else
(Postgres, Clerk auth, SIWE wallet, the full game loop) is real.

What's mocked vs real:

| Piece | PoC mode |
|---|---|
| Postgres | **Real** — local Docker (`compose.yaml`) |
| Operator auth | **Real** — free Clerk dev keys |
| Attendee wallet | **Real** — SIWE with any browser wallet |
| Badge mint | **Mocked** — synthetic badge recorded in the DB, no on-chain tx |
| Prize-desk badge check | **Mocked** — reads the DB instead of an RPC |
| Per-checkpoint TOTP | **Bypassed** — `ALLOW_UNSECURED_SCANS=1` accepts any code |
| Rate limits / Sentry / cron | In-process / inert — no setup needed |

The mock is gated by `NEXT_PUBLIC_MOCK_CHAIN=1` and **hard-refuses in
production** (`lib/badge-contract.ts`), so it can never weaken a live event.

---

## 1. Start Postgres

From the repo root:

```bash
docker compose up -d postgres
```

This runs Postgres 16 on `localhost:5433` (see `compose.yaml`).

## 2. Configure env

```bash
cd webapp
cp .env.local.example .env.local
```

Edit `.env.local` and set at minimum:

```bash
DATABASE_URL=postgres://postgres:postgres@localhost:5433/treasureloop

# Free Clerk dev keys — https://dashboard.clerk.com (create an app,
# enable Organizations under "Organization settings").
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Any long random strings for local dev:
PLAY_SESSION_SECRET=local-dev-session-secret-at-least-32-characters
SCAN_URL_SECRET=local-dev-scan-secret

# PoC switches:
NEXT_PUBLIC_MOCK_CHAIN=1
ALLOW_UNSECURED_SCANS=1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=demo
```

You can leave `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` and
`BADGE_SIGNER_PRIVATE_KEY` at their zero-value defaults — mock mode
doesn't use them.

## 3. Install, migrate, seed

```bash
npm install
npm run db:migrate
npm run db:seed
```

`db:seed` loads the ETH Cluj pilot (5 checkpoints, sponsors, rewards).

## 4. Run

```bash
npm run dev
```

---

## Demo the attendee loop (no Clerk needed)

1. Open <http://localhost:3000/play>.
2. Connect a browser wallet and sign in (SIWE).
3. **Scan** each checkpoint — in PoC mode any code is accepted
   (`ALLOW_UNSECURED_SCANS=1`). A `pair` checkpoint hands you a fragment;
   open `/play/pair` in a second wallet/browser to combine.
4. After the last checkpoint, go to **Claim** → **Mint finisher badge**.
   No wallet popup — the badge is recorded server-side instantly.
5. Reload `/play/claim` — it still shows "Badge minted" (persisted in DB).

## Demo the operator console

The console scopes events by Clerk organization, so attach the seed to
your org:

1. Sign up at <http://localhost:3000/login>, create an **organization**.
2. Find your org id (`org_...`) — Clerk dashboard → Organizations, or the
   `/no-organization` / `/app` flow.
3. Re-seed against it:
   ```bash
   SEED_ORG_ID=org_xxx npm run db:seed
   ```
4. Open <http://localhost:3000/app> — overview, routes, sponsors, prize
   desk, booth kiosk, live ops, preflight, onboarding wizard.
5. **Prize desk**: paste the wallet that minted above → it verifies the
   (mock) badge from the DB and lets you redeem a reward.

> Without `SEED_ORG_ID`, the console auto-provisions a fresh **empty**
> event for your org — fine if you'd rather build one from scratch with
> the onboarding wizard, but you'll then have two events; re-seed with
> `SEED_ORG_ID` for a single rich one.

## Going from PoC to real

Drop `NEXT_PUBLIC_MOCK_CHAIN` / `ALLOW_UNSECURED_SCANS`, deploy the badge
contract, and set the real env — see `docs/DEPLOYMENT.md`.
