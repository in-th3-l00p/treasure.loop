# 0012 — Pricing: free for the ETH Cluj pilot, revisit before any paid event

## Context

`ROADMAP.md` ("Open questions" #4) asks whether we charge organizers,
and notes that the pricing decision shapes onboarding UX (a paid product
needs billing, plans, and a different signup flow than a free one).

The immediate need is the **ETH Cluj pilot** — a single organizer we
onboard in person (`ROADMAP.md` Phase 11 note). Building billing now
would gate the pilot on commerce infrastructure that the first event
does not need, and would over-fit the product before we have real usage
signal on what a paid tier should even include.

This is a **business decision**, not a technical one; it is recorded here
only because it has a direct product/onboarding consequence and the
ROADMAP flags it as an open question.

## Decision

The ETH Cluj pilot is **free**. Defer any pricing / billing decision
until before the first paid event.

- No billing, plans, or payment flow is built for the pilot.
- The one pilot organizer is onboarded in person, so no self-serve paid
  signup is needed yet.

## Consequences

**Positive**
- The pilot ships without billing infrastructure or a commerce signup
  flow.
- We gather real usage before committing to a pricing model, avoiding
  premature monetization design.

**Negative / trade-offs**
- Monetization is unproven; "will organizers pay, and for what?" stays
  an open business question after the pilot.
- When pricing lands it will touch onboarding (plans, billing, possibly
  gating features), so some onboarding rework is deferred, not avoided.

## Status

Accepted — 2026-06. Deferred business decision. Revisit before the first
paid event and write a superseding ADR that records the chosen pricing
model and its onboarding impact.
