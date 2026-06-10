# Architecture Decision Records

This directory holds **ADRs** — short, dated records of non-obvious
technical decisions and the reasoning behind them. The goal is that a
future engineer (or AI agent) can understand *why* a choice was made
without reverse-engineering it from the code.

## Convention

- One file per decision: `NNNN-short-title.md`, zero-padded sequence
  (`0001-…`, `0002-…`). Numbers are never reused.
- Each ADR uses the same four headings:
  - **Context** — the forces at play: requirements, constraints, what
    we were comparing against.
  - **Decision** — what we chose, stated plainly.
  - **Consequences** — what this buys us and what it costs us, including
    follow-up work and known trade-offs.
  - **Status** — one of `Proposed`, `Accepted`, `Superseded by NNNN`,
    `Deprecated`. Include the date.
- ADRs are **append-only history**. Don't rewrite an accepted decision —
  if it changes, write a new ADR that supersedes the old one and update
  the old one's Status line to point at it.
- Keep them short. An ADR is a paragraph or two per heading, not a
  design doc.

## Index

| ADR | Decision |
|---|---|
| [0001](./0001-drizzle-over-prisma.md) | Drizzle ORM over Prisma |
| [0002](./0002-iron-session-over-jwt.md) | iron-session encrypted cookies over hand-rolled JWT for the attendee session |
| [0003](./0003-clerk-over-authjs.md) | Clerk over Auth.js for operator auth |
| [0004](./0004-rainbowkit-over-privy.md) | RainbowKit + wagmi over Privy for attendee wallet connect |
| [0005](./0005-in-process-rate-limit-interim.md) | In-process rate limiter as an interim before KV |
| [0006](./0006-soulbound-finisher-badge.md) | Soulbound (non-transferable) finisher badge, enforced on-chain |
| [0007](./0007-base-sepolia-pilot.md) | Base Sepolia for the pilot, mainnet later |
| [0008](./0008-kms-managed-mint-signer-key.md) | KMS-managed mint signer key, not a bare custodial key |
| [0009](./0009-per-event-badge-contract.md) | Per-event badge contract over a single multi-event contract |
| [0010](./0010-code-swap-pairing-over-matchmaking.md) | Code-swap pairing UX over hosted real-time matchmaking |
| [0011](./0011-booth-staff-individual-clerk-users.md) | Booth staff as individual Clerk users over a shared kiosk login |
| [0012](./0012-free-for-eth-cluj-pilot.md) | Pricing: free for the ETH Cluj pilot, revisit before any paid event |

See `ROADMAP.md` ("Tech choices" sections) for the broader phased plan
these decisions sit inside.
