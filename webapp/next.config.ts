import type { NextConfig } from "next"

const isProd = process.env.NODE_ENV === "production"

/**
 * Static security headers applied to every response.
 *
 * The Content-Security-Policy is NOT set here — it lives in `proxy.ts`
 * so it can be scoped away from static assets and tuned per-request
 * without a rebuild. Everything below is request-independent and safe
 * to bake into the config.
 *
 * `frame-ancestors` (clickjacking defence) is set in the CSP in
 * `proxy.ts`; `X-Frame-Options: DENY` is kept here as a belt-and-suspenders
 * fallback for older browsers that don't honour `frame-ancestors`.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    // The play surface needs the camera for QR scanning; allow it on
    // same-origin only. Everything else is denied.
    value:
      "camera=(self), microphone=(), geolocation=(), browsing-topics=(), payment=(), usb=()",
  },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  // Strip the framework fingerprint.
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  // HSTS only in production — never pin HTTPS for localhost dev.
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
]

const nextConfig: NextConfig = {
  // Drop the `X-Powered-By: Next.js` fingerprint.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
