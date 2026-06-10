# 0006 — Soulbound (non-transferable) finisher badge

## Context

The finisher badge is the ERC-721 a player mints after completing the
loop, and it gates the prize desk: a verified badge holder is handed a
physical reward (`ROADMAP.md` Phase 5). That makes the badge a
bearer-like claim on a real-world prize.

If the badge were freely transferable, the prize claim would be too. A
player could finish once, then sell or transfer their badge to someone
who never played, or one person could buy up badges to redeem multiple
rewards. The whole anti-farming story — one badge per player, earned by
actually walking the route — collapses if badges trade hands.

The product principle is that the badge is a *proof of participation*
tied to the person who earned it, not a tradable collectible
(`PRODUCT.md`).

## Decision

Make the badge **soulbound (non-transferable)**, enforced **on-chain**.

- `TreasureLoopBadge.sol` overrides the OpenZeppelin v5 ERC-721
  `_update` hook: mints (`from == address(0)`) are allowed, but any
  transfer between owners reverts with `BadgeIsSoulbound()`. No burn path
  is exposed.
- Enforcement lives in the contract, not just the app, so it holds even
  if someone interacts with the token directly on-chain.
- Combined with the contract's per-player `hasMinted` guard, this gives
  "one earned, locked badge per wallet".

## Consequences

**Positive**
- Anti-farming: a badge can't be bought, sold, or moved to a wallet that
  didn't earn it, so the prize-desk claim stays tied to the real player.
- Simpler prize-desk trust model — verifying badge ownership is
  verifying participation.
- Matches the "proof of participation, not a tradable asset" framing.

**Negative / trade-offs**
- A player who loses access to their wallet loses the badge; there is no
  transfer or recovery path on-chain. For the pilot we accept this — the
  prize desk can fall back to the off-chain scan/audit record if needed.
- Badges can't be gifted or consolidated, which forecloses any future
  secondary-collectible use; revisit with a new ADR if a future event
  wants tradable mementos.

## Status

Accepted — 2026-06. Implemented in `contracts/src/TreasureLoopBadge.sol`
(`_update` override; Foundry-tested). Contract deployment pending
(ROADMAP Phase 4).
