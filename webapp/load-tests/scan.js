/*
 * k6 load test — ~100 concurrent scans against /api/play/scan.
 *
 * This is a COMMITTED ARTIFACT, not run in CI. It exists so we can
 * rehearse the scan endpoint under conference-day load before the event.
 *
 * ── How to run ───────────────────────────────────────────────────────
 *   1. Install k6:  https://grafana.com/docs/k6/latest/set-up/install-k6/
 *        macOS:  brew install k6
 *   2. Point it at a running app (local or a preview deploy):
 *        BASE_URL=http://localhost:3000 k6 run load-tests/scan.js
 *      Defaults to http://localhost:3000 when BASE_URL is unset.
 *   3. Optional knobs:
 *        VUS=100        virtual users at peak (default 100)
 *        DURATION=30s   sustained load window (default 30s)
 *        CHECKPOINT_ID  the checkpoint id to hammer (default "cp-load-test")
 *        SCAN_TOKEN     a valid signed `t` token, if testing the tap path
 *
 * ── What it measures ─────────────────────────────────────────────────
 *   - p95 latency under load (threshold: < 800ms)
 *   - that the endpoint stays responsive (no socket errors / 5xx storm)
 *
 * Expected responses WITHOUT an authenticated session are 401
 * ("not-authenticated") or 429 (rate-limited). That is fine for a load
 * rehearsal: we are exercising the request path, rate limiter, and
 * server capacity, not asserting a successful scan. To drive successful
 * 200s, run behind a session cookie (export COOKIE and add it to the
 * headers below) against a seeded event + configured checkpoint.
 */

import http from "k6/http"
import { check, sleep } from "k6"

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000"
const CHECKPOINT_ID = __ENV.CHECKPOINT_ID || "cp-load-test"
const SCAN_TOKEN = __ENV.SCAN_TOKEN || ""
const COOKIE = __ENV.COOKIE || ""

const VUS = Number(__ENV.VUS || 100)
const DURATION = __ENV.DURATION || "30s"

export const options = {
  scenarios: {
    // Ramp to ~100 concurrent VUs, hold, then ramp down.
    concurrent_scans: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "5s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    // Keep the endpoint snappy even under load.
    http_req_duration: ["p(95)<800"],
    // We tolerate 401/429 (no session / rate limited) but not socket
    // failures — http_req_failed counts transport-level failures.
    http_req_failed: ["rate<0.05"],
  },
}

export default function scan() {
  const url = `${BASE_URL}/api/play/scan`

  const payload = JSON.stringify({
    checkpointId: CHECKPOINT_ID,
    // Send a token if provided, otherwise a dummy TOTP code so the body
    // shape is realistic. Neither will pass auth without a session — see
    // header comment.
    ...(SCAN_TOKEN ? { t: SCAN_TOKEN } : { code: "000000" }),
  })

  const headers = {
    "Content-Type": "application/json",
  }
  if (COOKIE) headers["Cookie"] = COOKIE

  const res = http.post(url, payload, { headers })

  check(res, {
    "responded (not a socket error)": (r) => r.status !== 0,
    "status is an expected one": (r) =>
      [200, 400, 401, 429, 503].includes(r.status),
    "did not 5xx (except 503 contract-not-configured)": (r) =>
      r.status < 500 || r.status === 503,
  })

  // Small think-time so VUs don't spin in a tight loop and instantly
  // trip the 30/min per-IP rate limit on the very first iteration.
  sleep(1)
}
