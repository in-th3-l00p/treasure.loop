# Dependency audit (`npm audit`)

Phase 10 production hardening. Run from `webapp/`. Snapshot date: 2026-06-10.

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 0 |
| Moderate | 29 |
| Low | 0 |
| Info | 0 |
| **Total** | **29** |

`npm audit fix --force` was **not** run (it would force-bump major versions of
the wallet stack and risk breaking the play surface).

## Where the advisories live

All 29 moderate advisories are transitive and concentrated in the **wallet /
web3 dependency tree** (RainbowKit → wagmi → @wagmi/connectors → WalletConnect
/ Reown / MetaMask SDK / viem / ethers), plus the **build toolchain** (esbuild
/ drizzle-kit) and **PostCSS via Next**. None are in first-party runtime code.

Notable root advisories:

- **`esbuild` (moderate)** — "esbuild enables any website to send any requests
  to the dev server and read the response." Dev-server-only; does not affect
  production builds. Pulled in via `drizzle-kit` → `@esbuild-kit/*`.
- **`postcss` (moderate, via `next`)** — XSS via unescaped `</style>` in CSS
  stringify output. Reachable only if untrusted CSS is processed at build time;
  we author all CSS. Fix arrives with a Next patch bump.
- **`ws` (moderate, via `viem` / `ethers`)** — uninitialized memory disclosure.
  Used by RPC transports; upstream-pinned.
- **`uuid` (moderate, via MetaMask SDK)** — missing buffer bounds check in
  v3/v5/v6 when a `buf` arg is provided; our usage path doesn't pass `buf`.
- **`@walletconnect/*`, `@reown/appkit-*`, `@metamask/*`** — chain of moderate
  advisories bottoming out at `viem` / `uuid` / `@metamask/utils`.

## Disposition

- **No critical or high** advisories — acceptable to ship.
- The moderate set is **transitive in the wallet stack** and resolves when
  RainbowKit/wagmi publish releases that bump WalletConnect/Reown/viem. Track
  upstream rather than force-fixing.
- **Action items (Phase 10 follow-up):**
  - [ ] Enable **Dependabot** on the repo (roadmap item) so these bumps land as
        reviewable PRs.
  - [ ] Re-run `npm audit` after the next RainbowKit/wagmi minor bump and
        re-snapshot this file.
  - [ ] `esbuild`/`drizzle-kit` advisory is dev-only; clears when `drizzle-kit`
        updates its `@esbuild-kit` chain.

Reproduce: `cd webapp && npm audit` (or `npm audit --json` for the raw data).
