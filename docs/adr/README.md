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

See `ROADMAP.md` ("Tech choices" sections) for the broader phased plan
these decisions sit inside.
