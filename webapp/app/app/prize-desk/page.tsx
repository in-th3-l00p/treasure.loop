import { AlertTriangleIcon } from "lucide-react"

import { PageEmpty } from "@/components/product/empty-state"
import { ProductPage, PageHeader } from "@/components/product/shell"
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
import { clockTime, shortAddress, timeAgo } from "@/lib/format"

import { PrizeDeskVerifier } from "./_components/verifier"

export default async function PrizeDeskPage() {
  await requireRoles([ROLES.ORGANIZER, ROLES.PRIZE_DESK])
  const event = await getActiveEvent()
  if (!event) {
    return <PageEmpty title="No active event" />
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
    <ProductPage>
      <PageHeader
        title="Prize desk"
        description="Verify on-chain completion badges and hand out the physical reward tier the player is eligible for."
      />

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        <PrizeDeskVerifier
          initialAddress={current?.address ?? null}
          eventName={event.name}
        />

        <div className="grid gap-10">
          <section>
            <div className="mb-3 flex items-end justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium">Recently minted</h2>
                <p className="text-xs text-muted-foreground">
                  {others.length === 0
                    ? "Players appear here as they mint"
                    : `${others.length} players holding fresh badges`}
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
                        {p.mintedAt ? timeAgo(p.mintedAt) : "—"}
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
                <p className="text-xs text-muted-foreground">
                  Latest hand-outs, most recent first
                </p>
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
                      {clockTime(r.claimedAt)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{r.rewardName}</p>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {shortAddress(r.wallet)}
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
    </ProductPage>
  )
}
