# 0003 — Clerk over Auth.js for operator authentication

## Context

The operator side of TreasureLoop (organizer console, sponsor reports,
prize desk, booth kiosk) needs real multi-tenant auth with:

- **Organizations** — each event is a tenant; operators belong to one.
- **Roles** — `organizer`, `prize_desk`, `booth_staff`, `sponsor`, with
  per-route and per-action policy (`webapp/lib/authz.ts`, roles namespaced
  `org:*`).
- **Invitations** — organizers invite staff/sponsors into the org.
- **Webhooks** — `organization.created` provisions an event row
  (`/api/webhooks/clerk` → `ensureEventForOrg`), idempotently.

Options: build it on **Auth.js (NextAuth)** plus our own org/role/invite
layer, or adopt **Clerk**, which ships Organizations, roles, invitations,
and a hosted UI out of the box.

This is distinct from attendee auth, which is wallet + SIWE (ADR 0002).

## Decision

Use **Clerk** (`@clerk/nextjs`) for all operator auth.

- A Clerk **Organization** *is* an event; `events.org_id` mirrors the
  Clerk org id so a signed-in operator maps to their event with no extra
  lookup (`webapp/db/schema.ts`).
- Roles come from Clerk org roles and are enforced centrally in
  `lib/authz.ts` (`can*` policy functions + a route map). Routes and
  Server Actions call the policy; they never inline role checks.
- Staff invitations wrap Clerk's `createOrganizationInvitation`.
- The Clerk sign-in widget is restyled via `appearance` in
  `app/layout.tsx` plus `.cl-*` overrides in `globals.css`.

## Consequences

**Positive**
- Organizations, roles, and invitations are solved for us — a large
  chunk of Phase 2 we didn't have to build or secure ourselves.
- Hosted, maintained sign-in UI and session handling.
- Clean tenancy: org id ⇔ event id keeps every query event-scoped.

**Negative / trade-offs**
- A third-party dependency in the critical auth path and a cost line at
  scale.
- Webhook delivery is at-least-once, so provisioning must be idempotent
  (`ON CONFLICT (org_id) DO NOTHING`); the `/app` layout also defensively
  re-runs the provisioning helper so a missed webhook still yields a row.
- Operator and attendee auth are two different systems by design — more
  surface area, but the right separation (operators are people with
  emails; attendees are wallets).

## Status

Accepted — 2026-06. Implemented; Phase 2 (operator CRUD on Clerk orgs)
shipped.
