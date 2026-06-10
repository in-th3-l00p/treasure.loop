# TreasureLoop Incident Runbook

Operational runbook for the team running a live TreasureLoop event. This
is the document you open when something is wrong on the floor and people
are waiting. Keep responses short, bias toward keeping players moving,
and write down what you did.

> Scope: this covers the webapp (`webapp/`) and the badge contract
> (`contracts/`). For the phased delivery plan and what is and isn't
> built yet, see `ROADMAP.md`.

---

## Severity definitions

| Severity | Definition | Examples | Response time |
|---|---|---|---|
| **P1** | The event is down or players cannot progress at all. Public-facing, no workaround. | DB unreachable (`/api/health` 503), all scans rejecting, mint endpoint down event-wide, prize desk cannot verify any badge. | Immediate. Drop everything. |
| **P2** | A surface is degraded but the core loop still works with a workaround, or a single checkpoint/sponsor is affected. | One checkpoint offline, mint failing for some wallets, prize-desk RPC flaky but retryable, rate-limit false positives slowing a subset of players. | Within minutes. Mitigate, then fix. |
| **P3** | Cosmetic, low-impact, or affects internal tooling only. No player-visible breakage. | Audit feed lagging, a metric reads zero, a non-critical console page errors. | Same day / post-event. |

When in doubt, treat it as one level **more** severe until you've confirmed blast radius.

---

## Symptom → first-response table

### 1. DB unreachable — `/api/health` returns 503

`/api/health` returns 503 only when the Postgres ping fails (see
`webapp/app/api/health/route.ts`; `overall = checks.database.ok`).
Everything depends on the DB, so this is **P1**.

1. Confirm: `curl -s https://<host>/api/health | jq` — look at `checks.database`.
2. Read `checks.database.detail` for the driver error (timeout, auth, connection limit).
3. Likely causes, in order:
   - **Connection limit exhausted** (Neon free tier is small). Symptom: `too many connections`. Mitigation: the serverless path should use the Neon HTTP client, not pooled `pg` — confirm `DATABASE_URL` points at the HTTP endpoint for the deployed env.
   - **Neon branch paused / scaled to zero.** Wake it; re-check health.
   - **Bad `DATABASE_URL`** after a deploy/env change. Roll back the env var.
4. If Postgres is genuinely down and won't come back fast, the floor cannot record scans. Pause new starts (comms below) and escalate.

### 2. Mint failing / contract paused

Mint involves: server issues an EIP-712 `MintPermit` (`webapp/lib/mint-permits.ts`), player submits `mint(permit, sig)` from their own wallet, contract verifies and mints (`contracts/`). Several distinct failure modes:

| Symptom | Likely cause | First response |
|---|---|---|
| Mint endpoint returns 503 / "not configured" | `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` or `BADGE_SIGNER_PRIVATE_KEY` unset | `curl /api/health` → check `badge_contract` and `badge_signer`. Set the missing env var, redeploy. |
| Player's tx reverts `paused` | Contract is paused (owner action / circuit breaker) | Confirm pause was intentional. If not, owner unpauses. If yes, hold mints and tell players "badges resume shortly." |
| Tx reverts `bad signer` | Signer key on server ≠ `signer` on contract | The `BADGE_SIGNER_PRIVATE_KEY` address must equal the contract's `signer`. A rotation got half-applied. Re-align (rotate on-chain to match, or restore the env key). |
| Tx reverts `deadline` | Permit expired before submission (default 30 min) | Player re-requests a fresh permit and retries. |
| Tx reverts `already minted` / nonce used | Double-mint attempt | Expected. Player already has a badge; send them to the prize desk. |

Note: the badge contract is **not yet deployed** to a live network (ROADMAP Phase 4 — deploy + KMS still pending). At a real event the address must be configured or mint is a no-go.

### 3. Prize-desk RPC outage

The prize desk verifies a wallet by reading **on-chain** balance
(`balanceOf` + `hasMinted`) via a viem public client over the default
HTTP RPC (`webapp/lib/badge-onchain.ts`). On-chain is the source of
truth at the counter, so an RPC outage blocks verification. Usually **P2**.

1. Confirm it's the RPC, not the DB: `/api/health` will still be 200 (DB fine).
2. Symptom: verification spins or errors; "Contract not configured" appears if the address env is also missing.
3. First response:
   - Retry — transient RPC blips are common.
   - If the public RPC is rate-limiting/down, point the client at a backup provider RPC and redeploy (currently uses viem's default `http()` transport for `BADGE_CHAIN`).
4. **Offline fallback is not built yet** (ROADMAP Phase 5: localStorage cache of last-N eligibility results is planned). Until then, if RPC is hard-down, fall back to manual verification: cross-check the player against the `badge_mints` table / audit feed (`player.minted`) and use staff judgment. Record the manual redemption in `notes`.

### 4. Rate-limit false positives

Limiter is **in-process, per-instance** (`webapp/lib/rate-limit.ts`).
`/api/play/scan` allows **30 scans/minute per IP key**; auth verify is
also limited. Usually **P2**.

1. Symptom: legitimate players get HTTP 429 `rate-limited` with a `retry-after`.
2. Most common real cause: **many players behind one venue NAT/Wi-Fi share an IP**, so they share one bucket. The limiter keys off `x-forwarded-for` / `x-real-ip` (`rateLimitKeyFromRequest`).
3. First response:
   - Confirm the 429s correlate with one egress IP (venue Wi-Fi).
   - Short term: raise the `limit` in `app/api/play/scan/route.ts` (the limiter is designed to **fail open** — better to let a real player through than block the floor) and redeploy.
   - The counters reset on cold start, so the pressure is self-relieving but spiky.
4. Long term: KV-backed limiter keyed per-wallet (ROADMAP Phase 3, planned) removes the shared-IP problem. Not wired today.

### 5. Scan rejects spiking (possible brute force)

A spike in scan rejects can be a bad checkpoint config, a clock-drift
issue, or a real brute-force attempt against the 6-digit TOTP.

What a scan rejection looks like in code (`app/api/play/scan/route.ts`):

| Response | Meaning |
|---|---|
| `401 invalid-code` | TOTP didn't verify against the checkpoint secret (`window: 1` drift) |
| `503 checkpoint-not-configured` | Checkpoint has no `totp_secret` set |
| `400 unknown-checkpoint` | Checkpoint id not in this event |
| `400 scan-rejected` | Already scanned, or no progress to record |
| `429 rate-limited` | Per-IP limit hit (see #4) |

First response:
1. Distinguish the cause. A flood of `429`s is the rate-limiter working; a flood of `401 invalid-code` against one checkpoint is the brute-force signal.
2. **The signal:** every rejected scan writes a `player.scan_rejected` audit row with `meta.reason` (`bad-url-token`, `unknown-checkpoint`, `invalid-code`, `checkpoint-not-configured`, `scan-rejected`). A burst of `invalid-code` against one checkpoint is the brute-force tell. The `429` rate-limit path is intentionally *not* audited (avoids flooding) — read those from platform request-log HTTP rates instead.
3. If brute force is confirmed against a checkpoint: rotate that checkpoint's TOTP secret (booth kiosk "Rotate secret" → `rotateCheckpointSecret`). Previous codes invalidate immediately; legitimate prior scans are unaffected.
4. If a checkpoint is compromised or being abused, pause it (set `checkpoints.status = 'offline'` — the booth "Pause" toggle is planned in Phase 6; until then flip status via the console/DB).

---

## How to read the audit log activity feed

The operator overview's activity feed is the human-readable tail of the
`audit_log` table (`webapp/db/schema.ts` → `auditLog`), surfaced by
`listLiveActivity` in `webapp/lib/event-queries.ts`. It pulls the most
recent rows for the active event, newest first, and humanizes the
`action` string.

- **Every mutation writes an audit row inside the same transaction** — route/checkpoint/sponsor/reward CRUD, staff invites, redemptions, and player `player.scanned` / `player.minted` events.
- Useful actions to scan for during an incident:
  - `player.scanned` — a successful scan (actor = wallet, target = checkpoint, `meta.checkpointName`).
  - `player.minted` — a recorded badge mint (target = `tx_hash`, `meta.tokenId`).
  - redemption actions — reward handed out at the prize desk.
  - `player.scan_rejected` — a rejected scan attempt; `meta.reason` says why. A cluster against one `target` checkpoint is a brute-force signal.
- To query directly during an incident:
  ```sql
  select created_at, actor, action, target, meta
  from audit_log
  where event_id = '<evt_id>'
  order by created_at desc
  limit 50;
  ```

## How to read `/api/health`

Public, unauthenticated probe (`webapp/app/api/health/route.ts`). Curl it:

```bash
curl -s https://<host>/api/health | jq
```

- HTTP **200** ⇔ `checks.database.ok` is true. HTTP **503** ⇔ DB ping failed. The 503 is **database-only** — the other checks are informational and do not flip the status code.
- `checks.database.detail` — ping latency on success, the driver error message on failure.
- `checks.badge_contract` — whether `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` is set, and the chain id.
- `checks.badge_signer` — whether `BADGE_SIGNER_PRIVATE_KEY` is present (never the key itself).
- `checks.play_session_secret` — `configured` / `dev-fallback` / `missing`. In production this **must** be `configured`.

The preflight page (`/app/preflight`) runs a broader battery of event-readiness asserts; use it before doors open.

---

## Escalation tree (placeholder — fill in before each event)

> Wire real names, phone numbers, and a shared channel here at event setup. Automated paging (Slack/Sentry) is **(planned)** — see below.

```
P1  →  On-call engineer            <name> <phone> <@handle>
       └─ if no ack in 10 min  →   Backup engineer       <name> <phone>
                                   └─ Event lead / organizer  <name> <phone>

P2  →  On-call engineer (channel)  #treasureloop-ops (placeholder)
P3  →  File an issue / note in the ops channel; handle post-event.

Vendor contacts (fill in):
  - Neon / DB support             <link/plan tier>
  - RPC provider (Base)           <provider, backup RPC URL>
  - Clerk support                 <link>
  - Hosting (Vercel)              <status page, support>
```

Automated alerting is not wired yet:
- **Sentry** error tracking — (planned, ROADMAP Phase 9).
- **Slack webhook** on P1 / `staff_alerts` — (planned, ROADMAP Phase 9).
- **Uptime monitor** on `/api/health` — (planned; the endpoint exists, the external checker does not).

---

## Status-page comms templates

There is **no hosted status page yet** (`status.treasure.loop` is
**planned**, ROADMAP Phase 9). Until then, post these in the event's
attendee channel / signage. Keep them short and honest.

**Investigating (P1/P2):**
> We're aware some players can't [scan / mint / redeem] right now and are on it. No action needed — your progress is saved. Update in ~10 minutes.

**Identified / mitigating:**
> We found the issue with [scanning at <checkpoint> / badge minting]. A fix is rolling out now. If you got an error, just try again in a few minutes.

**Resolved:**
> [Scanning / minting / prize desk] is back to normal. Thanks for your patience — go finish the loop.

**Single checkpoint down (P2):**
> Heads up: the <checkpoint name> stop is temporarily offline. Skip ahead and come back to it — we'll let you know when it's live again. It won't cost you the badge.

**Degraded but working (e.g. rate-limit / slow RPC):**
> Things are a little slow right now. If a scan or verification fails, wait a few seconds and retry — it'll go through.
