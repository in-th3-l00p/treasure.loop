# Security headers, CSP, and cookie audit

Phase 10 (production hardening) — security headers, Content-Security-Policy,
and the cookie-flag audit. This documents what ships and what still needs
runtime confirmation on the production domain.

## Where headers come from

| Mechanism | File | Sets |
|---|---|---|
| `next.config.ts` `headers()` | `next.config.ts` | All static security headers (request-independent) |
| Proxy (Next 16's renamed Middleware) | `proxy.ts` + `lib/security-headers.ts` | `Content-Security-Policy` (on HTML/navigation responses, not `/api/*`) |

The CSP is built in `lib/security-headers.ts` (`buildCsp()`) and stamped onto
responses by `withCsp()` in `proxy.ts`. Keeping it in code (not config) makes
the third-party allow-list legible and lets us flip individual origins
without rebuilding.

## Static headers (every response)

Set in `next.config.ts` for `source: "/:path*"`:

| Header | Value | Notes |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Block MIME sniffing |
| `X-Frame-Options` | `DENY` | Clickjacking fallback for old browsers (CSP `frame-ancestors` is primary) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak full URLs cross-origin |
| `Permissions-Policy` | `camera=(self), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()` | Camera allowed same-origin only (QR scanning on `/play`); everything else denied |
| `X-DNS-Prefetch-Control` | `on` | |
| `X-Permitted-Cross-Domain-Policies` | `none` | |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | **Production only** (`NODE_ENV=production`). Never pinned for localhost dev. |
| `X-Powered-By` | *(removed)* | `poweredByHeader: false` strips the framework fingerprint |

## Content-Security-Policy

A **nonce-less** policy. The full directive set (production):

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://*.clerk.accounts.dev https://challenges.cloudflare.com;
style-src 'self' 'unsafe-inline';
font-src 'self' data:;
img-src 'self' data: blob: https: https://img.clerk.com https://*.clerk.accounts.dev https://*.walletconnect.com https://explorer-api.walletconnect.com;
connect-src 'self' https://*.clerk.accounts.dev https://clerk-telemetry.com https://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org wss://*.pusher.com https: wss:;
frame-src 'self' https://challenges.cloudflare.com https://*.clerk.accounts.dev https://verify.walletconnect.com https://verify.walletconnect.org;
worker-src 'self' blob:;
object-src 'none';
base-uri 'self';
form-action 'self';
frame-ancestors 'none';
upgrade-insecure-requests
```

In development, `script-src` also gets `'unsafe-eval'` (React refresh / error
overlay needs it) and `upgrade-insecure-requests` is omitted.

### Why nonce-less (the strictness tradeoff)

A nonce + `'strict-dynamic'` CSP would be stricter, but:

- it forces **every page to render dynamically** (no static optimization,
  no PPR), which we don't want for the public landing page; and
- it is fragile against Clerk's and RainbowKit's **injected inline scripts
  and styles**, which would need per-render nonce plumbing through
  third-party SDKs we don't control.

Instead we pin the exact third-party **origins** we depend on and accept
`'unsafe-inline'` for scripts/styles. This still blocks the main XSS vector
— loading executable code from an un-allow-listed origin — while keeping
static rendering and the wallet/auth flows working. This is a **sound,
ship-able policy, not the maximal one.**

### Origin rationale

- **Clerk** — `https://*.clerk.accounts.dev` (hosted FAPI JS + images),
  `https://challenges.cloudflare.com` (Turnstile bot challenge),
  `https://clerk-telemetry.com` (telemetry, dev instances).
- **WalletConnect / RainbowKit** — relay over `wss://*.walletconnect.{com,org}`,
  explorer/verify APIs over `https://*.walletconnect.{com,org}`, the verify
  iframe (`https://verify.walletconnect.{com,org}`), `wss://*.pusher.com`.
- **Google Fonts** — none needed. `next/font/google` self-hosts the fonts at
  build time, so they're served from `'self'`.
- **Wallet RPC / chain reads** — `connect-src` includes the broad `https:` and
  `wss:` schemes. Injected wallets (MetaMask, Rabby, Coinbase) and the viem
  reader talk to arbitrary RPC and to the newer Reown/AppKit config endpoints
  (`api.web3modal.org`, `pulse.walletconnect.org`), which are not in the
  walletconnect.com/org families. `connect-src` only governs where
  already-allowed code may *connect*, not what code may *run*, so this is a
  measured relaxation, not a script hole.

### Directives that need runtime confirmation on the production domain

1. **Clerk production origin.** Production Clerk often serves JS from
   `https://clerk.<your-domain>` (a CNAME/satellite), not only
   `*.clerk.accounts.dev`. When the production domain is set, add that origin
   to `CLERK.script` / `CLERK.connect` / `CLERK.frame` in
   `lib/security-headers.ts`. Re-run the browser smoke test on the real domain.
2. **`connect-src https: wss:` tightening.** Once the production RPC provider
   is pinned (e.g. a specific Base RPC URL) and a real WalletConnect
   `projectId` is configured, consider replacing the broad `https:`/`wss:` with
   the explicit RPC + Reown hosts. Verify the connect modal still completes a
   real wallet handshake before tightening.
3. **`'unsafe-inline'` removal** is intentionally deferred — see tradeoff above.

## CSP smoke test (run)

Built (`npm run build`), served with `npm run start -- --port 3017` under
`NODE_ENV=production`, and loaded with the Playwright browser:

| Route | CSP violations | Notes |
|---|---|---|
| `/` | none | Clerk JS loaded from `*.clerk.accounts.dev`. One `ERR_SSL_PROTOCOL_ERROR` on a `/login` prefetch — this is `upgrade-insecure-requests` upgrading a plaintext-localhost prefetch to HTTPS; correct in real prod (HTTPS), harmless artifact locally. |
| `/login` | none | Clerk sign-in widget rendered. Only pre-existing Clerk dev-key + structural-CSS warnings. |
| `/play` | none | WalletConnect/Reown requests **reached** their origins (403/400 because the dev `projectId=demo` is fake — application-level, not CSP-blocked). `/api/play/auth/me` returned 500 (no `DATABASE_URL` in the local prod run) — server error, not CSP. |

No `Refused to load/execute/connect … Content Security Policy` messages
appeared on any route. **Result: CSP passes the smoke test.** Re-verify on the
production HTTPS domain after adding the Clerk production origin (item 1 above).

## Cookie-flag audit

### Play session (iron-session) — `lib/play-session.ts`

| Flag | Value | Verdict |
|---|---|---|
| `httpOnly` | `true` | ✅ JS can't read the session cookie |
| `secure` | `process.env.NODE_ENV === "production"` | ✅ HTTPS-only in prod, off for localhost dev |
| `sameSite` | `"lax"` | ✅ Appropriate — survives top-level navigation, blocks cross-site POST |
| `path` | `"/"` | ✅ |
| `maxAge` | `60 * 60 * 12` (12h) | ✅ Short-lived for a live event |

The cookie name is `treasureloop_play`. The session payload is encrypted by
iron-session; the password is `PLAY_SESSION_SECRET` (enforced ≥ 32 chars in
production at first request-time via `assertProductionSecret()`). **No changes
needed — flags are already correct.**

### Clerk cookies

Clerk sets its own session/JWT cookies via its SDK. By default Clerk uses
`HttpOnly` for the session token, `Secure` on HTTPS, and `SameSite=Lax`.
These are managed by `@clerk/nextjs` and not overridden in this app — the
defaults are the correct posture. No app-side change required; confirm on the
production domain that cookies carry `Secure` (they will, once served over
HTTPS) and that the Clerk instance is a production instance (the dev-key
warning in the smoke test is expected on the dev instance).

## CSRF posture (Phase 10 checklist item)

- **Play API** — guarded by the iron-session cookie with `SameSite=Lax`;
  state-changing routes are POST, so a cross-site form can't forge them with
  credentials. The SIWE flow additionally proves wallet ownership.
- **Operator console** — Server Actions (Next built-in CSRF protection) +
  Clerk session. The proxy enforces auth + role on `/app/*`.
