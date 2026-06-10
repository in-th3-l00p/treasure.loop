# 0007 — Base Sepolia for the pilot, mainnet later

## Context

The badge contract has to be deployed to *some* network before the first
event. `ROADMAP.md` ("Open questions" #1) frames the choice: **Base
Sepolia** (testnet) for the pilot versus **Base** mainnet from day one.

Constraints shaping the call:

- The pilot is the ETH Cluj event — a crypto-native audience comfortable
  with adding a testnet and getting faucet ETH.
- The contract is written and Foundry-tested but has **not** had a paid
  external audit (`contracts/README.md`). Mainnet with anything of value
  on the line would want one (`ROADMAP.md` notes adding 2–4 weeks for an
  audit if rewards are valuable).
- The badge is soulbound and gates *physical* prizes handed out at a
  desk (ADR 0006); the on-chain token itself carries no monetary value.
- The whole stack already targets Base: `lib/wagmi.ts` configures
  `[baseSepolia, base]`, and `lib/badge-contract.ts` pins
  `BADGE_CHAIN = baseSepolia`.

## Decision

Deploy on **Base Sepolia** for the pilot; move to **Base mainnet** for
later production events.

- Free testnet ETH means players pay no real gas to mint, removing a
  friction point and a support burden at the booth.
- No real money on-chain means the unaudited contract is not an audit
  blocker for the first event.
- The chain is a single config point (`BADGE_CHAIN` in
  `lib/badge-contract.ts`, plus the wagmi chain list), so promoting to
  mainnet is a contract redeploy + env change, not a rewrite.

## Consequences

**Positive**
- Ship the pilot now without gating on a paid audit or on funding player
  gas.
- Realistic end-to-end test of the mint + prize flow on a real chain,
  with zero financial risk.
- Cheap to iterate — redeploy the contract freely between rehearsals.

**Negative / trade-offs**
- Testnet badges are not "real" mainnet collectibles; players who care
  about that get a mainnet badge only at a later event.
- Base Sepolia is a public testnet with no uptime SLA; a testnet outage
  on event day would block minting. Dress-rehearsal mode (badges not
  minted) is the fallback if the chain is unavailable.
- Mainnet promotion should be paired with an external contract audit
  before any event with valuable rewards (ROADMAP timeline note).

## Status

Accepted — 2026-06. `BADGE_CHAIN = baseSepolia` in code; contract
deployment to Base Sepolia is the next step (ROADMAP Phase 4). Revisit
for mainnet before a production event — write a superseding ADR then.
