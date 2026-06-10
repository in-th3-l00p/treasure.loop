# Deployment / release checklist

A literal, ordered runbook for taking TreasureLoop from an empty Vercel
project to a live event. Follow it top to bottom. Each step is something
an operator does once per environment (Preview / Production).

Companion docs:

- Env reference: [`webapp/.env.local.example`](../webapp/.env.local.example)
  — every variable, grouped, with required/optional notes.
- Contract deploy: [`contracts/README.md`](../contracts/README.md) and
  [`contracts/script/Deploy.s.sol`](../contracts/script/Deploy.s.sol).
- Decisions behind these steps: [`docs/adr/`](./adr/).
- Day-of operations: [`docs/OPERATOR_PLAYBOOK.md`](./OPERATOR_PLAYBOOK.md)
  and [`docs/INCIDENT_RUNBOOK.md`](./INCIDENT_RUNBOOK.md).

> Convention: all `npm run …` commands run from `webapp/`. All
> `forge …` commands run from `contracts/`.

---

## 0. Prerequisites

- A Vercel project linked to this repo, **Root Directory set to `webapp/`**.
- A Clerk application (see step 4).
- Foundry installed (https://book.getfoundry.sh) for the contract deploy.
- A funded deployer key on Base Sepolia (testnet ETH from a faucet).

---

## 1. Provision the database (Neon Postgres)

1. In the Vercel project → **Storage / Marketplace → Neon Postgres**,
   create a database and connect it to the project. Vercel injects
   `DATABASE_URL` into the linked environments automatically.
2. If you are not using the Marketplace integration, set `DATABASE_URL`
   manually per environment (the Neon HTTPS-pooled connection string).
3. Confirm it is set for **Production** (and Preview, if you run rollups
   there).

## 2. Run migrations and seed

From `webapp/`, with `DATABASE_URL` pointing at the target database:

```bash
npm run db:migrate    # apply SQL migrations in db/migrations/
npm run db:seed       # populate the ETH Cluj pilot event + routes
```

`db:seed` reads `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` if set, so you can
re-run it after step 3 to backfill the contract address — it is
idempotent.

## 3. Deploy the badge contract (Base Sepolia)

One ERC-721 contract per event (see ADR 0009), on Base Sepolia for the
pilot (ADR 0007). From `contracts/`:

1. Install deps and verify the build/tests pass:

   ```bash
   forge install OpenZeppelin/openzeppelin-contracts@v5.1.0   # first time
   forge build
   forge test
   ```

2. Set the deploy env (the deployer key must be funded with Base Sepolia
   ETH):

   ```bash
   export BASE_SEPOLIA_RPC=https://sepolia.base.org   # or your RPC
   export PRIVATE_KEY=0x<funded-deployer-key>
   export BADGE_OWNER=0x<multisig-or-EOA controlling pause + signer rotation>
   export BADGE_SIGNER=0x<address derived from BADGE_SIGNER_PRIVATE_KEY>
   export BADGE_BASE_URI=https://<your-domain>/api/badge-metadata/
   ```

   `BADGE_SIGNER` **must** equal the address of the webapp's
   `BADGE_SIGNER_PRIVATE_KEY` — the contract recovers exactly this
   address from every mint permit signature.

3. Deploy and verify on Basescan:

   ```bash
   forge script script/Deploy.s.sol \
     --rpc-url "$BASE_SEPOLIA_RPC" \
     --private-key "$PRIVATE_KEY" \
     --broadcast --verify
   ```

   The script logs `TreasureLoopBadge deployed at: 0x…`.

4. Set the contract address in the webapp env (and re-run `db:seed` to
   backfill it):

   ```
   NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS=0x<deployed address>
   ```

## 4. Configure the mint signer key (via KMS)

The signer key is the highest-value secret in the system: anyone holding
it can authorize arbitrary badge mints (ADR 0008).

1. Generate / hold the signer key in a KMS or secret manager (e.g. AWS
   KMS, GCP KMS, or at minimum a Vercel sealed secret) — not a plaintext
   `.env` checked anywhere.
2. Inject it into the webapp runtime as `BADGE_SIGNER_PRIVATE_KEY` (a
   0x-prefixed 32-byte hex string). On Vercel, set it as an encrypted
   Production environment variable sourced from the secret manager.
3. The signer address (derived from this key) must match `BADGE_SIGNER`
   used at deploy time. If the key is ever rotated, call `setSigner()` on
   the contract (owner-only) with the new address.

## 5. Configure Clerk (operator auth)

1. In the Clerk dashboard, set the production publishable + secret keys:

   ```
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_…
   CLERK_SECRET_KEY=sk_live_…
   ```

2. Add the webhook endpoint: **Webhooks → Add endpoint →
   `https://<your-domain>/api/webhooks/clerk`**, subscribed to
   `organization.created`, `organization.updated`, `organization.deleted`.
   Copy the signing secret into `CLERK_WEBHOOK_SIGNING_SECRET`.
3. (Booth staff are individual Clerk users, not a shared kiosk login —
   see ADR 0011 — so invite each staffer into the event's Clerk org.)

## 6. Set the remaining required env vars

Set every variable from [`webapp/.env.local.example`](../webapp/.env.local.example)
in the Vercel **Production** environment. The ones with no safe default
that MUST be real values:

- `PLAY_SESSION_SECRET` — `openssl rand -base64 48` (>= 32 chars).
  Production refuses to serve attendee sessions without it.
- `SCAN_URL_SECRET` — `openssl rand -hex 32`. Production throws without
  it (signed scan URLs would be forgeable).
- `CRON_SECRET` — `openssl rand -hex 32` (see step 7).
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — a real id from
  https://cloud.walletconnect.com (required for mobile wallet deeplinks).
- `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` and `BADGE_SIGNER_PRIVATE_KEY`
  (steps 3–4).

Do **not** set `ALLOW_UNSECURED_SCANS` in production.

## 7. Enable the rollup cron

1. [`webapp/vercel.json`](../webapp/vercel.json) already declares the
   cron — `/api/cron/rollup-sponsor-traffic` on `*/5 * * * *` (every 5
   minutes). It ships with the deploy; no dashboard action needed beyond
   deploying.
2. Set `CRON_SECRET` in Production (step 6). Vercel Cron automatically
   sends it as `Authorization: Bearer <CRON_SECRET>`, and the route
   rejects anything else.

## 8. Set up error tracking (recommended)

1. Create a Sentry project and set `SENTRY_DSN` (server) and/or
   `NEXT_PUBLIC_SENTRY_DSN` (client). Optional — the app logs errors
   structurally and stays fully functional without it.
2. Optionally set `LOG_LEVEL` (`debug|info|warn|error`; defaults to
   `info` in production).

## 9. Deploy and verify health

1. Deploy to Production (push to the default branch, or `vercel --prod`).
2. Hit `GET https://<your-domain>/api/health` — expect HTTP `200` with
   `"ok": true` and every check (`database`, `badge_contract`,
   `badge_signer`, `play_session_secret`) reporting `ok: true`.

## 10. Run preflight and a dress rehearsal

1. Sign in as an organizer and open **`/app/preflight`** — drive every
   check to green (DB, contract config, signer, session secret, etc.).
2. Toggle **dress-rehearsal mode** on the event (organizer dashboard,
   "Rehearsal" toggle). In rehearsal, finisher badges are **not** minted
   on-chain, so you can walk the full loop without burning testnet
   state. Do a complete dry run, then turn rehearsal off before the
   event goes live.

---

## Pre-launch smoke test

Run this end-to-end checklist against Production (in dress-rehearsal mode
first, then a final live spot-check):

1. **Operator sign-in** — sign in via Clerk, land on `/app`, confirm the
   correct event / org loads.
2. **Configure event** — confirm the seeded ETH Cluj route, checkpoints,
   and sponsors are present and editable.
3. **Play a scan** — open a checkpoint's signed scan URL (or enter the
   per-checkpoint code), connect a wallet, complete SIWE, and record a
   scan; confirm progress advances.
4. **Pair fragment** — at a `pair` checkpoint, get a fragment, swap codes
   with a second player on `/play/pair`, and confirm the pair completes
   (code-swap UX — see ADR 0010).
5. **Mint on testnet** — finish the loop and mint the finisher badge to
   your own wallet on Base Sepolia; confirm the tx lands and the badge is
   non-transferable (soulbound — ADR 0006).
6. **Prize-desk redeem** — as a `prize_desk` user, verify the player's
   badge on-chain and record a redemption; confirm it cannot be redeemed
   twice.
7. **Cron / sponsor report** — after ~5 minutes, confirm the sponsor
   traffic report shows pre-aggregated buckets (the rollup ran).
8. **Health** — re-check `/api/health` is `200` / all-green after the run.
