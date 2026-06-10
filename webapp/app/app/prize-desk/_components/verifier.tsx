"use client"

import { useCallback, useState, useTransition } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  HistoryIcon,
  Loader2Icon,
  PackageIcon,
  PrinterIcon,
  ScanLineIcon,
  WalletIcon,
  WifiOffIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lookupWallet, redeemReward } from "@/app/app/prize-desk/_actions"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/utils"

interface RewardView {
  id: string
  name: string
  description: string | null
  stockClaimed: number
  stockTotal: number | null
  eligible: boolean
  reason: string
  alreadyClaimed: boolean
}

interface PriorClaimView {
  rewardId: string
  rewardName: string
  /** ISO string — Dates don't survive localStorage round-trips. */
  claimedAt: string
}

interface LookupSnapshot {
  wallet: string
  hasPlayer: boolean
  onchainConfigured: boolean
  holdsBadge: boolean
  rewards: RewardView[]
  priorClaims: PriorClaimView[]
  /** Set when this snapshot was served from the offline cache. */
  cachedAt?: number
}

interface Receipt {
  reward: string
  wallet: string
  claimedAt: string
  staff: string | null
}

type Verdict = "eligible" | "no-badge" | "no-player"

function verdictOf(snap: LookupSnapshot): Verdict {
  if (!snap.hasPlayer) return "no-player"
  if (snap.onchainConfigured && !snap.holdsBadge) return "no-badge"
  return "eligible"
}

const verdictMeta: Record<
  Verdict,
  {
    label: string
    detail: string
    tone: string
    Icon: typeof CheckCircle2Icon
  }
> = {
  eligible: {
    label: "Eligible",
    detail: "Hand out the reward and redeem it below.",
    tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    Icon: CheckCircle2Icon,
  },
  "no-badge": {
    label: "No badge on chain",
    detail:
      "The wallet played but doesn't hold a finisher badge. Ask them to mint at /play/claim first.",
    tone: "border-amber-400/40 bg-amber-500/10 text-amber-200",
    Icon: AlertTriangleIcon,
  },
  "no-player": {
    label: "Hasn't played",
    detail: "No player record for this wallet at this event.",
    tone: "border-rose-400/40 bg-rose-500/10 text-rose-200",
    Icon: CircleSlashIcon,
  },
}

const CACHE_KEY = "prizedesk.lookups.v1"
const CACHE_LIMIT = 10

type CacheMap = Record<string, LookupSnapshot>

function readCache(): CacheMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CacheMap) : {}
  } catch {
    return {}
  }
}

/** Store the snapshot keyed by lowercased wallet, capped at N entries. */
function writeCache(snap: LookupSnapshot) {
  if (typeof window === "undefined") return
  try {
    const cache = readCache()
    // Drop any prior entry so re-inserting moves it to the most-recent end.
    delete cache[snap.wallet.toLowerCase()]
    const stored: LookupSnapshot = { ...snap, cachedAt: Date.now() }
    const next: CacheMap = { ...cache, [snap.wallet.toLowerCase()]: stored }
    const keys = Object.keys(next)
    if (keys.length > CACHE_LIMIT) {
      // Evict oldest by cachedAt.
      const sorted = keys.sort(
        (a, b) => (next[a].cachedAt ?? 0) - (next[b].cachedAt ?? 0)
      )
      for (const k of sorted.slice(0, keys.length - CACHE_LIMIT)) {
        delete next[k]
      }
    }
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    // localStorage full / disabled — caching is best-effort, never fatal.
  }
}

function lookupCache(wallet: string): LookupSnapshot | null {
  return readCache()[wallet.toLowerCase()] ?? null
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function PrizeDeskVerifier({
  initialAddress,
  eventName,
}: {
  initialAddress?: string | null
  eventName: string
}) {
  const [input, setInput] = useState<string>(initialAddress ?? "")
  const [snapshot, setSnapshot] = useState<LookupSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null)
  const [verifying, startVerify] = useTransition()
  const [redeemingId, setRedeemingId] = useState<string | null>(null)
  const [dupAcknowledged, setDupAcknowledged] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const verify = useCallback(() => {
    const wallet = input.trim()
    if (!wallet) {
      setError("Enter a wallet address or scan one.")
      return
    }
    setError(null)
    setRedeemMessage(null)
    setReceipt(null)
    setDupAcknowledged(false)
    setSnapshot(null)
    startVerify(async () => {
      try {
        const res = await lookupWallet({ walletAddress: wallet })
        if (!res.ok) {
          setError(
            res.error === "bad-address"
              ? "That doesn't look like a wallet address."
              : res.error === "forbidden"
                ? "You don't have access to verify here."
                : "Could not verify wallet."
          )
          return
        }
        const fresh: LookupSnapshot = {
          wallet: res.wallet,
          hasPlayer: !!res.player,
          onchainConfigured: res.onchain.configured,
          holdsBadge: res.onchain.holdsBadge,
          rewards: res.rewards,
          priorClaims: res.priorClaims.map((c) => ({
            rewardId: c.rewardId,
            rewardName: c.rewardName,
            claimedAt:
              typeof c.claimedAt === "string"
                ? c.claimedAt
                : new Date(c.claimedAt).toISOString(),
          })),
        }
        writeCache(fresh)
        setSnapshot(fresh)
      } catch {
        // RPC / network down: fall back to the cached lookup so the queue
        // keeps moving. Clearly marked as stale below.
        const cached = lookupCache(wallet)
        if (cached) {
          setSnapshot(cached)
          setError(null)
        } else {
          setError(
            "Lookup failed and no cached result for this wallet. Check the connection and retry."
          )
        }
      }
    })
  }, [input])

  const redeem = useCallback(
    (rewardId: string) => {
      if (!snapshot) return
      setRedeemingId(rewardId)
      setRedeemMessage(null)
      ;(async () => {
        try {
          const res = await redeemReward({
            rewardId,
            walletAddress: snapshot.wallet,
          })
          if (!res.ok) {
            setRedeemMessage(res.message)
          } else {
            setRedeemMessage(`Handed out ${res.rewardName}.`)
            setReceipt({
              reward: res.rewardName,
              wallet: snapshot.wallet,
              claimedAt: res.claimedAt,
              staff: res.staffUserId,
            })
            setSnapshot((prev) =>
              prev
                ? {
                    ...prev,
                    rewards: prev.rewards.map((r) =>
                      r.id === rewardId
                        ? {
                            ...r,
                            alreadyClaimed: true,
                            stockClaimed: r.stockClaimed + 1,
                          }
                        : r
                    ),
                    priorClaims: [
                      ...prev.priorClaims,
                      {
                        rewardId,
                        rewardName: res.rewardName,
                        claimedAt: res.claimedAt,
                      },
                    ],
                  }
                : prev
            )
          }
        } catch {
          setRedeemMessage(
            "Redemption failed to reach the server. Do not hand out yet — retry when back online."
          )
        } finally {
          setRedeemingId(null)
        }
      })()
    },
    [snapshot]
  )

  const verdict = snapshot ? verdictOf(snapshot) : null
  const isStale = !!snapshot?.cachedAt
  // A wallet that has redeemed *anything* before is flagged; staff must
  // acknowledge before the redeem buttons activate.
  const hasPriorClaims = (snapshot?.priorClaims.length ?? 0) > 0
  const ackGateOpen = !hasPriorClaims || dupAcknowledged

  return (
    <section className="grid gap-6">
      <div className="print:hidden">
        <div className="mb-3">
          <h2 className="text-sm font-medium">Scan or enter badge</h2>
          <p className="text-xs text-muted-foreground">
            Wallet address (0x…) or paste from a QR scan
          </p>
        </div>
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            verify()
          }}
        >
          <div className="relative flex-1">
            <ScanLineIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value.trim())}
              autoComplete="off"
              spellCheck={false}
              aria-label="Wallet address to verify"
              className="h-10 pl-9 font-mono text-sm tracking-[0.04em]"
              placeholder="0x…"
            />
          </div>
          <Button type="submit" className="h-10 px-5" disabled={verifying}>
            {verifying ? (
              <>
                <Loader2Icon className="mr-1.5 size-4 animate-spin" />
                Verifying…
              </>
            ) : (
              "Verify"
            )}
          </Button>
        </form>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ScanLineIcon className="size-3" /> NFC / QR
          </span>
          <span className="flex items-center gap-1.5">
            <WalletIcon className="size-3" /> Wallet address
          </span>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 print:hidden"
        >
          <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {snapshot && verdict && (
        <div role="status" className="grid gap-5 print:hidden">
          {isStale && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <WifiOffIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Showing a cached result — the live check didn&apos;t reach the
                chain.{" "}
                {snapshot.cachedAt
                  ? `Cached ${formatDate(new Date(snapshot.cachedAt).toISOString())}. `
                  : ""}
                May be stale; reverify when the connection is back.
              </p>
            </div>
          )}

          <VerdictPanel
            verdict={verdict}
            wallet={snapshot.wallet}
            onchainConfigured={snapshot.onchainConfigured}
          />

          {hasPriorClaims && (
            <DuplicateFlag
              claims={snapshot.priorClaims}
              acknowledged={dupAcknowledged}
              onAcknowledge={setDupAcknowledged}
            />
          )}

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Reward tier</p>
            <ul className="grid divide-y divide-border border-y border-border">
              {snapshot.rewards.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  No rewards configured for this event.
                </li>
              )}
              {snapshot.rewards.map((r, i) => {
                const depleted =
                  r.stockTotal !== null && r.stockClaimed >= r.stockTotal
                const disabled =
                  depleted ||
                  r.alreadyClaimed ||
                  !r.eligible ||
                  verdict !== "eligible" ||
                  !ackGateOpen
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <PackageIcon
                        className={cn(
                          "mt-0.5 size-4",
                          r.eligible && i === 0
                            ? "text-primary"
                            : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.alreadyClaimed
                            ? "Already claimed by this wallet."
                            : depleted
                              ? "Out of stock."
                              : !r.eligible
                                ? r.reason
                                : r.stockTotal !== null
                                  ? `${r.stockClaimed} of ${r.stockTotal} claimed · ${r.reason}`
                                  : r.reason}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={r.eligible && i === 0 ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={disabled || redeemingId === r.id}
                      onClick={() => redeem(r.id)}
                    >
                      {redeemingId === r.id ? (
                        <Loader2Icon className="size-3 animate-spin" />
                      ) : !r.eligible ? (
                        "Not eligible"
                      ) : i === 0 ? (
                        "Hand out & redeem"
                      ) : (
                        "Redeem"
                      )}
                    </Button>
                  </li>
                )
              })}
            </ul>
            {redeemMessage && (
              <p role="status" className="mt-3 text-xs text-muted-foreground">
                {redeemMessage}
              </p>
            )}
            {receipt && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs"
                onClick={() => window.print()}
              >
                <PrinterIcon className="mr-1.5 size-3.5" />
                Print receipt
              </Button>
            )}
          </div>
        </div>
      )}

      {receipt && <ReceiptCard receipt={receipt} eventName={eventName} />}
    </section>
  )
}

/**
 * Calm, operational flag for a wallet that already redeemed something.
 * Not alarming — informs the staffer and gates the redeem buttons behind
 * a single acknowledgement tick.
 */
function DuplicateFlag({
  claims,
  acknowledged,
  onAcknowledge,
}: {
  claims: PriorClaimView[]
  acknowledged: boolean
  onAcknowledge: (v: boolean) => void
}) {
  return (
    <div className="rounded-lg border border-amber-400/30 bg-amber-500/[0.06] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <HistoryIcon className="mt-0.5 size-4 shrink-0 text-amber-300" />
        <div className="grid gap-1.5">
          <p className="text-sm font-medium text-amber-100">
            This wallet has redeemed before
          </p>
          <ul className="grid gap-0.5 text-xs text-amber-200/90">
            {claims.map((c) => (
              <li key={`${c.rewardId}-${c.claimedAt}`}>
                Redeemed {c.rewardName} on {formatDate(c.claimedAt)}
              </li>
            ))}
          </ul>
          <label className="mt-1 flex cursor-pointer items-center gap-2 text-xs text-amber-100">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(e) => onAcknowledge(e.target.checked)}
              className="size-3.5 accent-amber-400"
            />
            I&apos;ve checked this and it&apos;s fine to continue
          </label>
        </div>
      </div>
    </div>
  )
}

/**
 * The glanceable answer. Prize-desk staff read this from arm's length
 * with a queue watching, so the verdict is large and color-coded.
 */
function VerdictPanel({
  verdict,
  wallet,
  onchainConfigured,
}: {
  verdict: Verdict
  wallet: string
  onchainConfigured: boolean
}) {
  const meta = verdictMeta[verdict]
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border px-5 py-4",
        meta.tone
      )}
    >
      <div className="flex items-center gap-4">
        <meta.Icon className="size-7 shrink-0" />
        <div>
          <p className="text-xl font-medium tracking-tight">{meta.label}</p>
          <p className="mt-0.5 text-xs opacity-80">{meta.detail}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="font-mono text-sm tracking-[0.04em]">
          {shortAddress(wallet)}
        </p>
        <p className="mt-0.5 text-[11px] opacity-70">
          {onchainConfigured
            ? "Checked on chain"
            : "Contract not configured; DB only"}
        </p>
      </div>
    </div>
  )
}

/**
 * Printable hand-out receipt. Hidden on screen except as the print
 * affordance; the `@media print` rules in globals.css promote it to the
 * full page so a browser "Print" produces a clean ticket.
 */
function ReceiptCard({
  receipt,
  eventName,
}: {
  receipt: Receipt
  eventName: string
}) {
  return (
    <div
      data-prize-receipt
      className="hidden border border-border p-6 print:block print:border-black print:text-black"
    >
      <p className="text-[11px] tracking-[0.2em] text-muted-foreground uppercase print:text-black">
        Prize desk receipt
      </p>
      <p className="mt-1 text-lg font-medium">{eventName}</p>
      <dl className="mt-4 grid gap-2 text-sm">
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground print:text-black">Reward</dt>
          <dd className="font-medium">{receipt.reward}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground print:text-black">Wallet</dt>
          <dd className="font-mono">{shortAddress(receipt.wallet)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground print:text-black">Time</dt>
          <dd>{formatDate(receipt.claimedAt)}</dd>
        </div>
        <div className="flex justify-between gap-6">
          <dt className="text-muted-foreground print:text-black">Staff</dt>
          <dd className="font-mono">{receipt.staff ?? "—"}</dd>
        </div>
      </dl>
      <p className="mt-5 border-t border-border pt-3 text-[11px] text-muted-foreground print:border-black print:text-black">
        Keep this slip. One reward per wallet per tier.
      </p>
    </div>
  )
}
