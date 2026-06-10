# 0005 — In-process rate limiter as an interim before KV

## Context

The secure scan flow (`ROADMAP.md` Phase 3) needs rate limiting to slow
brute-force attempts against the 6-digit per-checkpoint TOTP and to cap
abusive request rates on `/api/play/scan` and the SIWE verify endpoint.

The intended production design is a **shared, KV-backed** limiter
(`@upstash/ratelimit` + Vercel KV) so the rate budget is enforced across
all serverless instances and can be keyed per-wallet.

But wiring KV adds an external integration and credentials, which would
gate the scan-flow PR on infrastructure that wasn't ready. We needed
*some* limiter in place now without that dependency.

## Decision

Ship an **in-process sliding-window limiter** as a deliberate interim
(`webapp/lib/rate-limit.ts`).

- A simple per-bucket `Map` of counters with a window reset.
- `/api/play/scan` is limited to 30 scans/minute per request key; the
  SIWE verify endpoint is limited too.
- The request key prefers a stable identifier and falls back to a hashed
  IP (`x-forwarded-for` / `x-real-ip`).
- The module exposes the **same interface** we'll wrap around
  `@upstash/ratelimit` later, so call sites won't change when KV lands.

## Consequences

**Positive**
- Real protection against casual brute force, shipped without blocking
  on KV credentials.
- Drop-in seam: swapping in KV is an implementation change behind the
  existing `rateLimit()` signature, not a call-site rewrite.
- No new infra to operate during the pilot event.

**Negative / trade-offs**
- **Per-instance, not global.** On serverless, cold-spawned instances
  each have their own counters, so the effective limit is per-instance.
  It slows a brute-forcer; it is not a complete defense against a
  determined, distributed attacker.
- **Shared-IP false positives.** Many players behind one venue NAT share
  a bucket and can hit 429s (see the Incident Runbook, "rate-limit false
  positives"). Per-wallet KV keys fix this.
- The limiter is intentionally **fail-open** — on a live floor we'd
  rather admit a real player than block one — which lowers its ceiling
  as a hard security control.

## Status

Accepted (interim) — 2026-06. To be **superseded** when the KV-backed,
per-wallet limiter ships (ROADMAP Phase 3, pending). Track that work and
write the superseding ADR when it lands.
