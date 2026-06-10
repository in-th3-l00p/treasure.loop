# 0011 — Booth staff as individual Clerk users over a shared kiosk login

## Context

Each checkpoint is operated by booth staff who run scans and (at the
prize desk) verify badges and hand out rewards. Operator auth is Clerk,
with each event mapped to a Clerk Organization and roles
(`organizer`, `prize_desk`, `booth_staff`, `sponsor`) enforced in
`lib/authz.ts` (ADR 0003).

`ROADMAP.md` ("Open questions" #6) frames the identity choice for booth
staff: give each staffer **their own Clerk user** in the event org, or
use a **shared per-checkpoint kiosk login** (one account, possibly one
device, reused by whoever is on shift).

Forces:

- Accountability: scans, redemptions, and any abuse are written to the
  audit log. If actions trace to a real person, an organizer can answer
  "who recorded this redemption?" A shared login attributes everything to
  a faceless kiosk account.
- Setup friction: a shared login is faster to stand up (one account,
  hand the device over) and needs no per-staffer invite.
- Revocation: removing one staffer who leaves mid-event is clean with
  individual users; with a shared login it means rotating the credential
  for everyone.

## Decision

Booth (and prize-desk) staff sign in as **individual Clerk users** within
the event's organization, each with the appropriate role
(`booth_staff` / `prize_desk`). No shared kiosk login.

- Organizers invite each staffer into the org via Clerk's invitation flow
  (wrapped per ADR 0003).
- Authorization is by role in `lib/authz.ts`, so an individual user with
  the `booth_staff` role has exactly the booth permissions.
- Audited actions (scans, redemptions) carry the acting user's identity.

## Consequences

**Positive**
- Per-staff accountability — every audited action ties to a real person,
  which matters for redemption disputes and abuse investigation
  (`docs/INCIDENT_RUNBOOK.md`).
- Clean, individual revocation: remove one user without disrupting the
  rest of the staff.
- Reuses the existing Clerk org/role/invite machinery — no new auth path.

**Negative / trade-offs**
- More setup before the event: every staffer needs an invite and must
  sign in, versus handing over one shared device.
- Staff need their own credentials/device access on the floor; the
  organizer must provision them ahead of time (`docs/DEPLOYMENT.md`
  step 5, `docs/OPERATOR_PLAYBOOK.md`).
- For a tiny event this is heavier than a shared login; we judge the
  accountability worth it. Revisit with a new ADR if a future format
  genuinely needs anonymous shared kiosks.

## Status

Accepted — 2026-06. Builds on the Clerk org/role model (ADR 0003), which
is implemented; provisioning individual staff users is an event-setup
step (`docs/DEPLOYMENT.md`).
