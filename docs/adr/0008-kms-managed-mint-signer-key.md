# 0008 — KMS-managed mint signer key, not a bare custodial key

## Context

Badge minting is gated by a server-issued EIP-712 `MintPermit`: the
webapp signs a permit for a specific player with
`BADGE_SIGNER_PRIVATE_KEY` (`lib/mint-permits.ts`), and the contract
mints only if `ECDSA.recover(digest, signature) == signer`
(`contracts/README.md`).

That makes the signer key the highest-value secret in the system.
`ROADMAP.md` ("Open questions" #2) states the risk plainly: if the signer
key is stolen, the attacker can authorize **arbitrary** badge mints to
any address — bypassing the entire play-the-loop flow and devaluing every
legitimate badge / prize claim.

A bare custodial key (a plaintext `BADGE_SIGNER_PRIVATE_KEY` sitting in
an env file, a shared password manager, or a developer's machine) has a
large exposure surface: every place it's copied is a place it can leak,
and rotation after a suspected leak is manual and easy to get wrong.

## Decision

Manage the mint signer key in a **KMS / secret manager**, not as a bare
custodial key.

- The key material is generated and held in a KMS or secret manager (AWS
  KMS, GCP KMS, or at minimum a Vercel sealed/encrypted secret), and
  injected into the webapp runtime as `BADGE_SIGNER_PRIVATE_KEY` — never
  committed, never in a shared doc.
- The signer's *address* is what the contract trusts, set as `signer` at
  deploy time (`BADGE_SIGNER` in `script/Deploy.s.sol`).
- Rotation is supported end-to-end: if the key is compromised, generate a
  new one and call the owner-only `setSigner()` on the contract with the
  new address (`contracts/README.md`), then update the env.

See `docs/DEPLOYMENT.md` step 4 for the operational procedure.

## Consequences

**Positive**
- Smaller exposure surface and auditable access to the one secret whose
  compromise = arbitrary mints.
- Clean, pre-planned rotation path (`setSigner()` + env update) instead
  of a redeploy under pressure.
- The key never has to live in plaintext in the repo or a developer's
  shell history.

**Negative / trade-offs**
- More setup than dropping a hex string in `.env` — provisioning a KMS /
  secret manager is an extra operational step before launch.
- For the pilot we treat the signer as a hot key the webapp can sign with
  on every mint; a stricter design (KMS-side signing so the raw key never
  enters the app process) is a future hardening step, not done yet.
- Rotation still requires an owner-controlled contract call, so the
  contract `owner` (multisig/EOA) must be available in an incident.

## Status

Accepted — 2026-06. The app already loads the key only at sign time
(`lib/mint-permits.ts`) and the contract supports `setSigner()`
rotation; sourcing the key from a KMS is a deployment-time requirement
(see `docs/DEPLOYMENT.md`). KMS-side signing (raw key never in-process)
is a future hardening item.
