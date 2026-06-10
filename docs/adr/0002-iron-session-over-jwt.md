# 0002 — iron-session encrypted cookies over hand-rolled JWT (attendee session)

## Context

Attendees (players) do **not** authenticate through Clerk. They connect
a wallet and prove ownership via SIWE (Sign-In With Ethereum). After
that proof, the server needs a lightweight session so subsequent
requests (progress, scan, mint-permit) know which wallet is acting,
without re-signing every call.

The payload is tiny: the proven wallet address, the chain it signed on,
an issued-at timestamp, and a short-lived pending nonce during the
verify handshake (`webapp/lib/play-session.ts`). Everything else
(progress, mint state) lives server-side keyed by wallet.

Options considered: a stateless **JWT** in a cookie, a server-side
**session store**, or **encrypted-cookie sessions** (`iron-session`).

## Decision

Use **iron-session** — encrypted, signed, `httpOnly` cookies.

- Cookie `treasureloop_play`, `httpOnly`, `sameSite: lax`, `secure` in
  production, 12-hour `maxAge` (sized for a live event day).
- `PLAY_SESSION_SECRET` is required in production (enforced at first
  request, not module load, so `next build` doesn't fail without runtime
  env). A clearly-labeled dev fallback lets the app boot locally.

## Consequences

**Positive**
- No session store to stand up or operate during an event.
- We can rotate the wallet→player mapping server-side (e.g. force
  re-auth on an event change) without shipping anything to the client —
  the documented reason in `play-session.ts` for not using a bare JWT.
- Payload is encrypted, not just signed: nothing sensitive is readable
  client-side, and tampering invalidates the cookie.
- Standard cookie flags give us CSRF posture for the play API
  (`SameSite=Lax`, `HttpOnly`).

**Negative / trade-offs**
- Session state rides in the cookie, so it's bounded in size — fine here
  because the payload is intentionally minimal.
- Rotating `PLAY_SESSION_SECRET` invalidates all live play sessions
  (acceptable: players just reconnect their wallet).
- Production **must** set a 32+ char `PLAY_SESSION_SECRET`; the dev
  fallback is unsafe to ship (guarded, and surfaced in `/api/health`).

## Status

Accepted — 2026-06. Implemented for the attendee surface. Operator auth
is separate (see ADR 0003).
