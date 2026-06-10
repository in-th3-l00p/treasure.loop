# 0004 — RainbowKit + wagmi over Privy for attendee wallet connect

## Context

The attendee surface needs the player to connect a wallet, prove
ownership (SIWE), and later sign a `mint(permit, signature)` transaction
to claim their finisher badge. Target chains are **Base Sepolia** (pilot)
and **Base** mainnet (`webapp/lib/wagmi.ts`).

The product principle is *minimal wallet friction, no app install*
(`PROJECT_CONTEXT.md`). Attendees are a crypto-native conference crowd,
so most already have an injected wallet (MetaMask, Rabby, Coinbase
Wallet extension) or a mobile wallet reachable via WalletConnect.

Options: **Privy** (embedded/email-first wallets, social login,
account abstraction) versus **RainbowKit + wagmi** (connect-existing-wallet,
viem-native).

## Decision

Use **RainbowKit** on top of **wagmi** + **viem**.

- `getDefaultConfig` with `chains: [baseSepolia, base]`, `ssr: true`
  (`webapp/lib/wagmi.ts`).
- WalletConnect is optional: `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
  enables mobile-wallet deeplinks; injected wallets work without it for
  local dev (RainbowKit just warns).
- viem is already the chain library everywhere else (mint permits via
  `privateKeyToAccount` + `signTypedData`, on-chain badge reads in the
  prize desk), so wagmi/viem is one consistent stack.

## Consequences

**Positive**
- Players bring their own wallet — no embedded-wallet custody, no new
  key material for us to hold, fewer moving parts on event day.
- One coherent EVM stack (wagmi + viem) across attendee connect, badge
  reads, and permit signing.
- The badge is minted to the player's *own* wallet, which matches the
  collectibility goal and the contract's `msg.sender == permit.player`
  invariant (`contracts/README.md`).

**Negative / trade-offs**
- No email/social onboarding for non-crypto users — acceptable for a
  Web3 conference audience, would need reconsidering for a general one.
- The player pays their own (testnet, then small mainnet) gas. The
  permit model keeps this to one cheap call.
- We forgo Privy's embedded-wallet / account-abstraction conveniences;
  if a future event needs gasless or wallet-less onboarding, revisit
  with a new ADR.

## Status

Accepted — 2026-06. Implemented; attendee connect + SIWE + permit-based
mint flow in place (badge contract deployment pending, ROADMAP Phase 4).
