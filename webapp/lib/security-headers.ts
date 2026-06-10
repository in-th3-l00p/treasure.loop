/**
 * Content-Security-Policy builder.
 *
 * Strictness tradeoff (also documented in docs/SECURITY_HEADERS.md):
 *   This is a NONCE-LESS policy. A nonce + 'strict-dynamic' CSP would be
 *   stricter, but it forces every page to render dynamically and is
 *   fragile against Clerk's and RainbowKit's injected inline scripts and
 *   styles. We instead pin the exact third-party ORIGINS we depend on and
 *   accept 'unsafe-inline' for scripts/styles. That still blocks the main
 *   XSS vector — loading executable code from an un-allow-listed origin —
 *   while keeping static rendering and the wallet/auth flows working.
 *   This is a sound, ship-able policy, not the maximal one.
 *
 * Origins are grouped by the dependency that requires them so the
 * allow-list stays auditable.
 */

// Clerk: hosted JS (FAPI), Turnstile bot challenge, telemetry, images.
// Clerk in production also serves its JS from `https://clerk.<your-domain>`;
// add that satellite/proxy origin here when the production domain is known.
const CLERK = {
  script: ["https://*.clerk.accounts.dev", "https://challenges.cloudflare.com"],
  connect: ["https://*.clerk.accounts.dev", "https://clerk-telemetry.com"],
  frame: ["https://challenges.cloudflare.com", "https://*.clerk.accounts.dev"],
  img: ["https://img.clerk.com", "https://*.clerk.accounts.dev"],
}

// WalletConnect / RainbowKit: relay (wss), explorer + verify APIs, the
// verify iframe, and remote wallet icons.
const WALLETCONNECT = {
  connect: [
    "https://*.walletconnect.com",
    "https://*.walletconnect.org",
    "wss://*.walletconnect.com",
    "wss://*.walletconnect.org",
    "wss://*.pusher.com",
  ],
  frame: [
    "https://verify.walletconnect.com",
    "https://verify.walletconnect.org",
  ],
  img: ["https://*.walletconnect.com", "https://explorer-api.walletconnect.com"],
}

/**
 * Wallet RPC + chain reads. Injected wallets (MetaMask, Rabby, Coinbase)
 * and our viem reader talk to arbitrary RPC over https/wss. We allow the
 * schemes broadly for `connect-src` only — this does not let third-party
 * code RUN, it only lets already-allowed code reach chain endpoints.
 * Tighten to the specific Base RPC hosts once the production RPC provider
 * is pinned (see docs/SECURITY_HEADERS.md → "needs runtime confirmation").
 */
const RPC_CONNECT = ["https:", "wss:"]

/** Build the CSP header value for the current environment. */
export function buildCsp(): string {
  const isDev = process.env.NODE_ENV === "development"

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // 'unsafe-inline' (no nonce) — Clerk + RainbowKit + Next inject inline
    // scripts. 'unsafe-eval' is dev-only (React refresh / error overlay).
    "script-src": [
      "'self'",
      "'unsafe-inline'",
      ...(isDev ? ["'unsafe-eval'"] : []),
      ...CLERK.script,
    ],
    // Inline styles come from RainbowKit, Clerk, and Tailwind's runtime.
    "style-src": ["'self'", "'unsafe-inline'"],
    // next/font self-hosts Google Fonts at build time → served from 'self'.
    "font-src": ["'self'", "data:"],
    "img-src": [
      "'self'",
      "data:",
      "blob:",
      "https:",
      ...CLERK.img,
      ...WALLETCONNECT.img,
    ],
    "connect-src": [
      "'self'",
      ...CLERK.connect,
      ...WALLETCONNECT.connect,
      ...RPC_CONNECT,
    ],
    "frame-src": ["'self'", ...CLERK.frame, ...WALLETCONNECT.frame],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  }

  if (!isDev) {
    directives["upgrade-insecure-requests"] = []
  }

  return Object.entries(directives)
    .map(([key, values]) => (values.length ? `${key} ${values.join(" ")}` : key))
    .join("; ")
}
