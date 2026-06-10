# 0009 — Per-event badge contract over a single multi-event contract

## Context

Each TreasureLoop event mints finisher badges. `ROADMAP.md` ("Open
questions" #3) poses the design choice: deploy **one badge contract per
event**, or a **single multi-event contract** that namespaces events
internally (e.g. by an event id encoded in the token).

Forces at play:

- Collectibility: a badge that *is* "the ETH Cluj 2026 finisher" reads
  more cleanly as a standalone contract/collection than as token-with-an-
  event-tag inside a shared contract.
- Data tightness: a per-event contract's state (`hasMinted`, `signer`,
  `totalMinted`, pause flag) describes exactly one event, with no
  cross-event coupling and no per-call event-id bookkeeping.
- Blast radius: signer rotation, pausing, or a bug touches only one
  event's contract.
- Cost: deploying a fresh contract per event costs gas each time; a
  single contract is cheaper to operate across many events.

## Decision

Deploy **one `TreasureLoopBadge` contract per event**.

- `contracts/README.md` states it outright: "One contract instance per
  event." The deploy script (`script/Deploy.s.sol`) takes `BADGE_OWNER`,
  `BADGE_SIGNER`, and `BADGE_BASE_URI` for that one event.
- The webapp points at the event's contract via
  `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS`; `BADGE_CHAIN` and the EIP-712
  domain (`lib/badge-contract.ts`) are per-deploy.
- The contract carries no event-id field — it doesn't need one, because
  it only ever serves a single event.

## Consequences

**Positive**
- Cleaner collectibility: each event's badge is its own named ERC-721
  collection.
- Tight, simple on-chain state — no event-id plumbing, no risk of one
  event's mints leaking into another's accounting.
- Isolated blast radius: a pause, signer rotation, or issue affects only
  that event.

**Negative / trade-offs**
- A deploy + verify step per event (cheap on Base Sepolia; see ADR 0007),
  plus updating `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` each time
  (`docs/DEPLOYMENT.md` step 3).
- No single contract to query for cross-event stats; aggregating across
  events is an off-chain (DB) concern, which the app already owns.
- At very high event volume the per-deploy overhead grows; revisit with a
  factory or multi-event design then.

## Status

Accepted — 2026-06. Reflected in the contract design and deploy tooling
(`contracts/`). Per-event deployment happens at ROADMAP Phase 4 /
event setup time.
