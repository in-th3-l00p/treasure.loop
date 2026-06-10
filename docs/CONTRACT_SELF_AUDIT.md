# TreasureLoopBadge — Contract Self-Audit

**Contract:** `TreasureLoopBadge` (ERC-721 finisher badge, one instance per event)
**File:** `contracts/src/TreasureLoopBadge.sol`
**Tests:** `contracts/test/TreasureLoopBadge.t.sol`
**Build config:** `contracts/foundry.toml` (solc 0.8.24, optimizer on, 200 runs, `via_ir = false`)
**Dependencies:** OpenZeppelin Contracts v5.1.0 (`ERC721`, `Ownable`, `EIP712`, `ECDSA`)
**Date:** _(fill in at sign-off)_
**Commit:** _(fill in at sign-off)_

## Scope

This is a do-it-yourself, audited-by-eye self-audit performed against the
ROADMAP Phase 4 "Audit checklist (do-it-yourself before any external audit)".
It covers **only** `TreasureLoopBadge.sol` and its Foundry test suite. It is
**not** a substitute for an external paid audit (see "Out of scope" below).

The contract is a small (~150-line) ERC-721 that mints exactly one badge per
address against an EIP-712 `MintPermit` signed by an off-chain server key. The
player submits the permit from their own wallet and pays gas.

### Build / test result

`forge` is installed (`~/.foundry/bin/forge`). Run from `contracts/`:

- `forge build` — **Compiler run successful** (solc 0.8.24).
  - One lint warning: `block-timestamp` may be manipulated by validators
    (`src/TreasureLoopBadge.sol:97`). This is informational and acceptable
    for a multi-minute permit deadline — see CONCERN note in the checklist.
- `forge test` — **20 passed, 0 failed, 0 skipped** (including a 256-run fuzz
  test `testFuzz_mint_anyPlayer_anyNonce` and five soulbound tests).

---

## Audit checklist

| # | Checklist item | Verdict | Evidence |
|---|----------------|---------|----------|
| 1 | No `external` function missing access control | **PASS** | See per-function analysis below. The three state-mutating admin functions are `onlyOwner`; `mint` is intentionally permissionless but is gated by an EIP-712 signature, `msg.sender == permit.player`, nonce, deadline, and `hasMinted` checks. |
| 2 | No re-entrancy guard needed (no external calls during state changes) | **PASS** (with note) | `mint` follows checks-effects-interactions. All effects are written **before** the only external interaction. See detailed analysis below. No `nonReentrant` modifier is present and none is required. |
| 3 | `safeMint` to the player handles ERC-721 receiver contracts | **PASS** | `mint` calls `_safeMint(permit.player, tokenId)` at L120 (OZ ERC-721), which invokes `onERC721Received` on contract recipients and reverts if not implemented. |
| 4 | No `delegatecall` anywhere | **PASS** | No `delegatecall` token appears in the source (verified by grep). The contract is not upgradeable / no proxy. |
| 5 | All `unchecked` blocks justified | **PASS** | Exactly one `unchecked` block, L117–119, justified below. |
| 6 | `block.chainid` (not a constant) used in EIP-712 domain separator — survives a chain fork | **PASS** | The domain separator is computed by OZ `EIP712`, which caches against `block.chainid` and **recomputes** if the chain id changes. Additionally `chainId` is bound a second time inside the struct (L98, L106) and re-checked at L98. |

### 1. Access control (per `external` function)

| Function | Line | Mutates state | Guard | Verdict |
|----------|------|---------------|-------|---------|
| `setBaseURI(string)` | L71 | yes (`_baseTokenURI`) | `onlyOwner` | PASS |
| `setSigner(address)` | L75 | yes (`signer`) | `onlyOwner` | PASS |
| `setMintingPaused(bool)` | L80 | yes (`mintingPaused`) | `onlyOwner` | PASS |
| `mint(MintPermit, bytes)` | L91 | yes (nonce, hasMinted, totalMinted, token) | signature + 5 invariant checks | PASS (permissionless by design) |
| `_baseURI()` | L67 | no (`internal view`) | n/a | N/A |

Inherited `external` functions from OZ `ERC721` (`transferFrom`, `approve`,
`setApprovalForAll`, etc.) and `Ownable` (`transferOwnership`,
`renounceOwnership`) carry OZ's own access control and are unmodified. The badge
is **soulbound (non-transferable)**: the contract overrides the OZ v5 `_update`
hook so every owner-to-owner transfer reverts with `BadgeIsSoulbound()`, leaving
only minting (`from == address(0)`) permitted. `approve`/`setApprovalForAll`
remain callable but are inert because no transfer they could authorize can ever
succeed. See Finding 1 (resolved).

`mint` access model (the security core), all in `mint` L91–122:

- `if (mintingPaused) revert MintingDisabled();` — L95
- `if (msg.sender != permit.player) revert PlayerMismatch();` — L96 (no relayer hijack)
- `if (block.timestamp > permit.deadline) revert InvalidSignature();` — L97
- `if (permit.chainId != block.chainid) revert InvalidSignature();` — L98
- `if (hasMinted[permit.player]) revert AlreadyMinted();` — L99
- `if (usedNonces[permit.nonce]) revert NonceAlreadyUsed();` — L100
- `ECDSA.recover(digest, signature) == signer` — L112–113

### 2. Re-entrancy / checks-effects-interactions (CEI)

`mint` ordering (L95–121):

1. **Checks** — L95–100 (pause, player, deadline, chainId, hasMinted, nonce)
   and L102–113 (recover signer, compare to `signer`).
2. **Effects** — `usedNonces[permit.nonce] = true;` (L115),
   `hasMinted[permit.player] = true;` (L116),
   `tokenId = ++totalMinted;` (L117–119).
3. **Interaction** — `_safeMint(permit.player, tokenId);` (L120), then
   `emit BadgeMinted(...)` (L121).

The only external call is `_safeMint`, which can call back into a malicious
`onERC721Received`. By the time it runs, **all guard state is already
committed**: `hasMinted[player]` and `usedNonces[nonce]` are both `true`, so a
re-entrant `mint` with the same permit reverts at L99/L100, and a re-entrant
`mint` with a *different* valid permit for the same player reverts at L99.
ECDSA recovery makes a re-entrant call with a forged permit impossible without
the signer key. A dedicated `nonReentrant` guard is therefore unnecessary.
Tests `test_mint_revertsOnReuseSameNonce` and
`test_mint_revertsWhenAnotherPlayerReplaysNonce` exercise the guard-after-mint
behaviour.

### 5. `unchecked` justification

Single block, L117–119:

```solidity
unchecked {
    tokenId = ++totalMinted;
}
```

`totalMinted` is `uint256`. It increments by exactly 1 per successful mint, and
each mint requires a fresh unused nonce plus an unminted address, so the count
is bounded by the number of distinct EOAs that ever mint. Overflowing `uint256`
(2^256) is physically impossible. The `unchecked` only saves the overflow check
gas; it cannot produce an unexpected value. Justified.

### 6. Chain-fork safety of the domain separator

There are **two** independent chain-id bindings:

- OZ `EIP712` (imported L6, initialised in the constructor L62 as
  `EIP712("TreasureLoop", "1")`) computes the domain separator over
  `block.chainid`. `_hashTypedDataV4` (used at L111) detects a chain-id change
  and rebuilds the separator rather than reusing a stale cached value, so a
  signature valid on chain A is **not** valid on a forked chain B.
- The `MintPermit` struct also carries an explicit `chainId` field
  (L127/L124), included in the typehash (L47) and the struct hash (L106), and
  re-checked against `block.chainid` at L98. This is belt-and-suspenders: even
  if the domain separator binding were ever bypassed, the in-struct check
  rejects a cross-chain replay. Covered by `test_mint_revertsOnWrongChainId`.

---

## ROADMAP test mapping

Each Phase 4 listed test mapped to the actual function in
`contracts/test/TreasureLoopBadge.t.sol`:

| ROADMAP-listed test | Test function | Line | Present |
|---------------------|---------------|------|---------|
| happy path mint with valid permit | `test_mint_happyPath_assignsTokenAndMarksMinted` | L33 | ✅ |
| reject when caller != permit.player | `test_mint_revertsWhenCallerIsNotPlayer` | L88 | ✅ |
| reject when chainId mismatches | `test_mint_revertsOnWrongChainId` | L121 | ✅ |
| reject after deadline | `test_mint_revertsAfterDeadline` | L106 | ✅ |
| reject double-mint | `test_mint_revertsOnReuseSameNonce` (`AlreadyMinted` fires first) | L135 | ✅ |
| reject nonce replay | `test_mint_revertsWhenAnotherPlayerReplaysNonce` (`NonceAlreadyUsed`) | L149 | ✅ |
| reject signature from non-signer | `test_mint_revertsWhenSignatureFromAttacker` | L97 | ✅ |
| signer rotation works | `test_setSigner_onlyOwner` | L175 | ✅ |
| paused mint reverts | `test_mint_revertsWhenPaused` | L161 | ✅ |
| `tokenURI` returns `baseURI + tokenId` | `test_tokenURI_concatenatesBaseAndId` | L79 | ✅ |

**No listed test is missing.** Extra coverage beyond the ROADMAP list:
`test_mint_emitsEvents` (L54), `test_mint_secondPlayerGetsTokenTwo` (L66),
`test_setBaseURI_onlyOwner` (L186), `test_pauseToggleEmitsEvent` (L199), and a
256-run fuzz test `testFuzz_mint_anyPlayer_anyNonce` (L208).

### Coverage gaps worth noting (not ROADMAP-required)

- **`setSigner` rotation invalidates old signatures end-to-end.** The test
  confirms the setter updates `signer` and is owner-gated, but there is no test
  proving a permit signed by the *old* signer reverts after rotation and one by
  the *new* signer succeeds. Low-risk (logic is a single equality at L113) but
  a 2-assertion addition would close it.
- **Double-mint via two *distinct* nonces for the same player.** Covered
  logically by `hasMinted` (L99) and indirectly, but no explicit test mints,
  then tries a second fully-fresh permit (new nonce) for the same address. The
  fuzz test `vm.assume`s uniqueness, so it doesn't hit this path either.
- **`_safeMint` rejection to a non-receiver contract.** The fuzz test
  *skips* contract addresses (`vm.assume(fuzzedPlayer.code.length == 0)`,
  L211), so the receiver-rejection branch of `_safeMint` is never asserted.

These are nice-to-haves, not blockers.

---

## Findings & recommendations

The contract is **clean**. No critical, high, or medium-severity issues were
found. CEI is correct, access control is complete, there is no `delegatecall`,
the single `unchecked` is safe, chain-fork replay is doubly prevented, and the
badge is soulbound. All 20 tests pass. The findings below are informational /
low and ranked by priority.

1. **(Resolved) Badge is soulbound (non-transferable).**
   _Previously flagged as "transferable, not soulbound."_ The contract now
   overrides the OZ v5 `_update(address to, uint256 tokenId, address auth)`
   hook: it calls `super._update(...)`, captures the returned `from` (the
   current owner), and reverts with the custom error `BadgeIsSoulbound()`
   whenever `from != address(0)` — i.e. on any owner-to-owner transfer. Minting
   (`from == address(0)`) is the only state change the hook permits; no burn
   path is exposed, so `to == address(0)` is not special-cased. `transferFrom`
   and both `safeTransferFrom` overloads therefore revert. `approve` /
   `setApprovalForAll` are left callable but inert (no authorized transfer can
   succeed). This closes the anti-farming gap: because the badge can no longer
   move between wallets, Phase 5's `balanceOf(player)` prize-desk check
   (ROADMAP L345) now reliably identifies the original finisher — a badge can
   only ever be in the wallet it was minted to. Tests:
   `test_transferFrom_revertsSoulbound`,
   `test_safeTransferFrom_noData_revertsSoulbound`,
   `test_safeTransferFrom_withData_revertsSoulbound`,
   `test_transfer_revertsEvenWhenApproved`, and
   `test_mint_viaPermitStillWorks_balanceOfReflects`.

2. **(Low) `setSigner` does not invalidate already-issued permits.**
   Rotating the signer (server-key-compromise recovery, the stated purpose at
   L26–27) stops *new* forged permits but does **not** revoke valid permits an
   attacker may have already exfiltrated and not yet submitted, until their
   `deadline` passes. Mitigation already exists: short deadlines (the webapp
   and tests use 30 minutes) bound the exposure window. Recommend documenting
   that on signer compromise the team should also `setMintingPaused(true)`
   until all outstanding deadlines lapse. No code change required.

3. **(Low) No `tokenURI` revert for a non-existent token is asserted.**
   OZ v5 `tokenURI` reverts on unminted ids; the suite only checks minted ids.
   Add a negative assertion for completeness.

4. **(Informational) `block.timestamp` lint warning (L97).**
   `forge build` warns that validators can nudge `block.timestamp`. The
   manipulation window is a few seconds against a multi-minute deadline, so it
   is immaterial here. No action needed; noted so the warning isn't mistaken
   for a new issue later.

5. **(Informational) Owner is a single key with broad power.**
   The owner can pause minting, rotate the signer, and change the base URI.
   Compromise of the owner key lets an attacker pause the event or repoint
   metadata (`setBaseURI`, L71) — it does **not** let them mint or steal
   badges. Recommend a multisig (e.g. Safe) as `initialOwner` for mainnet.

---

## Out of scope / still required before mainnet

This self-audit does **not** replace, and the following remain open per
ROADMAP Phase 4:

- **External paid audit** — a second, independent professional review. This
  document is "audited-by-eye" only.
- **Deploy to Base Sepolia with a funded deployer key** and Basescan
  verification (ROADMAP L304–305), then 14 days running without an unexpected
  revert before mainnet (L329).
- **KMS for the signer key** — move `BADGE_SIGNER_PRIVATE_KEY` out of plain env
  into AWS KMS / Vercel secret manager and fetch on cold start
  (ROADMAP L306–308). The whole mint authorisation rests on this single key.
- **Multisig owner** for mainnet (see Finding 5).
