"use client"

import { useCallback, useState, useTransition } from "react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  PackageIcon,
  ScanLineIcon,
  WalletIcon,
  XCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { lookupWallet, redeemReward } from "@/app/app/prize-desk/_actions"
import { cn } from "@/lib/utils"

interface LookupSnapshot {
  wallet: string
  hasPlayer: boolean
  onchainConfigured: boolean
  holdsBadge: boolean
  hasMintedFlag: boolean
  rewards: Array<{
    id: string
    name: string
    description: string | null
    stockClaimed: number
    stockTotal: number | null
    alreadyClaimed: boolean
  }>
}

type FeedbackKind = "ok" | "warn" | "err"

interface Feedback {
  kind: FeedbackKind
  text: string
}

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function PrizeDeskVerifier({
  initialAddress,
}: {
  initialAddress?: string | null
}) {
  const [input, setInput] = useState<string>(initialAddress ?? "")
  const [snapshot, setSnapshot] = useState<LookupSnapshot | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [verifying, startVerify] = useTransition()
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const verify = useCallback(() => {
    const wallet = input.trim()
    if (!wallet) {
      setFeedback({ kind: "err", text: "Enter a wallet address or scan one." })
      return
    }
    setFeedback(null)
    setSnapshot(null)
    startVerify(async () => {
      const res = await lookupWallet({ walletAddress: wallet })
      if (!res.ok) {
        setFeedback({
          kind: "err",
          text:
            res.error === "bad-address"
              ? "That doesn't look like a wallet address."
              : res.error === "forbidden"
                ? "You don't have access to verify here."
                : "Could not verify wallet.",
        })
        return
      }
      const snap: LookupSnapshot = {
        wallet: res.wallet,
        hasPlayer: !!res.player,
        onchainConfigured: res.onchain.configured,
        holdsBadge: res.onchain.holdsBadge,
        hasMintedFlag: res.onchain.hasMintedFlag,
        rewards: res.availableRewards.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          stockClaimed: r.stockClaimed,
          stockTotal: r.stockTotal,
          alreadyClaimed: res.claimedRewardIds.has(r.id),
        })),
      }
      setSnapshot(snap)
      if (!snap.hasPlayer) {
        setFeedback({
          kind: "warn",
          text: "No player record. The wallet hasn't started a loop here.",
        })
      } else if (snap.onchainConfigured && !snap.holdsBadge) {
        setFeedback({
          kind: "warn",
          text: "Wallet doesn't currently hold a finisher badge.",
        })
      } else {
        setFeedback({ kind: "ok", text: "Eligible." })
      }
    })
  }, [input])

  const redeem = useCallback(
    (rewardId: string) => {
      if (!snapshot) return
      setRedeemingId(rewardId)
      ;(async () => {
        try {
          const res = await redeemReward({
            rewardId,
            walletAddress: snapshot.wallet,
          })
          if (!res.ok) {
            setFeedback({ kind: "err", text: res.message })
          } else {
            setFeedback({
              kind: "ok",
              text: `Handed out ${res.rewardName}.`,
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

      {feedback && (
        <div
          className={cn(
            "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs",
            feedback.kind === "ok" &&
              "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
            feedback.kind === "warn" &&
              "border-amber-400/30 bg-amber-500/10 text-amber-200",
            feedback.kind === "err" &&
              "border-rose-400/30 bg-rose-500/10 text-rose-200"
          )}
        >
          {feedback.kind === "ok" ? (
            <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" />
          ) : feedback.kind === "warn" ? (
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
          ) : (
            <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />
          )}
          <p>{feedback.text}</p>
        </div>
      )}

      {snapshot && (
        <div className="grid gap-5">
          <div className="grid gap-3 border-b border-border pb-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Wallet</p>
                <p className="font-mono text-base tracking-[0.04em]">
                  {shortAddress(snapshot.wallet)}
                </p>
              </div>
              <span
                className={cn(
                  "flex items-center gap-1.5 text-xs",
                  snapshot.holdsBadge || !snapshot.onchainConfigured
                    ? "text-emerald-400/90"
                    : "text-amber-300/90"
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    snapshot.holdsBadge || !snapshot.onchainConfigured
                      ? "bg-emerald-400"
                      : "bg-amber-400"
                  )}
                />
                {snapshot.holdsBadge
                  ? "Holds finisher badge"
                  : snapshot.onchainConfigured
                    ? "No badge on chain"
                    : "Contract not configured"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              {snapshot.hasPlayer
                ? "Player record found for this event."
                : "No player record — wallet hasn't played this event."}
            </p>
          </div>

          <div>
            <p className="mb-2 text-xs text-muted-foreground">Reward tier</p>
            <ul className="grid divide-y divide-border border-y border-border">
              {snapshot.rewards.map((r, i) => {
                const depleted =
                  r.stockTotal !== null && r.stockClaimed >= r.stockTotal
                const disabled =
                  depleted ||
                  r.alreadyClaimed ||
                  (!snapshot.holdsBadge && snapshot.onchainConfigured)
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
          </div>
        </div>
      )}
    </section>
  )
}
