# Demo-Ready Milestone Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reach the milestone where TreasureLoop can present its power live: a scripted ~10-minute demo in which an organizer, booth staff, a player, and prize-desk staff complete the entire real loop — console alive with data, kiosk codes rotating, a real badge minted on Base Sepolia and visible in a wallet, an on-chain-verified redemption — with nothing faked on screen.

**Architecture:** Three thrusts. (1) Make the chain real: deploy `TreasureLoopBadge` to Base Sepolia and serve wallet-renderable metadata, so "mint your badge" produces something you can show in a wallet and on Basescan. (2) Make the app feel alive during live play: player scans/mints flow into the audit log and surface in the overview activity feed; the console and kiosk poll for fresh data; the scan-success moment reveals the next clue; the kiosk shows a join-QR and incoming scans. (3) Make the demo reproducible: a rich demo seed and a written runbook so anyone can reset and present in minutes.

**Tech Stack:** Next.js 16 App Router (Turbopack), Drizzle + Postgres (PGlite in tests), Clerk (staff) + SIWE/iron-session (players), wagmi/viem/RainbowKit, Foundry (contract), vitest, `qrcode` (new dep).

**Current state (verified 2026-06-10):** Console and play surface run entirely on real DB data (`/api/play/event` serves the event sheet). All CRUD server actions exist and are tested (105 tests green, build green). The contract has 15 passing Foundry tests but is **not deployed**; `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` / `BADGE_SIGNER_PRIVATE_KEY` are unset, so `/play/claim` dead-ends at "contract not configured". Player scans/mints do **not** write audit-log rows, so the overview's "Live activity" misses the most important events. Console pages don't refresh themselves. Seed data contains zero players/scans, so charts render empty.

**Conventions that bind every task** (from AGENTS.md / PROJECT_CONTEXT.md):
- Work from `webapp/` unless stated otherwise. Verify with `npm run lint`, `npx tsc --noEmit`, `npx vitest run`, `npm run build`.
- Small single-purpose commits, no `Co-authored-by` trailers.
- Use the shared kit in `webapp/components/product/` for console UI. No fake numbers, no dead links, no em dashes in UI copy.
- Server code that the play surface depends on lives in `lib/player-store.ts` (it has `__setStoreDb` injection so PGlite tests can exercise it).

---

## The demo script this milestone must support

1. **Organizer** signs in → `/app` shows a living overview (players moving, hourly chart, activity feed ticking) → `/app/preflight` is fully green.
2. **Booth staff** opens `/app/booth/<cp>` on a tablet: giant rotating code, a join-QR, and a "recent scans" list that updates as players check in.
3. **Player** (phone): scans the kiosk QR → `/play` → connects wallet, SIWE → scans all 5 checkpoints by typing the live TOTP codes → each success reveals the next clue → `/play/claim` mints a **real ERC-721 on Base Sepolia** (~2s confirm) → badge JSON/SVG renders from our metadata endpoint, tx visible on Basescan.
4. **Prize desk** pastes/scans the player's wallet → big green **Eligible** verdict comes from `balanceOf` **on chain** → redeem → stock decrements, redemption appears in the feed and in the organizer's activity within ~10s.

---

### Task 1: Badge metadata builder + public endpoint

The contract's `tokenURI(id)` is `baseURI + id`. We point `baseURI` at `https://<host>/api/badge-metadata/`, so this endpoint must exist **before** the deploy task. The SVG is inlined as a data URI so wallets need only one fetch.

**Files:**
- Create: `webapp/lib/badge-metadata.ts`
- Create: `webapp/tests/badge-metadata.test.ts`
- Create: `webapp/app/api/badge-metadata/[tokenId]/route.ts`
- Modify: `webapp/proxy.ts` (public route matcher)

- [ ] **Step 1: Write the failing test**

Create `webapp/tests/badge-metadata.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { buildBadgeMetadata } from "@/lib/badge-metadata"

describe("buildBadgeMetadata", () => {
  const meta = buildBadgeMetadata({
    tokenId: 7,
    eventName: "ETH Cluj 2026: TreasureLoop Pilot",
    networkName: "Base Sepolia",
  })

  it("names the token after the event and id", () => {
    expect(meta.name).toBe("ETH Cluj 2026 Finisher #7")
  })

  it("inlines the image as an SVG data URI", () => {
    expect(meta.image.startsWith("data:image/svg+xml;base64,")).toBe(true)
    const svg = Buffer.from(
      meta.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf-8")
    expect(svg).toContain("<svg")
    expect(svg).toContain("ETH CLUJ 2026")
    expect(svg).toContain("#7")
  })

  it("carries event and network attributes", () => {
    expect(meta.attributes).toContainEqual({
      trait_type: "Event",
      value: "ETH Cluj 2026",
    })
    expect(meta.attributes).toContainEqual({
      trait_type: "Network",
      value: "Base Sepolia",
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/badge-metadata.test.ts`
Expected: FAIL — `Cannot find module '@/lib/badge-metadata'`

- [ ] **Step 3: Implement the builder**

Create `webapp/lib/badge-metadata.ts`:

```ts
/**
 * ERC-721 metadata for the finisher badge, OpenSea-compatible.
 *
 * The image is an inline SVG data URI so wallets render the badge with
 * a single metadata fetch — no separate image host to keep alive
 * during the event. Colors are hex (not oklch): wallet SVG renderers
 * are conservative.
 */

export interface BadgeMetadata {
  name: string
  description: string
  image: string
  attributes: { trait_type: string; value: string }[]
}

export function buildBadgeMetadata(input: {
  tokenId: number
  eventName: string
  networkName: string
}): BadgeMetadata {
  // "ETH Cluj 2026: TreasureLoop Pilot" → "ETH Cluj 2026"
  const eventTitle = input.eventName.split(":")[0].trim()
  const svg = badgeSvg(eventTitle, input.tokenId)
  return {
    name: `${eventTitle} Finisher #${input.tokenId}`,
    description:
      `Finisher badge for the ${eventTitle} TreasureLoop. ` +
      `The holder completed every staffed checkpoint on the venue floor; ` +
      `completion settled on-chain and gated the physical prize desk.`,
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    attributes: [
      { trait_type: "Event", value: eventTitle },
      { trait_type: "Network", value: input.networkName },
      { trait_type: "Badge", value: "Finisher" },
    ],
  }
}

function badgeSvg(eventTitle: string, tokenId: number): string {
  const title = escapeXml(eventTitle.toUpperCase())
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">`,
    `<rect width="600" height="600" fill="#0f0d14"/>`,
    `<circle cx="300" cy="270" r="150" fill="none" stroke="#a78bfa" stroke-width="3" opacity="0.9"/>`,
    `<circle cx="300" cy="270" r="118" fill="none" stroke="#a78bfa" stroke-width="1" opacity="0.35"/>`,
    `<circle cx="300" cy="270" r="10" fill="#a78bfa"/>`,
    `<text x="300" y="470" text-anchor="middle" font-family="monospace" font-size="26" letter-spacing="6" fill="#f4f1fa">${title}</text>`,
    `<text x="300" y="510" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="4" fill="#8d87a0">TREASURELOOP FINISHER</text>`,
    `<text x="300" y="550" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="2" fill="#a78bfa">#${tokenId}</text>`,
    `</svg>`,
  ].join("")
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/badge-metadata.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Add the route handler**

Create `webapp/app/api/badge-metadata/[tokenId]/route.ts`:

```ts
import { NextResponse } from "next/server"

import { buildBadgeMetadata } from "@/lib/badge-metadata"
import { networkLabel } from "@/lib/play-client"
import { currentEventId, getPublicEvent } from "@/lib/player-store"

/**
 * tokenURI target for TreasureLoopBadge: `baseURI + tokenId`.
 * Public by design — wallets and marketplaces fetch it anonymously.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ tokenId: string }> }
) {
  const { tokenId: raw } = await params
  const tokenId = Number(raw)
  if (!Number.isInteger(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: "invalid-token-id" }, { status: 400 })
  }

  let eventId: string
  try {
    eventId = await currentEventId()
  } catch {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }
  const event = await getPublicEvent(eventId)
  if (!event) {
    return NextResponse.json({ error: "no-active-event" }, { status: 503 })
  }

  return NextResponse.json(
    buildBadgeMetadata({
      tokenId,
      eventName: event.name,
      networkName: networkLabel(event.network),
    }),
    {
      headers: {
        // Metadata is immutable per token for the event's duration.
        "cache-control": "public, s-maxage=300, stale-while-revalidate=3600",
      },
    }
  )
}
```

- [ ] **Step 6: Make the route public in the middleware**

In `webapp/proxy.ts`, extend `isPublicRoute`:

```ts
const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/sign-up(.*)",
  "/play(.*)", // attendee surface — wallet auth, not Clerk
  "/api/play/(.*)", // attendee API — guarded by SIWE session, not Clerk
  "/api/badge-metadata/(.*)", // tokenURI target — wallets fetch anonymously
  "/api/webhooks/(.*)", // signed by the provider, not by Clerk session
  "/api/health",
])
```

- [ ] **Step 7: Verify end-to-end against the dev server**

Run (from `webapp/`, with the compose Postgres up and seeded):

```bash
npm run build && npm run start -- --port 3010 &
sleep 4
curl -s http://localhost:3010/api/badge-metadata/7 | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3010/api/badge-metadata/zero
kill %1
```

Expected: first curl prints JSON starting `{"name":"ETH Cluj 2026 Finisher #7"`, second prints `400`.

- [ ] **Step 8: Gates and commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run
git add lib/badge-metadata.ts tests/badge-metadata.test.ts "app/api/badge-metadata" proxy.ts
git commit -m "Serve ERC-721 badge metadata with an inline SVG"
```

---

### Task 2: Seed writes the badge contract address onto the event

`updateEventSettings` can patch `badgeContractAddress`, but the seed should pick it up from env so a reseed never silently detaches the event from the deployed contract.

**Files:**
- Modify: `webapp/db/seed.ts`

- [ ] **Step 1: Patch the event insert**

In `webapp/db/seed.ts`, the `db.insert(schema.events).values({...})` call gains one property:

```ts
    .values({
      orgId: "org_dev_seed",
      name: "ETH Cluj 2026: TreasureLoop Pilot",
      slug: "eth-cluj-2026",
      venue: "Cluj Innovation Hall",
      datesStart: new Date("2026-07-17T08:00:00Z"),
      datesEnd: new Date("2026-07-19T18:00:00Z"),
      network: "base-sepolia",
      status: "live_rehearsal",
      badgeContractAddress:
        process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS ?? null,
    })
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run db:seed`
Expected: seed completes; `docker exec treasureloop-postgres-1 psql -U postgres -d treasureloop -c "select badge_contract_address from events;"` shows NULL (env unset until Task 9) — no error.

- [ ] **Step 3: Commit**

```bash
git add db/seed.ts
git commit -m "Seed badge contract address from env"
```

---

### Task 3: Record the real tokenId from the mint receipt

`/api/play/mint-confirm` already accepts `tokenId`, but the claim page never sends it, so badge rows have `token_id NULL` and we can't deep-link the token. Parse the ERC-721 `Transfer` event from the receipt.

**Files:**
- Modify: `webapp/lib/badge-contract.ts` (add Transfer event to ABI)
- Modify: `webapp/lib/play-client.ts:111-118` (`confirmMint` signature)
- Modify: `webapp/app/play/claim/page.tsx` (parse receipt, pass tokenId, show it)

- [ ] **Step 1: Add the Transfer event to the ABI**

In `webapp/lib/badge-contract.ts`, append to the `BADGE_ABI` array (before the closing `] as const`):

```ts
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
```

- [ ] **Step 2: Extend the client wrapper**

In `webapp/lib/play-client.ts`, change `confirmMint`:

```ts
export async function confirmMint(args: {
  txHash: Hex
  tokenId?: number
}): Promise<{ ok: boolean; badgeMintedAt: number; txHash: Hex }> {
  return jsonFetch("/api/play/mint-confirm", {
    method: "POST",
    body: JSON.stringify(args),
  })
}
```

- [ ] **Step 3: Parse the receipt on the claim page**

In `webapp/app/play/claim/page.tsx`:

Add to imports: `import { parseEventLogs } from "viem"` and a state
`const [tokenId, setTokenId] = useState<number | null>(null)`.

Replace the confirm block inside `mint()`:

```ts
      setState("confirming")
      let mintedTokenId: number | undefined
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const transfers = parseEventLogs({
          abi: BADGE_ABI,
          logs: receipt.logs,
          eventName: "Transfer",
        })
        const id = transfers[0]?.args.tokenId
        if (id !== undefined) {
          mintedTokenId = Number(id)
          setTokenId(Number(id))
        }
      }
      setState("recording")
      await confirmMint.mutateAsync({
        txHash: hash as Hex,
        tokenId: mintedTokenId,
      })
```

And where the confirmed-tx line renders, include the token number:

```tsx
          {minted && txHash && (
            <p className="text-center text-[11px] text-muted-foreground">
              {tokenId !== null ? `Token #${tokenId} · ` : ""}Confirmed on
              chain ·{" "}
              <a
                href={explorerTxUrl(network, txHash)}
                className="text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener"
              >
                view tx
              </a>
            </p>
          )}
```

- [ ] **Step 4: Gates and commit**

Run: `npm run lint && npx tsc --noEmit && npx vitest run`
Expected: all green (behavior is exercised live in Task 9's walkthrough).

```bash
git add lib/badge-contract.ts lib/play-client.ts app/play/claim/page.tsx
git commit -m "Record minted tokenId from the transfer log"
```

---

### Task 4: Player scans and mints land in the audit log

The overview's "Live activity" reads `audit_log`, but scans and mints never write it — so during a live demo the feed sits still while the floor moves. Write audit rows from `player-store` (only on *first* scan, not idempotent replays) and humanise them in the feed.

**Files:**
- Modify: `webapp/lib/player-store.ts` (`recordScan`, `recordBadgeMint`)
- Modify: `webapp/lib/event-queries.ts` (`humaniseAction`)
- Test: `webapp/tests/player-store.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `webapp/tests/player-store.test.ts` (imports at top of file gain `auditLog` from `@/db/schema` and `eq` from `drizzle-orm`):

```ts
import { eq } from "drizzle-orm"

import { auditLog } from "@/db/schema"
```

```ts
describe("audit trail", () => {
  it("writes one player.scanned row per first scan", async () => {
    await recordScan({ eventId, wallet: WALLET_A, checkpointId: checkpointIds[0] })
    // Idempotent replay must NOT produce a second audit row.
    await recordScan({ eventId, wallet: WALLET_A, checkpointId: checkpointIds[0] })

    const rows = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.scanned"))
    expect(rows).toHaveLength(1)
    expect(rows[0].eventId).toBe(eventId)
    expect(rows[0].target).toBe(checkpointIds[0])
    const meta = rows[0].meta as { wallet?: string; checkpointName?: string }
    expect(meta.wallet).toBe(WALLET_A)
    expect(typeof meta.checkpointName).toBe("string")
  })

  it("writes one player.minted row per mint", async () => {
    for (const id of checkpointIds) {
      await recordScan({ eventId, wallet: WALLET_A, checkpointId: id })
    }
    await recordBadgeMint({
      eventId,
      wallet: WALLET_A,
      txHash: "0x" + "ab".repeat(32),
      tokenId: 1,
    })
    // Double-mint attempt: no second audit row.
    await recordBadgeMint({
      eventId,
      wallet: WALLET_A,
      txHash: "0x" + "cd".repeat(32),
      tokenId: 2,
    })

    const rows = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.action, "player.minted"))
    expect(rows).toHaveLength(1)
    const meta = rows[0].meta as { wallet?: string }
    expect(meta.wallet).toBe(WALLET_A)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/player-store.test.ts`
Expected: FAIL — both new tests find 0 rows.

- [ ] **Step 3: Implement in player-store**

In `webapp/lib/player-store.ts`:

Add `auditLog` to the schema import:

```ts
import {
  auditLog,
  badgeMints,
  checkpoints,
  events,
  players,
  scans,
  sponsors,
} from "@/db/schema"
```

Replace the insert inside `recordScan` so the audit row only fires when a row was actually inserted:

```ts
  const player = await ensurePlayer(opts.eventId, opts.wallet)
  const inserted = await storeDb
    .insert(scans)
    .values({
      playerId: player.id,
      checkpointId: opts.checkpointId,
    })
    .onConflictDoNothing({
      target: [scans.playerId, scans.checkpointId],
    })
    .returning({ id: scans.id })

  if (inserted.length > 0) {
    const [cp] = await storeDb
      .select({ name: checkpoints.name })
      .from(checkpoints)
      .where(eq(checkpoints.id, opts.checkpointId))
      .limit(1)
    await storeDb.insert(auditLog).values({
      eventId: opts.eventId,
      actor: player.wallet,
      action: "player.scanned",
      target: opts.checkpointId,
      meta: { wallet: player.wallet, checkpointName: cp?.name ?? null },
    })
  }
```

In `recordBadgeMint`, replace the try block:

```ts
  try {
    await storeDb.insert(badgeMints).values({
      playerId: player.id,
      txHash: opts.txHash,
      tokenId: opts.tokenId ?? null,
    })
    await storeDb.insert(auditLog).values({
      eventId: opts.eventId,
      actor: player.wallet,
      action: "player.minted",
      target: opts.txHash,
      meta: { wallet: player.wallet, tokenId: opts.tokenId ?? null },
    })
  } catch {
    // unique constraint hit → someone else recorded it first; reload.
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/player-store.test.ts`
Expected: PASS (all, including the pre-existing 20+).

- [ ] **Step 5: Humanise the new actions in the activity feed**

In `webapp/lib/event-queries.ts`, add an import and two switch cases in `humaniseAction`:

```ts
import { shortAddress } from "./format"
```

```ts
    case "player.scanned":
      return `${shortAddress(String(m.wallet ?? ""))} scanned “${m.checkpointName ?? "a checkpoint"}”`
    case "player.minted":
      return `${shortAddress(String(m.wallet ?? ""))} minted their finisher badge`
```

- [ ] **Step 6: Gates and commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run
git add lib/player-store.ts lib/event-queries.ts tests/player-store.test.ts
git commit -m "Write player scans and mints to the audit log"
```

---

### Task 5: The console refreshes itself

A demo dashboard that needs ⌘R is dead on stage. Add a small client component that calls `router.refresh()` on an interval while the tab is visible, and mount it on the overview and prize-desk pages.

**Files:**
- Create: `webapp/components/product/auto-refresh.tsx`
- Modify: `webapp/app/app/page.tsx`
- Modify: `webapp/app/app/prize-desk/page.tsx`

- [ ] **Step 1: Create the component**

Create `webapp/components/product/auto-refresh.tsx`:

```tsx
"use client"

import { useRouter } from "next/navigation"
import { useEffect } from "react"

/**
 * Re-fetches the page's server data on an interval while the tab is
 * visible. Server Components re-render with fresh queries; client
 * state (open menus, form input) is preserved by React.
 */
export function AutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter()

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh()
      }
    }, intervalMs)
    return () => clearInterval(id)
  }, [router, intervalMs])

  return null
}
```

- [ ] **Step 2: Mount on overview and prize desk**

In `webapp/app/app/page.tsx`, add the import and render it as the first child of `<ProductPage>`:

```tsx
import { AutoRefresh } from "@/components/product/auto-refresh"
```

```tsx
    <ProductPage>
      <AutoRefresh />
```

Same two lines in `webapp/app/app/prize-desk/page.tsx` (inside its `<ProductPage>`).

- [ ] **Step 3: Gates and commit**

Run: `npm run lint && npx tsc --noEmit && npm run build`
Expected: green. Manual check happens in Task 11's walkthrough (scan from a second browser; overview activity updates within 10s without reload).

```bash
git add components/product/auto-refresh.tsx app/app/page.tsx app/app/prize-desk/page.tsx
git commit -m "Auto-refresh overview and prize desk while visible"
```

---

### Task 6: Kiosk shows incoming scans and a join-QR

Booth staff need two things the kiosk doesn't give them: confirmation that a player's scan landed, and a zero-friction way to onboard passers-by. Recent scans render server-side and ride the same `AutoRefresh`; the QR encodes `<origin>/play`.

**Files:**
- Modify: `webapp/lib/event-queries.ts` (new query)
- Modify: `webapp/app/app/booth/[checkpointId]/page.tsx`
- Create: `webapp/app/app/booth/[checkpointId]/_components/join-qr.tsx`
- Modify: `webapp/package.json` (new deps)

- [ ] **Step 1: Install the QR dependency**

Run: `npm install qrcode && npm install -D @types/qrcode`
Expected: both land in `package.json` without peer warnings.

- [ ] **Step 2: Add the recent-scans query**

Append to `webapp/lib/event-queries.ts`:

```ts
/** Latest scans at one checkpoint, for the booth kiosk's confirmation feed. */
export async function listRecentScansForCheckpoint(
  checkpointId: string,
  limit = 6
): Promise<{ id: string; wallet: string; createdAt: Date }[]> {
  return db
    .select({
      id: scans.id,
      wallet: players.wallet,
      createdAt: scans.createdAt,
    })
    .from(scans)
    .innerJoin(players, eq(players.id, scans.playerId))
    .where(eq(scans.checkpointId, checkpointId))
    .orderBy(desc(scans.createdAt))
    .limit(limit)
}
```

- [ ] **Step 3: Create the join-QR component**

Create `webapp/app/app/booth/[checkpointId]/_components/join-qr.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

/**
 * "Scan to join" QR shown beside the rotating code. Encodes the play
 * landing on this deployment's origin, so it works on localhost, a
 * LAN IP during rehearsal, and production without configuration.
 */
export function JoinQr() {
  const [dataUrl, setDataUrl] = useState<string | null>(null)

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}/play`, {
      margin: 1,
      width: 220,
      color: { dark: "#f4f1fa", light: "#00000000" },
    }).then(setDataUrl)
  }, [])

  if (!dataUrl) return <div className="size-[220px]" aria-hidden />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={dataUrl}
      width={220}
      height={220}
      alt="QR code linking to the play surface"
    />
  )
}
```

- [ ] **Step 4: Rework the kiosk page layout**

Replace the body of `webapp/app/app/booth/[checkpointId]/page.tsx` after the `if (!row) notFound()` line (imports gain `AutoRefresh`, `listRecentScansForCheckpoint`, `shortAddress`, `timeAgo`, `JoinQr`):

```tsx
import { AutoRefresh } from "@/components/product/auto-refresh"
import { listRecentScansForCheckpoint } from "@/lib/event-queries"
import { shortAddress, timeAgo } from "@/lib/format"

import { JoinQr } from "./_components/join-qr"
```

```tsx
  const recentScans = await listRecentScansForCheckpoint(row.id)

  return (
    <div className="mx-auto grid max-w-4xl gap-8 px-6 pt-10 pb-16 lg:px-10">
      <AutoRefresh />
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
            {row.eventName}
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-tight">
            {row.name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {row.area ?? "—"}
          </p>
        </div>
        <Link
          href="/app/booth"
          className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          ← All checkpoints
        </Link>
      </header>

      {row.secret ? (
        <KioskScreen
          checkpointId={row.id}
          checkpointName={row.name}
          secret={row.secret}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-rose-400/40 bg-rose-500/10 p-8 text-center text-sm text-rose-200">
          This checkpoint has no TOTP secret configured. Open Routes →
          this checkpoint → Rotate secret to provision one.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <section className="rounded-xl border border-border bg-card/40 p-5">
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Recent scans here
          </p>
          {recentScans.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No scans yet. They appear within seconds of a player
              confirming the code.
            </p>
          ) : (
            <ul className="mt-2 grid divide-y divide-border">
              {recentScans.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <span className="font-mono text-sm">
                    {shortAddress(s.wallet)}
                  </span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {timeAgo(s.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {row.clue && (
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Clue shown to the player: {row.clue}
            </p>
          )}
        </section>

        <section className="grid place-items-center gap-3 rounded-xl border border-border bg-card/40 p-5">
          <JoinQr />
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            Scan to join the hunt
          </p>
        </section>
      </div>
    </div>
  )
```

- [ ] **Step 5: Gates and commit**

```bash
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
git add package.json package-lock.json lib/event-queries.ts "app/app/booth/[checkpointId]"
git commit -m "Kiosk shows incoming scans and a join QR"
```

---

### Task 7: Scan success reveals the next clue

The hand-off moment between checkpoints is the game's heartbeat. After a successful scan, hold for a beat and show where to go next instead of cutting straight to a redirect.

**Files:**
- Modify: `webapp/app/play/scan/page.tsx`

- [ ] **Step 1: Track the upcoming checkpoint and slow the redirect**

In `webapp/app/play/scan/page.tsx`:

After the `next` computation, add:

```ts
  // The stop after this one — revealed on success as the hand-off.
  const upcoming = checkpoints.find(
    (cp) => !scanned.has(cp.id) && cp.id !== next?.id
  )
```

In `submit()`, change the timeout from `800` to `1600`.

- [ ] **Step 2: Render the hand-off in the success state**

Replace the success copy paragraph inside the scanner card:

```tsx
          <div className="mt-6 grid gap-1 text-center">
            {success ? (
              <>
                <p className="text-sm font-medium text-emerald-300">
                  Checkpoint solved.
                </p>
                <p className="text-sm text-muted-foreground">
                  {upcoming
                    ? `Next stop: ${upcoming.name}${upcoming.area ? ` (${upcoming.area})` : ""}`
                    : "That was the last one. Time to mint."}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Ask the booth staff for the rotating 6-digit code on their
                screen, or tap the booth&apos;s NFC tag.
              </p>
            )}
          </div>
```

(The wrapping `<p className="mt-6 …">` is replaced by this `<div>`.)

- [ ] **Step 3: Gates and commit**

```bash
npm run lint && npx tsc --noEmit
git add app/play/scan/page.tsx
git commit -m "Reveal the next stop after a successful scan"
```

---

### Task 8: Demo seed — a floor that looks alive

Empty charts can't present power. `db:seed:demo` layers realistic activity on top of the base seed: ~120 players mid-loop, scans weighted across the last 8 hours, ~30 finishers with badge mints, a dozen redemptions, and fresh audit rows so the activity feed is full at demo start. Deterministic RNG so every reset looks the same.

**Files:**
- Create: `webapp/db/seed-demo.ts`
- Modify: `webapp/package.json` (script)

- [ ] **Step 1: Write the script**

Create `webapp/db/seed-demo.ts`:

```ts
/**
 * Demo overlay on top of `db:seed`: players, scans, mints, redemptions
 * and audit rows so the console presents a living event. Run AFTER
 * `npm run db:seed` (it wipes and recreates the event). Deterministic:
 * the same command always produces the same floor.
 *
 *   npm run db:seed && npm run db:seed:demo
 */

import { asc, eq } from "drizzle-orm"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"

import * as schema from "./schema"

// Mulberry32: tiny deterministic PRNG, seeded so demos are repeatable.
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260717)

function randomWallet(): string {
  const hex = "0123456789abcdef"
  let s = "0x"
  for (let i = 0; i < 40; i++) s += hex[Math.floor(rand() * 16)]
  // Mixed-case checksum isn't needed for demo rows; lowercase is valid.
  return s
}

function fakeTxHash(): string {
  const hex = "0123456789abcdef"
  let s = "0x"
  for (let i = 0; i < 64; i++) s += hex[Math.floor(rand() * 16)]
  return s
}

/** Busier around lunch and mid-afternoon, like a real venue. */
const HOUR_WEIGHTS = [0.4, 0.7, 1.0, 0.8, 1.2, 1.4, 1.1, 0.7]

function scanTimestamp(now: number): Date {
  const total = HOUR_WEIGHTS.reduce((a, b) => a + b, 0)
  let pick = rand() * total
  let hourSlot = 0
  for (let i = 0; i < HOUR_WEIGHTS.length; i++) {
    pick -= HOUR_WEIGHTS[i]
    if (pick <= 0) {
      hourSlot = i
      break
    }
  }
  // hourSlot 0 = oldest (8h ago), 7 = the current hour.
  const hoursAgo = HOUR_WEIGHTS.length - 1 - hourSlot
  const withinHour = rand() * 3_600_000
  return new Date(now - hoursAgo * 3_600_000 - withinHour)
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error("DATABASE_URL is required to run seed-demo.")
  const client = postgres(url, { max: 1, prepare: false })
  const db = drizzle(client, { schema, casing: "snake_case" })

  const [event] = await db
    .select()
    .from(schema.events)
    .where(eq(schema.events.slug, "eth-cluj-2026"))
    .limit(1)
  if (!event) {
    throw new Error("Run `npm run db:seed` first — pilot event not found.")
  }

  const checkpoints = await db
    .select()
    .from(schema.checkpoints)
    .where(eq(schema.checkpoints.eventId, event.id))
    .orderBy(asc(schema.checkpoints.orderIndex))
  const rewards = await db
    .select()
    .from(schema.rewards)
    .where(eq(schema.rewards.eventId, event.id))
  const now = Date.now()

  const PLAYER_COUNT = 120
  let totalScans = 0
  let finishers = 0
  let redemptions = 0
  const recentAudit: (typeof schema.auditLog.$inferInsert)[] = []

  for (let i = 0; i < PLAYER_COUNT; i++) {
    const wallet = randomWallet()
    // How far this player got: ~25% finish, the rest spread mid-loop.
    const roll = rand()
    const depth =
      roll < 0.25
        ? checkpoints.length
        : 1 + Math.floor(rand() * (checkpoints.length - 1))

    // Scans for this player, in route order, ascending in time.
    const times = Array.from({ length: depth }, () => scanTimestamp(now))
      .sort((a, b) => a.getTime() - b.getTime())
    const startedAt = new Date(times[0].getTime() - 5 * 60_000)
    const lastScanAt = times[times.length - 1]

    const [player] = await db
      .insert(schema.players)
      .values({ eventId: event.id, wallet, startedAt, lastScanAt })
      .returning()

    for (let d = 0; d < depth; d++) {
      await db.insert(schema.scans).values({
        playerId: player.id,
        checkpointId: checkpoints[d].id,
        createdAt: times[d],
      })
      totalScans++
    }
    // Keep the feed fresh: audit the most recent handful of scans.
    if (now - lastScanAt.getTime() < 30 * 60_000 && recentAudit.length < 14) {
      recentAudit.push({
        eventId: event.id,
        actor: wallet,
        action: "player.scanned",
        target: checkpoints[depth - 1].id,
        meta: { wallet, checkpointName: checkpoints[depth - 1].name },
        createdAt: lastScanAt,
      })
    }

    if (depth === checkpoints.length) {
      finishers++
      const mintedAt = new Date(lastScanAt.getTime() + 4 * 60_000)
      const txHash = fakeTxHash()
      await db.insert(schema.badgeMints).values({
        playerId: player.id,
        txHash,
        tokenId: finishers,
        mintedAt,
      })
      recentAudit.push({
        eventId: event.id,
        actor: wallet,
        action: "player.minted",
        target: txHash,
        meta: { wallet, tokenId: finishers },
        createdAt: mintedAt,
      })

      // Roughly 40% of finishers already redeemed something physical.
      if (rand() < 0.4 && rewards.length > 1) {
        const reward = rewards[1 + Math.floor(rand() * (rewards.length - 1))]
        await db.insert(schema.redemptionClaims).values({
          playerId: player.id,
          rewardId: reward.id,
          staffUserId: "user_demo_prize_desk",
          claimedAt: new Date(mintedAt.getTime() + 10 * 60_000),
        })
        await db
          .update(schema.rewards)
          .set({ stockClaimed: (reward.stockClaimed ?? 0) + 1 })
          .where(eq(schema.rewards.id, reward.id))
        reward.stockClaimed = (reward.stockClaimed ?? 0) + 1
        redemptions++
      }
    }
  }

  if (recentAudit.length > 0) {
    await db.insert(schema.auditLog).values(recentAudit)
  }

  console.log(
    `[seed-demo] ${PLAYER_COUNT} players, ${totalScans} scans, ` +
      `${finishers} finishers, ${redemptions} redemptions`
  )
  await client.end({ timeout: 1 })
  console.log("[done]")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

> Note: demo badge mints use fake tx hashes. The prize-desk verifier
> checks the chain and will honestly report "No badge on chain" for
> these wallets — that is correct behavior. The live demo's redemption
> beat uses the real wallet that actually minted in Task 9.

- [ ] **Step 2: Add the npm script**

In `webapp/package.json` scripts, after `"db:seed"`:

```json
    "db:seed:demo": "tsx db/seed-demo.ts",
```

- [ ] **Step 3: Run and verify**

```bash
npm run db:seed && npm run db:seed:demo
docker exec treasureloop-postgres-1 psql -U postgres -d treasureloop \
  -c "select count(*) from players;" \
  -c "select count(*) from scans;" \
  -c "select count(*) from badge_mints;" \
  -c "select action, count(*) from audit_log group by 1;"
```

Expected: 120 players, several hundred scans, ~30 badge_mints, audit rows including `player.scanned` and `player.minted`. Re-running the pair of commands produces identical counts (deterministic).

- [ ] **Step 4: Gates and commit**

```bash
npx tsc --noEmit && npm run lint
git add db/seed-demo.ts package.json
git commit -m "Add deterministic demo seed with live floor activity"
```

---

### Task 9: Deploy TreasureLoopBadge to Base Sepolia and wire the env

This task is operational: shell commands, two keys, a faucet, and env wiring. Everything downstream (claim page, prize desk, preflight, health) already reads these env vars and lights up on its own. Work from `contracts/` then `webapp/`.

**Files:**
- Modify: `webapp/.env.local` (never committed)
- No source changes.

- [ ] **Step 1: Confirm the contract suite is green**

```bash
cd ../contracts && forge test
```

Expected: 15 tests pass.

- [ ] **Step 2: Generate the two keys**

```bash
cast wallet new   # → DEPLOYER (owner): fund this one
cast wallet new   # → SIGNER: stays in the webapp env, never funded
```

Record both addresses + private keys somewhere safe (password manager, not the repo). Fund the deployer with Base Sepolia ETH from a faucet (Coinbase faucet or Alchemy faucet; 0.05 ETH is plenty).

- [ ] **Step 3: Deploy**

The metadata endpoint (Task 1) is the base URI. For a localhost-only rehearsal, deploy with the production URL anyway (or a tunnel URL) — `setBaseURI` can re-point it later.

```bash
export BASE_SEPOLIA_RPC="https://sepolia.base.org"
export DEPLOYER_KEY="0x<deployer-private-key>"
export BADGE_OWNER="0x<deployer-address>"
export BADGE_SIGNER="0x<signer-address>"
export BADGE_BASE_URI="https://<your-deployment-host>/api/badge-metadata/"

forge script script/Deploy.s.sol \
  --rpc-url "$BASE_SEPOLIA_RPC" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast
```

Expected output: `TreasureLoopBadge deployed at: 0x…`. Record the address. Optional Basescan verification (nice for the demo's "view tx" beat):

```bash
forge verify-contract <deployed-address> src/TreasureLoopBadge.sol:TreasureLoopBadge \
  --chain base-sepolia \
  --constructor-args $(cast abi-encode "constructor(address,address,string)" "$BADGE_OWNER" "$BADGE_SIGNER" "$BADGE_BASE_URI") \
  --etherscan-api-key "$ETHERSCAN_API_KEY"
```

- [ ] **Step 4: Wire the webapp env**

Append to `webapp/.env.local`:

```bash
NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS=0x<deployed-address>
BADGE_SIGNER_PRIVATE_KEY=0x<signer-private-key>
PLAY_SESSION_SECRET=<32+ random chars: openssl rand -hex 32>
```

Then re-point the event row at the contract and rebuild:

```bash
cd ../webapp
npm run db:seed && npm run db:seed:demo
npm run build && npm run start -- --port 3010
```

- [ ] **Step 5: Verify the wiring end-to-end**

```bash
curl -s http://localhost:3010/api/health | python3 -m json.tool
```

Expected: `badge_contract.ok: true` and `badge_signer.ok: true`.

In a browser, sign in as the organizer → `/app/preflight`: the contract and signer checks are green.

- [ ] **Step 6: Live mint walkthrough (the money shot, rehearse it now)**

1. Phone or second browser profile with a test wallet on Base Sepolia (needs a sliver of faucet ETH for mint gas).
2. `/play` → connect → SIWE sign-in.
3. `/app/booth/<each checkpoint>` in another tab; type each rotating code into `/play/scan` until the loop closes.
4. `/play/claim` → Mint → confirm in wallet → expect "Token #N · Confirmed on chain · view tx" with a working Basescan link.
5. `curl -s http://localhost:3010/api/badge-metadata/<N>` returns the badge JSON; the SVG renders if you paste the data URI into a browser tab.
6. `/app/prize-desk` → paste the wallet → expect the green **Eligible** verdict ("Checked on chain") → redeem a reward → it appears in Recent redemptions, and in `/app`'s activity feed within 10s.

If any beat fails, fix before proceeding — this walkthrough IS the milestone.

---

### Task 10: DEMO.md — the runbook that makes the demo repeatable

**Files:**
- Create: `DEMO.md` (repo root)

- [ ] **Step 1: Write the runbook**

Create `DEMO.md` at the repo root:

```markdown
# TreasureLoop Demo Runbook

A scripted ~10-minute walkthrough that shows the full loop with nothing
faked. Reset time between demos: under a minute.

## One-time setup

1. `docker compose up -d` (repo root) — Postgres 16 on :5433.
2. `cd webapp && npm install`.
3. `.env.local` needs: `DATABASE_URL`, Clerk keys, and the on-chain trio
   (`NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS`, `BADGE_SIGNER_PRIVATE_KEY`,
   `PLAY_SESSION_SECRET`). The contract deploy procedure lives in
   `docs/superpowers/plans/2026-06-10-demo-ready-milestone.md`, Task 9.
4. Clerk dashboard: one organization for the event, with test users in
   each role: organizer, booth_staff (assigned to a checkpoint via
   /app/team + the routes editor), prize_desk.
5. A test wallet (e.g. MetaMask profile) holding a little Base Sepolia
   ETH for the mint gas.

## Reset before every demo

    cd webapp
    npm run db:seed && npm run db:seed:demo
    npm run build && npm run start -- --port 3010

Seeding wipes the pilot event and rebuilds a busy floor: 120 players,
~30 finishers, fresh activity. TOTP secrets rotate on reseed, so booth
tabs opened before the reset show stale codes; reopen them.

## The 10-minute script

| Beat | Surface | What to show |
|---|---|---|
| 1. The floor is alive | `/app` (organizer) | KPIs, hourly traffic, activity feed ticking on its own |
| 2. Go / no-go | `/app/preflight` | every check green, including contract + signer |
| 3. The booth | `/app/booth/<cp>` (tablet) | giant rotating code, join-QR, empty "recent scans" |
| 4. A player joins | phone: scan the kiosk QR | `/play` → connect wallet → SIWE, no app install |
| 5. The hunt | `/play/scan` × 5 | type each booth's live code; success reveals the next clue; the kiosk's "recent scans" list catches each one |
| 6. The mint | `/play/claim` | real ERC-721 on Base Sepolia; "Token #N · view tx" opens Basescan |
| 7. The prize desk | `/app/prize-desk` | paste the wallet → green ELIGIBLE verdict, verified on chain → redeem |
| 8. Full circle | `/app` | the scan/mint/redemption all visible in the live feed |

## Fallback modes

- **Chain down / no faucet ETH:** remove
  `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` from env and restart. The claim
  page states the contract isn't configured; the prize desk verdict
  panel says "Contract not configured; DB only" and redeems against the
  database record. Demo still lands, minus the Basescan beat.
- **No second device:** run the player flow in a second browser
  profile; the kiosk QR beat becomes "this QR is what attendees scan".
- **Demo-seed wallets at the prize desk:** seeded finishers minted with
  fake tx hashes, so the verifier honestly reports "No badge on chain"
  for them. Always use the wallet that really minted in beat 6.
```

- [ ] **Step 2: Commit**

```bash
git add ../DEMO.md
git commit -m "Add demo runbook"
```

---

### Task 11: Full verification pass

**Files:** none (verification only) — plus refreshed screenshots at repo root.

- [ ] **Step 1: All gates**

```bash
cd webapp
npm run lint && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: lint clean, tsc clean, 110+ tests pass (105 existing + Tasks 1 and 4), build succeeds.

- [ ] **Step 2: Liveness check without reloads**

With the server on :3010 and the demo seed loaded: open `/app` signed in as organizer, and in a second browser complete one real scan via `/play/scan` (booth code from `/app/booth/<cp>`). Expected within 10 seconds, with no manual reload: the overview activity feed shows "0x… scanned …", and the booth kiosk's recent-scans list shows the wallet.

- [ ] **Step 3: Screenshots**

```bash
npx playwright screenshot --viewport-size=390,1200 http://localhost:3010/play ../treasureloop-play-landing.png
npx playwright screenshot --viewport-size=390,1200 --wait-for-timeout=3000 http://localhost:3010/play/scan ../treasureloop-play-scan.png
```

Inspect both visually before committing. Console pages are Clerk-gated; capture them manually while signed in if updated evidence is wanted.

- [ ] **Step 4: Update ROADMAP.md and commit**

Mark in `ROADMAP.md`: Phase 4 rows for deploy/verify and the metadata endpoint as `[x]` (KMS remains pending), and note the demo seed + runbook under Phase 11. Commit:

```bash
git add ../ROADMAP.md ../treasureloop-play-landing.png ../treasureloop-play-scan.png
git commit -m "Mark demo-ready milestone progress in roadmap"
```

---

## Self-review notes

- **Coverage vs. the milestone:** chain-real (Tasks 1, 2, 3, 9), alive-during-play (Tasks 4, 5, 6, 7), repeatable demo (Tasks 8, 10), proof (Task 11). The four demo roles each have their beat: organizer (5, 8), booth staff (6), player (1, 3, 7, 9), prize desk (5, 9).
- **Order matters:** Task 1 before 9 (baseURI target must exist); Task 2 before 9 (reseed keeps the contract address); Task 4 before 8 (demo seed writes the same audit actions the live path writes).
- **Deliberately out of scope** (post-milestone, per ROADMAP): KV-backed rate limits, NFC HMAC URLs, pair fragments, sponsor lead consent, Sentry, KMS for the signer key, camera-based QR scanning at the prize desk.
- **Type consistency checked:** `getPublicEvent`/`currentEventId` (player-store) are used by Task 1's route exactly as exported today; `confirmMint` extension matches the existing mint-confirm API contract; audit meta shape (`wallet`, `checkpointName`) is identical in Task 4 (live path) and Task 8 (seed).
