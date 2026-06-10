# TreasureLoop Roadmap

This is the working plan to take TreasureLoop from "auth wired + mock
data" to "production event running on Base mainnet." It is opinionated,
phased, and meant to be executed top-to-bottom. Every phase has
concrete deliverables, an acceptance bar, and the risks I'd worry about.

Update this file as we ship. Each task has a `[ ]` checkbox — mark it
`[x]` when it lands. Each phase has a "done when" gate; don't move on
until that gate passes.

## Current status (rolling)

| Phase | State |
|---|---|
| 1. Persistent data | ✅ shipped — Drizzle + Postgres, 11 tables, in-process tests via PGlite |
| 2. Operator CRUD | ✅ shipped — Server Actions for events, routes, checkpoints, sponsors, rewards, staff invitations; Clerk webhook for org→event sync; /app/team for invitations |
| 3. Secure scan flow | ✅ shipped (code) — TOTP per checkpoint, in-process rate limits, HMAC-signed scan URLs, rejected-scan audit rows; **blocked:** swap in-process limiter for Vercel KV/Upstash (needs KV creds) |
| 4. Badge contract | 🟡 partial — Solidity + 15 Foundry tests, do-it-yourself self-audit (clean), on-chain already-minted detection, badge metadata endpoint; **blocked:** deploy to Base Sepolia (funded key) + KMS signer |
| 5. Prize desk on-chain | ✅ shipped — on-chain verify, atomic stock decrement, eligibility-rule engine, duplicate-redemption flag, offline cache, printable receipt |
| 6. Booth-staff kiosk | ✅ shipped — rotating TOTP, secret rotation, recent scans, pause/resume checkpoint, "help me" staff alerts surfaced on overview |
| 7. Pair fragments | ✅ shipped — fragments schema, A/B issuance with balancing, /play/pair combine screen + /api/play/pair, cheating-report flag |
| 8. Sponsor analytics | ✅ shipped (code) — real-DB report with privacy scoping, lead consent opt-in, talk-through metric, hourly rollup, CSV export, revocable share links; **ops:** wire Vercel Cron + CRON_SECRET |
| 9. Observability | ✅ shipped (code) — /api/health, structured JSON logging, metrics counters, env-gated Sentry wrapper, k6 load script; **blocked:** Sentry DSN + log drain + uptime monitor (accounts) |
| 10. Production hardening | 🟡 partial — security headers + CSP (smoke-tested), cookie audit, GDPR export/erasure, privacy notice, npm audit; **pending:** a11y/Lighthouse pass, external pen-test + contract audit, Dependabot/gitleaks (repo settings) |
| 11. Pre-event ops | ✅ shipped — /app/preflight, organizer onboarding wizard, dress-rehearsal mode, operator playbook + booth/prize one-pagers; i18n deferred (single-locale pilot) |
| 12. Day-of operations | ✅ shipped (code) — /app/live dashboard (scans/min, reject rate, queue depths, contract pause read), post-event report generator, incident runbook; hot-swap drills are an ops exercise |

---

## Where we are today

What's in `main` as of this writing:

- **Landing page** (`webapp/app/page.tsx`) — polished, public, links to
  `/login` and `/play`.
- **Operator console** (`webapp/app/app/**`) — Clerk auth with
  Organizations, four roles (`organizer`, `prize_desk`, `booth_staff`,
  `sponsor`), policy module at `webapp/lib/authz.ts`, four mock pages
  (overview, routes, prize-desk, sponsors).
- **Attendee surface** (`webapp/app/play/**`) — wagmi + RainbowKit
  wallet connect, SIWE sign-in, scan/progress/claim screens.
- **APIs** (`webapp/app/api/play/**`) — SIWE nonce/verify/me/logout,
  progress, scan, mint-permit, mint-confirm.
- **Smart contract** (`contracts/src/TreasureLoopBadge.sol`) — written,
  not deployed, not foundry-tested.
- **Tests** — 71 unit tests passing (authz, SIWE, player store, mint
  permits, middleware config).

What's **not** real yet:

- All data is in process memory (`lib/player-store.ts`, `lib/mock-data.ts`).
- Per-checkpoint verification codes accept any non-empty string.
- Badge contract isn't deployed; mint button returns 503.
- Sponsor/player/checkpoint CRUD is read-only mock.
- No booth-staff app, no pair-fragment matchmaking, no on-chain badge
  read at the prize desk.
- No observability, no rate limits, no audits.

---

## Where we're going

A working TreasureLoop event has eight surfaces that all matter:

| Surface | Who | Auth | Status |
|---|---|---|---|
| Landing | Public | None | ✅ done |
| Organizer console | Organizer | Clerk | 🟡 chrome only |
| Sponsor reports | Sponsor | Clerk | 🟡 chrome only |
| Prize desk | Prize-desk staff | Clerk | 🟡 chrome only |
| Booth staff kiosk | Booth staff | Clerk | ⬜ not started |
| Attendee play | Player | SIWE | 🟡 flow works, mock data |
| Public scoreboard | Public | None | ⬜ not started |
| Admin (us) | Platform | Clerk superuser | ⬜ not started |

Plus the backbone:

- **Postgres** holding the canonical state of every event
- **Base** (Sepolia → mainnet) holding finisher badges
- **A monitoring stack** so we can run an event without panic

---

## Phase 1 — Persistent data layer

**Goal:** every read/write the app does today against in-memory or
mock data goes through Postgres instead. After this, restarting the
server doesn't lose a single scan.

**Why first:** every later phase assumes durable state. Building the
booth staff app on a Map that resets every deploy is wasted work.

### Tech choices

- **Database:** Neon Postgres via Vercel Marketplace. Native branching
  for preview deploys. Free tier covers dev + small events.
- **ORM:** Drizzle. SQL-shaped, type-safe, smaller than Prisma, no
  schema-generation step. The schema is a TS file we can grep.
- **Migrations:** `drizzle-kit migrate` checked into git.
- **Local dev:** Docker Compose with Postgres 16 for offline work.

### Tasks

- [x] Install `drizzle-orm`, `drizzle-kit`, `postgres`, `@neondatabase/serverless`.
- [x] Add `webapp/drizzle.config.ts` pointing at `DATABASE_URL`.
- [x] Create `webapp/db/schema.ts` with the tables in the schema
  section below.
- [x] Generate the initial migration: `npx drizzle-kit generate`. Commit
  the SQL file under `webapp/db/migrations/`.
- [x] Add `webapp/db/client.ts` exporting a singleton `db` against
  Neon HTTP for serverless + a pg client for local.
- [x] Add `webapp/db/seed.ts` that creates one event, five checkpoints,
  four sponsors, three rewards — the same shape as `lib/mock-data.ts`.
- [x] Add `npm run db:generate`, `db:migrate`, `db:seed`, `db:studio` scripts.
- [x] Add Docker Compose at repo root for `postgres:16`.
- [x] Replace `lib/player-store.ts` with a Drizzle-backed
  implementation that satisfies the same interface. The 20
  player-store tests run against PGlite (in-process Postgres) — no
  Docker required for tests.
- [x] Replace `lib/mock-data.ts` reads in the four operator pages with
  queries scoped to the active event (Clerk org id ↔ events.org_id).
- [ ] Add Vercel Marketplace integration for Neon in the Vercel
  project; set `DATABASE_URL` per environment.

### Schema (initial)

```ts
events           id, name, slug, venue, dates_start, dates_end, network, status, org_id (Clerk)
routes           id, event_id, name, published
checkpoints      id, route_id, order_index, name, area, sponsor_id, clue, status, totp_secret
sponsors         id, event_id, name, tier
staff_assignments id, checkpoint_id, user_id (Clerk), is_primary
rewards          id, event_id, name, stock_total, stock_claimed, kind
players          id, event_id, wallet (address, unique per event)
scans            id, player_id, checkpoint_id, code_used, created_at
completions      id, player_id, completed_at
badge_mints      id, player_id, tx_hash, token_id, minted_at
redemption_claims id, player_id, reward_id, staff_id, claimed_at, notes
audit_log        id, actor (user_id or wallet), action, target, created_at, meta
```

Indexes: `scans(player_id, checkpoint_id) unique`, `players(event_id, wallet) unique`, `badge_mints(player_id) unique`.

### Acceptance criteria

- `npm run db:seed` populates a fresh database with the ETH Cluj pilot.
- The four operator pages render real DB data, not `lib/mock-data.ts`.
- The 18 player-store tests pass against a real Postgres (or pg-mem).
- The SIWE → scan → mint flow still works end-to-end after a server
  restart (data survives).

### Risks

- Neon free tier has connection limits — use the HTTP client for
  serverless Functions, not pooled `pg`.
- Drizzle's `pgTable` syntax is verbose; resist over-abstracting until
  we feel the pain.

### Effort: ~3 days

---

## Phase 2 — Operator CRUD

**Goal:** an organizer can stand up an event from scratch in the
console without touching the database.

### Tasks

- [x] **Event create flow**: Clerk webhook at `/api/webhooks/clerk` on
  `organization.created` calls `ensureEventForOrg`. The `/app` layout
  defensively re-runs the same helper so a missed webhook still
  produces a row.
- [x] **Routes**: `createRoute`, `renameRoute`, `setRoutePublished`,
  `archiveRoute` in `lib/event-actions.ts`.
- [x] **Checkpoints**: `createCheckpoint`, `updateCheckpoint`,
  `archiveCheckpoint`, `reorderCheckpoints`, `rotateCheckpointSecret`.
- [x] **Sponsors**: `createSponsor`, `updateSponsor`, `archiveSponsor`.
  Clerk-invitation-on-add deferred — sponsors are an account today.
- [x] **Staff invitations**: `inviteStaff` wraps Clerk's
  `createOrganizationInvitation`. `/app/team` lists current
  members + pending invites and exposes the invite form.
- [x] **Rewards**: `createReward`, `updateReward`. Atomic decrement
  lives in the prize-desk `redeemReward` Server Action.
- [x] **Audit log**: every mutation writes a row inside the same
  transaction.
- [ ] **Settings UI**: backed by `updateEventSettings`; UI form
  still pending.
- [ ] **Optimistic UI** via TanStack Query mutations + cache
  invalidation. We already use TanStack on the play side.

### Acceptance criteria

- A fresh organizer can: sign up → create event → create route → add
  five checkpoints → assign sponsors and staff → publish — entirely in
  the UI.
- Every mutation is one Server Action, calls `requireRoles`, runs in a
  transaction, and writes an audit_log row.
- `npm test` covers the policy permutations for every action (organizer
  allowed, others denied).

### Risks

- Clerk webhook delivery is at-least-once; the event-create handler
  must be idempotent (`ON CONFLICT (org_id) DO NOTHING`).
- Cascading deletes — deleting a route should not orphan scans.
  Choose explicitly: soft-delete with `archived_at`, default to that.

### Effort: ~5 days

---

## Phase 3 — Secure scan flow

**Goal:** scans are unforgeable. A wallet can't claim a checkpoint
without physically being at the booth at that time.

### Threat model

- Attacker sees a code over someone's shoulder → replay.
- Attacker scrapes the API URL + dumps every checkpoint id.
- Attacker brute-forces short codes.
- Booth staff colludes with one player.
- A single scan is replayed across many wallets (sybil farming).

### Mitigations

- **TOTP per checkpoint**: each checkpoint has a `totp_secret` stored
  encrypted. Booth staff sees the current 30-second code on their
  staff kiosk (Phase 6). Players type it; server verifies with a small
  drift window.
- **NFC tag URL is the slow path**: scanning the tag opens
  `/play/scan?cp=CP-03&t=<short-lived-hmac>`. The HMAC is bound to the
  tag's id + the current time bucket; the server checks it before even
  asking for a TOTP. Sniffing the URL gives an attacker ~60 seconds.
- **Per-wallet rate limit**: max 1 scan attempt per checkpoint per 5
  seconds; max 30 scans/hour event-wide. Vercel KV counter, fail open
  if KV is down.
- **Per-IP rate limit**: standard 100 req/min on `/api/play/scan` via
  Upstash Ratelimit.
- **Scan is single-use per wallet+checkpoint**: already enforced.
- **Audit every reject reason** so we can spot a brute-force live.

### Tasks

- [x] Pick a TOTP lib (`otpauth`). Generate secrets at checkpoint
  create time.
- [x] Booth-staff kiosk shows the rotating code (Phase 6).
- [x] Update `/api/play/scan` to verify TOTP code against the stored
  secret with `window: 1`.
- [x] Rate-limit `/api/play/scan` and `/api/play/auth/verify` with an
  in-process sliding-window limiter. Tests + curl verified.
- [ ] HMAC URL signature for `/play/scan?cp=...&t=...`. Encode as
  `keccak256(cp_id || time_bucket || NFC_SECRET)`. Time bucket = 60s.
- [ ] Swap the in-process limiter for `@upstash/ratelimit` + Vercel KV
  so the rate budget is shared across serverless instances.
- [ ] Add `audit_log` rows for each rejected scan (`reason='bad-totp'`,
  etc).

### Acceptance criteria

- A captured request body replayed 5 minutes later fails.
- A captured NFC URL replayed 5 minutes later fails.
- Rate limits kick in at the documented thresholds (integration test).
- Booth staff can rotate a checkpoint's secret without invalidating
  previous scans.

### Risks

- Clock drift between server and staff phone. Mitigate by checking
  ±1 TOTP window.
- KV outage. Fail open with a logged warning — better to let a real
  player through than block the floor.

### Effort: ~3 days

---

## Phase 4 — Badge contract on-chain

**Goal:** finisher badges minted to real wallets on Base Sepolia (then
mainnet). The contract is audited-by-eye, foundry-tested, and the
signer key is in a KMS.

### Tasks

- [x] **Foundry setup** under `contracts/`:
  - `forge install OpenZeppelin/openzeppelin-contracts@v5.1.0`
  - `foundry.toml` with `optimizer = true`, `optimizer-runs = 200`
- [x] **Tests** (`contracts/test/TreasureLoopBadge.t.sol`):
  - happy path mint with valid permit
  - reject when caller != permit.player
  - reject when chainId mismatches
  - reject after deadline
  - reject double-mint
  - reject nonce replay
  - reject signature from non-signer
  - signer rotation works
  - paused mint reverts
  - `tokenURI` returns `baseURI + tokenId`
- [x] **Deploy script** (`contracts/script/Deploy.s.sol`) using
  Foundry's `Script`.
- [ ] **Deploy to Base Sepolia**. Verify on Basescan. Requires
  funded deployer key — out of scope for this PR.
- [ ] **KMS for signer key**: store the signer private key in AWS KMS
  or Vercel's Secret Manager equivalent. Update `lib/mint-permits.ts`
  to fetch on cold start.
- [ ] **Badge metadata endpoint** (`/api/badge-metadata/[tokenId]`)
  serving OpenSea-compatible JSON with the player's address, mint
  timestamp, route name. Image is a generated SVG including the event
  name.
- [ ] **Wagmi `useReadContract`** on the claim page to detect already-
  minted state on chain (resilient to server DB getting wiped).

### Audit checklist (do-it-yourself before any external audit)

- [ ] No `external` function missing access control
- [ ] No re-entrancy guard needed (no external calls during state changes)
- [ ] `safeMint` to the player — handles ERC-721 receiver contracts
- [ ] No `delegatecall` anywhere
- [ ] All `unchecked` blocks justified
- [ ] `block.chainid` (not a constant) used in domain separator —
  contract survives a chain fork

### When to mainnet

After:
- 14 days running on Sepolia without an unexpected revert
- A second pair of eyes on the contract (informal, not paid)
- Discord/x announcement to draw friendly stress-testers

### Effort: ~4 days

---

## Phase 5 — Prize desk that actually checks chain

**Goal:** the prize-desk staff at the event hands out rewards only to
wallets that *actually own* a finisher badge on chain. The UI tells
them in <500ms.

### Tasks

- [x] **Verification flow**: `lookupWallet` Server Action calls
  `balanceOf(player)` via the viem public client. UI shows Eligible /
  Not eligible / Wallet hasn't played / Contract not configured.
- [ ] **Reward tier engine**: rules live in DB
  (`rewards.eligibility_rule jsonb`). MVP: "any minted player gets
  X." Stretch: "first 100 mints get Y," "scanned > 5 booths gets Z."
- [x] **Atomic stock decrement**: `redeemReward` runs the
  `UPDATE … WHERE stock_total IS NULL OR stock_claimed < stock_total
  RETURNING *` pattern. Tested under 10 concurrent claims.
- [x] **Anti-double-claim**: unique index on
  `(player_id, reward_id)`. Tested.
- [ ] **Flags**: surface "same wallet redeemed merch yesterday" and
  staff has to ack before continuing.
- [ ] **Offline mode**: prize desk has flaky wifi sometimes. Cache the
  last N badge-eligibility results in localStorage so a momentary RPC
  outage doesn't block a queue.
- [ ] **Receipt**: on successful redemption, generate a printable
  ticket (HTML print stylesheet, no thermal printer integration yet).

### Acceptance criteria

- Verification of an on-chain badge holder: <500ms p95.
- Verification of a fake address: clear "not eligible" with reason.
- Stock counter decrements exactly once per redemption under
  concurrent staff load (1000-rps simulated test).
- Staff sees a flag when the rule fires.

### Effort: ~3 days

---

## Phase 6 — Booth staff app

**Goal:** sponsor booth staff have a focused screen they keep open on a
tablet at their booth. It shows the rotating code, recent scans, and
a "ask for help" button.

### UX shape (one screen, mobile-first)

```
┌──────────────────────────────┐
│ Hardware Vault · Ledger      │
├──────────────────────────────┤
│      4 8 2 · 9 1 7            │   ← TOTP, rotates 30s
│   ──────────────────          │   ← countdown bar
│                              │
│  Recent (last 5)             │
│  • 0x74…92b1  11:42          │
│  • 0x31…ab70  11:39          │
│  ...                          │
│                              │
│  [ Help me ]   [ Pause ]     │
└──────────────────────────────┘
```

### Tasks

- [x] Route `/app/booth` (assigned-checkpoint listing) and
  `/app/booth/[checkpointId]` (kiosk screen) — gated by
  `canIssueScan(subject)` and the user's staff assignment.
- [x] TOTP computed client-side from the shared secret, 250 ms tick
  for the countdown bar.
- [x] "Rotate secret" button calls `rotateCheckpointSecret`. Previous
  codes go invalid immediately.
- [ ] Recent scans pulled from `scans` table, refreshed via SSE or
  Postgres listen/notify.
- [ ] "Help me" creates a row in `staff_alerts` that organizer
  overview sees in the "Needs attention" card.
- [ ] "Pause checkpoint" toggles `checkpoints.status = 'offline'` so
  attendees can't scan it.

### Acceptance criteria

- Staff can run an event on a tablet in airplane mode (offline) for
  short pulses — UI degrades but doesn't crash. Stretch goal.

### Effort: ~2 days

---

## Phase 7 — Pair-fragment flow

**Goal:** TreasureLoop's signature mechanic — two players must combine
fragments at a checkpoint — works end to end.

### Spec

- A checkpoint flagged `clue_type = 'pair'` issues *two* fragments per
  scan: fragment A or fragment B, alternating between players.
- The player who got A has to find someone with B (or vice versa) and
  show their phones together. Either player taps "combine" + types
  the other's 4-char code displayed on screen. Server checks they
  hold complementary fragments.
- Server records the pair in `pair_completions` and grants the
  checkpoint to both wallets.

### Tasks

- [ ] Schema: `fragments(id, player_id, checkpoint_id, fragment_kind 'A'|'B', short_code, created_at, paired_with_player_id NULL, paired_at)`.
- [ ] `/api/play/scan` for pair checkpoints issues a fragment with a
  4-char `short_code`.
- [ ] New `/play/pair` screen showing "Your fragment is **A: 4QPM**.
  Find someone with **B** and pair." Has a text input for the other
  code.
- [ ] `/api/play/pair` validates the two fragments are complementary
  and complete both records.
- [ ] Organizer can balance the queue: if A's outnumber B's by ≥3,
  start handing only B for the next 5 minutes.

### Risks

- Two players show up at the same code by chance — collisions on
  4 chars. Use 5 chars or pull from a curated 32-symbol alphabet.
- Cheating: same person walks around with two phones. Add an
  "I think this person is cheating" report flow that flags the pair
  for human review at the prize desk.

### Effort: ~3 days

---

## Phase 8 — Sponsor analytics with real data

**Goal:** the existing `/app/sponsors` page reads from `scans` instead
of `lib/mock-data.ts`. Sponsors with `org:sponsor` role see their own
booth's report; organizers see all.

### Tasks

- [ ] Materialized hourly buckets: scheduled job (Vercel Cron or
  Postgres `pg_cron`) rolls up `scans` into `sponsor_traffic_hourly`
  every 5 minutes. Avoids hot-loop aggregation on the read path.
- [ ] Real "talk-through" metric: define as "wallet scanned this
  checkpoint AND scanned the next-in-sequence checkpoint within 10
  minutes." Pre-compute nightly.
- [ ] Qualified leads: opt-in step at scan time. Player has a toggle
  "Share my wallet with this sponsor." Stored in `lead_consents`.
- [ ] Export CSV: server-side stream, signed-URL download.
- [ ] Shareable read-only link: `/share/[token]/sponsor/[id]` — token
  in `share_links` table, can be revoked. No auth required.

### Privacy

- A sponsor only ever sees players who opted in via the toggle. The
  raw scan log is organizer-only. This needs to be in the privacy
  notice on the landing page and the play onboarding.

### Effort: ~3 days

---

## Phase 9 — Observability & reliability

**Goal:** when something breaks at 15:00 on event day, we know about
it before the organizer screams.

### Stack

- **Error tracking:** Sentry (free tier covers us).
- **Logs:** Vercel logs + structured JSON via `pino`. Drain to Better
  Stack or Axiom for searchable history.
- **Metrics:** Vercel Analytics + custom counters via a tiny `lib/
  metrics.ts` that fires to `analytics` (or use Posthog).
- **Tracing:** OpenTelemetry SDK in the API routes, vendor TBD.
- **Uptime:** UptimeRobot on `/api/health` every 60s.
- **Status page:** `status.treasure.loop` (Statuspage / instatus).

### Tasks

- [ ] Add Sentry to webapp; wrap the app router with Sentry's wrappers.
- [x] `/api/health` returns OK + DB ping + contract/signer/session
  config status. Returns 503 if the DB is unreachable.
- [ ] Structured logging on every API route — request id, wallet
  address, latency, outcome.
- [x] Audit log as the operator-facing activity feed
  (`listLiveActivity`).
- [ ] Custom metric: scans/min, mint/min, redemption/min, error rate.
- [ ] Slack webhook on Sentry P1 + on `staff_alerts` insert.
- [ ] Pre-event load test: 100 concurrent scans (k6 script committed).

### Effort: ~2 days

---

## Phase 10 — Production hardening

**Goal:** the things you don't notice when they work and that wreck
the event when they don't.

### Security

- [ ] CSRF — Server Actions + iron-session already give us this for
  the play API. Audit every route to confirm.
- [ ] CSP header — restrict scripts to self + Clerk + WalletConnect.
- [ ] Cookie flags audit — `Secure`, `HttpOnly`, `SameSite=Lax`
  everywhere they apply.
- [ ] Dependency scan — `npm audit` clean, Dependabot on.
- [ ] Secret scanner — gitleaks pre-commit, GH secret scanning.
- [ ] Penetration test by a friend who's not us. Document scope and
  findings.

### Performance

- [ ] Lighthouse score ≥ 95 on `/`, `/play`, `/login`.
- [ ] Bundle budget: initial JS < 200kb gzipped on each route.
- [ ] Use Next 16 Cache Components on public pages (landing).
- [ ] Edge functions for `/api/play/auth/me` (read-only, fast).

### Accessibility

- [ ] WCAG 2.1 AA pass — keyboard navigation, focus rings, contrast
  ≥ 4.5:1, ARIA labels.
- [ ] Run axe-core CI on `/`, `/play`, `/login`, `/app`.
- [ ] Test with VoiceOver on macOS + Safari iOS.

### Legal / privacy (event-organizer side)

- [ ] Privacy notice at landing + play onboarding.
- [ ] GDPR data export endpoint (the player can request all their
  scans + redemptions as JSON).
- [ ] Right-to-erasure flow (clear scans + sessions; the on-chain
  badge stays, because it's not ours to delete).
- [ ] Terms of use for organizers — make explicit who owns the data.

### Smart contract audit

- [ ] At least one external audit (Code4rena Lite, Spearbit shorter
  engagement, or one of Trail of Bits' fixed-scope reviews). Budget
  $5–25k depending on depth.

### Effort: ~5 days for security + perf + a11y. Audit cost separate.

---

## Phase 11 — Pre-event ops

**Goal:** the organizer can run a real event with our tooling without
us in the loop.

### Tasks

- [x] **Pre-flight check page** (`/app/preflight`): runs a battery of
  asserts on the configured event — routes published, secrets present,
  staff assignments, sponsors, rewards, contract+signer configuration.
- [ ] **Organizer onboarding flow**: a 5-step wizard on first event
  create — name + dates → upload venue map → create routes → invite
  staff → connect Clerk webhook for invitations.
- [ ] **Operator playbook (`docs/OPERATOR_PLAYBOOK.md`)**: literal
  step-by-step for an event organizer. Day-of checklist. Common
  failure modes (NFC tag failed, sponsor staff didn't show, mint
  contract paused).
- [ ] **Booth-staff one-pager**: PDF-ready, what to do when an
  attendee can't scan.
- [ ] **Prize-desk one-pager**: what every status icon means, what to
  do when a player insists they earned a tier they didn't.
- [ ] **Dress-rehearsal mode**: a flag on the event that disables real
  badge mint and uses a "rehearsal" contract.
- [ ] **Internationalization** if multi-country: pull strings via
  `next-intl` for RO + EN. Probably skip for ETH Cluj pilot.

### Acceptance criteria

- A new organizer, given only the docs, can run a 10-person friends-
  and-family rehearsal end-to-end. We document anything they get
  stuck on and fix it.

### Effort: ~4 days (docs are slow)

---

## Phase 12 — Day-of operations

**Goal:** on event day, the team can see everything that matters and
respond fast.

### Tasks

- [ ] **Live ops dashboard** (`/app/live`): scans/min trendline, error
  rate, contract pause toggle, queue depths, staff alerts. Refresh
  every 5 seconds.
- [ ] **Incident response runbook (`docs/INCIDENT_RUNBOOK.md`)**: who
  pages who, escalation tree, status-page templates.
- [ ] **Hot-swap drills**: practice rotating the signer key, pausing
  the contract, dropping the prize desk's KV bucket.
- [ ] **Post-event report generator**: at event end, the system emits
  a markdown report (total players, completions, sponsor visits,
  redemptions, anomalies) the organizer can publish.

### Effort: ~2 days

---

## Cross-cutting threads (run in parallel, not sequential)

These should be tended every sprint, not saved for last.

### Testing

We're at 71 unit tests today. By Phase 5 we should add:
- **Integration tests** with a real Postgres in CI (testcontainers).
- **E2E tests** with Playwright against a seeded local stack — sign
  up, configure event, play through, prize-desk redeem.
- **Foundry tests** for the contract — fork test against Base Sepolia
  to catch RPC weirdness.

### Codegen + types

- [ ] `ts-proto` or similar if any RPC is added.
- [ ] Drizzle gives us inferred row types — surface them across the
  codebase, no manual interfaces.

### Documentation

- [ ] Per-package READMEs (we have webapp + contracts).
- [ ] ADRs (`docs/adr/`) for non-obvious decisions: Drizzle over
  Prisma, iron-session over JWT, Clerk over Auth.js, RainbowKit over
  Privy, etc.
- [ ] CONTRIBUTING.md.

---

## Open questions

These need a human decision before the relevant phase starts.

1. **Mainnet or stay on Base Sepolia for the pilot?** Sepolia is
   ideal for the first event (free, no real money on the line, no
   audit blocker). Production events need mainnet.
2. **Custodial signer or KMS?** If the signer key gets stolen, the
   attacker can mint arbitrary badges. KMS is the right answer.
3. **Per-event contract or single multi-event contract?** Per-event
   keeps the data tight; multi-event is cheaper to deploy. Lean
   per-event for collectibility.
4. **Do we charge organizers?** Pricing decision shapes onboarding UX.
5. **Hosted matchmaking for pair fragments, or just a code-swap UX?**
   Real-time matching is fancier; code-swap is bulletproof.
6. **Booth staff identity: their own Clerk user, or shared
   per-checkpoint kiosk login?** Shared login is faster to set up but
   loses per-staff accountability.

---

## Estimated timeline

Realistic, assuming a single engineer working full-time, with one
non-Phase-blocked task in parallel.

| Phase | Effort | Cumulative |
|---|---:|---:|
| 1. Persistent data | 3 d | 3 d |
| 2. Operator CRUD | 5 d | 8 d |
| 3. Secure scan | 3 d | 11 d |
| 4. Badge contract | 4 d | 15 d |
| 5. Prize desk | 3 d | 18 d |
| 6. Booth staff app | 2 d | 20 d |
| 7. Pair fragments | 3 d | 23 d |
| 8. Sponsor analytics | 3 d | 26 d |
| 9. Observability | 2 d | 28 d |
| 10. Hardening | 5 d | 33 d |
| 11. Pre-event ops | 4 d | 37 d |
| 12. Day-of ops | 2 d | 39 d |

**~8 working weeks** to a production-ready first event, assuming no
audit blockers. Add 2–4 weeks for an external contract audit if the
event involves valuable rewards.

---

## What I'd cut if the deadline is 4 weeks instead of 8

- Phase 7 (pair fragments) — keep it as a stretch goal; the basic
  loop works without it.
- Phase 6 (booth-staff app) — staff can use the organizer console with
  a `prize_desk` or `booth_staff` role; the dedicated kiosk is nicer
  but not blocking.
- Phase 8 (sponsor analytics) — sponsors can see traffic counts in
  the existing report; deep analytics ships post-event.
- Phase 11 (organizer onboarding wizard) — at first we onboard the
  one pilot organizer in person.

This gets us to Phase 1 → 4 + lite version of 5 + 9 + 10, ~4–5 weeks.

---

## Glossary

- **Attendee / player** — person at the event playing the hunt
- **Organizer** — runs the event, configures everything
- **Booth staff** — operates one checkpoint
- **Prize desk staff** — verifies badges, hands out rewards
- **Sponsor** — pays to host a checkpoint, sees their own report
- **Loop / route** — the ordered set of checkpoints a player traverses
- **Checkpoint / stop** — one staffed location on the route
- **Fragment / pair fragment** — half of a clue, given to one player at
  a "pair" checkpoint; combining two fragments solves the checkpoint
- **Badge** — ERC-721 token minted at completion, gates the prize desk
- **Permit** — server-issued EIP-712 signed message authorizing one
  badge mint
- **Redemption** — handing a physical reward to a verified badge holder
