"use client"

import { useCallback, useState, useTransition } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  CircleSlashIcon,
  Loader2Icon,
  PackageIcon,
  ScanLineIcon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lookupWallet, redeemReward } from "@/app/app/prize-desk/_actions"
import { shortAddress } from "@/lib/format"
import { cn } from "@/lib/utils"

interface LookupSnapshot {
  wallet: string
  hasPlayer: boolean
  onchainConfigured: boolean
  holdsBadge: boolean
  rewards: Array<{
    id: string
    name: string
    description: string | null
    stockClaimed: number
    stockTotal: number | null
    alreadyClaimed: boolean
  }>
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

export function PrizeDeskVerifier({
  initialAddress,
}: {
  initialAddress?: string | null
}) {
  const [input, setInput] = useState<string>(initialAddress ?? "")
  const [snapshot, setSnapshot] = useState<LookupSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null)
  const [verifying, startVerify] = useTransition()
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const verify = useCallback(() => {
    const wallet = input.trim()
    if (!wallet) {
      setError("Enter a wallet address or scan one.")
      return
    }
    setError(null)
    setRedeemMessage(null)
    setSnapshot(null)
    startVerify(async () => {
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
      setSnapshot({
        wallet: res.wallet,
        hasPlayer: !!res.player,
        onchainConfigured: res.onchain.configured,
        holdsBadge: res.onchain.holdsBadge,
        rewards: res.availableRewards.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          stockClaimed: r.stockClaimed,
          stockTotal: r.stockTotal,
          alreadyClaimed: res.claimedRewardIds.has(r.id),
        })),
      })
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
                  }
                : prev
            )
          }
        } finally {
          setRedeemingId(null)
        }
      })()
    },
    [snapshot]
  )

  const verdict = snapshot ? verdictOf(snapshot) : null

  return (
    <section className="grid gap-6">
      <div>
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
        <div className="flex items-start gap-2.5 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {snapshot && verdict && (
        <div className="grid gap-5">
          <VerdictPanel
            verdict={verdict}
            wallet={snapshot.wallet}
            onchainConfigured={snapshot.onchainConfigured}
          />

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
                  depleted || r.alreadyClaimed || verdict !== "eligible"
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex items-start gap-3">
                      <PackageIcon
                        className={cn(
                          "mt-0.5 size-4",
                          i === 0 ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.alreadyClaimed
                            ? "Already claimed by this wallet."
                            : depleted
                              ? "Out of stock."
                              : r.stockTotal !== null
                                ? `${r.stockClaimed} of ${r.stockTotal} claimed`
                                : "Unlimited"}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant={i === 0 ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      disabled={disabled || redeemingId === r.id}
                      onClick={() => redeem(r.id)}
                    >
                      {redeemingId === r.id ? (
                        <Loader2Icon className="size-3 animate-spin" />
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
              <p className="mt-3 text-xs text-muted-foreground">
                {redeemMessage}
              </p>
            )}
          </div>
        </div>
      )}
    </section>
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
            : "Contract not configured — DB only"}
        </p>
      </div>
    </div>
  )
}
