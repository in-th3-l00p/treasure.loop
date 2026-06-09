import {
  AlertTriangleIcon,
  CheckIcon,
  ScanLineIcon,
  WalletIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import {
  getActiveEvent,
  listRecentRedemptions,
  listRewards,
  listVerificationQueue,
} from "@/lib/event-queries"
import { cn } from "@/lib/utils"

function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function timeAgo(ms: number): string {
  const mins = Math.max(1, Math.round((Date.now() - ms) / 60_000))
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  return `${hrs}h ago`
}

export default async function PrizeDeskPage() {
  await requireRoles([ROLES.ORGANIZER, ROLES.PRIZE_DESK])
  const event = await getActiveEvent()
  if (!event) {
    return (
      <div className="mx-auto max-w-md px-6 pt-24 text-center">
        <h1 className="text-xl font-medium tracking-tight">No active event</h1>
      </div>
    )
  }
  const [queue, rewards, recentRedemptions] = await Promise.all([
    listVerificationQueue(event.id),
    listRewards(event.id),
    listRecentRedemptions(event.id),
  ])

  const eligibleQueue = queue.filter((q) => q.mintedAt)
  const current = eligibleQueue[0] ?? queue[0] ?? null
  const others = eligibleQueue.slice(1, 4)

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <h1 className="text-xl font-medium tracking-tight">Verification</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Verify on-chain completion badges and hand out the physical reward
            tier the player is eligible for.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Staff · Vlad M. · Main hall exit
          </span>
          <Button variant="ghost" className="h-8 text-muted-foreground">
            Today&apos;s log
          </Button>
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-10">
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-medium">Scan or enter badge</h2>
              <p className="text-xs text-muted-foreground">
                NFC, QR, or manual badge ID lookup
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ScanLineIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  defaultValue={current?.address ?? ""}
                  className="h-10 pl-9 font-mono text-sm tracking-[0.04em]"
                  placeholder="0x… or scan QR"
                />
              </div>
              <Button className="h-10 px-5">Verify</Button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ScanLineIcon className="size-3" /> Tap to scan NFC
              </span>
              <span className="flex items-center gap-1.5">
                <WalletIcon className="size-3" /> Connect wallet read
              </span>
              <span className="flex items-center gap-1.5">
                <CheckIcon className="size-3" /> Manual entry
              </span>
            </div>
          </section>

          {current ? (
            <section>
              <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
                <div>
                  <p className="text-xs text-muted-foreground">
                    Wallet · started {timeAgo(current.startedAt.getTime())}
                  </p>
                  <h2 className="mt-0.5 text-lg font-medium tracking-tight">
                    {shortAddress(current.address)}
                  </h2>
                </div>
                {current.mintedAt ? (
                  <span className="flex items-center gap-1.5 text-xs text-emerald-400/90">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    Eligible
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-amber-300/90">
                    <span className="size-1.5 rounded-full bg-amber-400" />
                    No badge yet
                  </span>
                )}
              </div>

              <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
                <DetailField
                  label="Wallet"
                  value={shortAddress(current.address)}
                  mono
                />
                <DetailField
                  label="Last scan"
                  value={
                    current.lastScanAt
                      ? timeAgo(current.lastScanAt.getTime())
                      : "—"
                  }
                />
                <DetailField
                  label="Badge tx"
                  value={current.txHash ? shortAddress(current.txHash) : "—"}
                  mono
                />
              </dl>

              <div className="mt-8">
                <p className="mb-3 text-xs text-muted-foreground">
                  Reward tier
                </p>
                <ul className="grid divide-y divide-border border-y border-border">
                  {rewards.map((reward, i) => (
                    <li
                      key={reward.id}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <div>
                        <p className="text-sm">{reward.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {reward.stockTotal !== null
                            ? `${reward.stockClaimed} of ${reward.stockTotal} claimed`
                            : "Unlimited"}
                        </p>
                      </div>
                      <Button
                        variant={i === 0 ? "default" : "ghost"}
                        size="sm"
                        className={cn(
                          "h-7 text-xs",
                          i !== 0 &&
                            "text-muted-foreground hover:text-foreground"
                        )}
                        disabled={!current.mintedAt}
                      >
                        {i === 0 ? "Hand out & redeem" : "Redeem"}
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : (
            <section className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Scan a badge or wallet address to begin verification.
              </p>
            </section>
          )}
        </div>

        <div className="grid gap-10">
          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium">Waiting at desk</h2>
                <p className="text-xs text-muted-foreground">
                  {others.length} players holding eligible badges
                </p>
              </div>
            </div>
            {others.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No one waiting right now.
              </p>
            ) : (
              <ul className="grid divide-y divide-border">
                {others.map((p) => (
                  <li
                    key={p.playerId}
                    className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3"
                  >
                    <span className="grid size-7 place-items-center rounded-full bg-primary/12 font-mono text-[10px] text-primary">
                      {p.address.slice(2, 4).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm">
                        {shortAddress(p.address)}
                      </p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {p.txHash ? shortAddress(p.txHash) : "no tx yet"}
                      </p>
                    </div>
                    <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {!p.mintedAt && (
                        <AlertTriangleIcon className="size-3 text-amber-300" />
                      )}
                      <span className="font-mono tabular-nums">
                        {p.mintedAt
                          ? timeAgo(p.mintedAt.getTime())
                          : "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium">Reward stock</h2>
                <p className="text-xs text-muted-foreground">
                  What is left to hand out today
                </p>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="h-7 px-0 text-[11px] font-normal text-muted-foreground">
                    Reward
                  </TableHead>
                  <TableHead className="h-7 text-right text-[11px] font-normal text-muted-foreground">
                    Claimed
                  </TableHead>
                  <TableHead className="h-7 px-0 text-right text-[11px] font-normal text-muted-foreground">
                    Stock
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rewards.map((r) => (
                  <TableRow key={r.id} className="border-border">
                    <TableCell className="px-0 py-2.5 text-sm">
                      {r.name}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                      {r.stockClaimed}
                    </TableCell>
                    <TableCell className="px-0 py-2.5 text-right text-xs text-muted-foreground">
                      {r.stockTotal !== null
                        ? `${r.stockTotal} total`
                        : "Unlimited"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>

          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium">Recent redemptions</h2>
                <p className="text-xs text-muted-foreground">Last 30 minutes</p>
              </div>
            </div>
            {recentRedemptions.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No redemptions yet today.
              </p>
            ) : (
              <ul className="grid divide-y divide-border">
                {recentRedemptions.map((r) => (
                  <li
                    key={r.id}
                    className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5"
                  >
                    <span className="w-10 font-mono text-[11px] text-muted-foreground tabular-nums">
                      {r.claimedAt.toISOString().slice(11, 16)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.rewardName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {shortAddress(r.wallet)} ·{" "}
                        {r.staffUserId
                          ? r.staffUserId.slice(0, 8)
                          : "staff"}
                      </p>
                    </div>
                    <span className="size-1.5 rounded-full bg-emerald-400/70" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 text-sm",
          mono && "font-mono tracking-[0.04em]"
        )}
      >
        {value}
      </dd>
    </div>
  )
}
