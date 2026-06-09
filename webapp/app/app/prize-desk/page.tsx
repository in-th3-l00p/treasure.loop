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
import {
  recentRedemptions,
  rewards,
  verificationQueue,
} from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default function PrizeDeskPage() {
  const current = verificationQueue[0]
  const others = verificationQueue.slice(1)

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
                  defaultValue={current.badge}
                  className="h-10 pl-9 font-mono text-sm tracking-[0.04em]"
                  placeholder="TL-CLUJ-..."
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

          <section>
            <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Badge {current.badge} · completed {current.completedAt}
                </p>
                <h2 className="mt-0.5 text-lg font-medium tracking-tight">
                  {current.player}
                </h2>
              </div>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400/90">
                <span className="size-1.5 rounded-full bg-emerald-400" />
                Eligible
              </span>
            </div>

            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-3">
              <DetailField label="Wallet" value={current.wallet} mono />
              <DetailField label="Route" value="Cluj Loop 01 · 5 of 5" />
              <DetailField label="First scan" value="11:42" />
            </dl>

            <div className="mt-8">
              <p className="mb-3 text-xs text-muted-foreground">Reward tier</p>
              <ul className="grid divide-y divide-border border-y border-border">
                {current.eligible.map((reward, i) => (
                  <li
                    key={reward}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <p className="text-sm">{reward}</p>
                      <p className="text-xs text-muted-foreground">
                        {i === 0
                          ? "Recommended next tier"
                          : "Also available to claim"}
                      </p>
                    </div>
                    <Button
                      variant={i === 0 ? "default" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-7 text-xs",
                        i !== 0 && "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {i === 0 ? "Hand out & redeem" : "Redeem"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>

            {current.flags.length > 0 && (
              <div className="mt-4 flex items-start gap-2.5 text-xs text-amber-300/90">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <p>{current.flags.join(" · ")}</p>
              </div>
            )}
          </section>
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
            <ul className="grid divide-y divide-border">
              {others.map((p) => (
                <li
                  key={p.badge}
                  className="grid grid-cols-[28px_1fr_auto] items-center gap-3 py-3"
                >
                  <span className="grid size-7 place-items-center rounded-full bg-primary/12 font-mono text-[10px] text-primary">
                    {p.player.split(" ").map((s) => s[0]).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{p.player}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {p.badge}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {p.flags.length > 0 && (
                      <AlertTriangleIcon className="size-3 text-amber-300" />
                    )}
                    <span className="font-mono tabular-nums">
                      {p.completedAt}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
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
                  <TableRow key={r.name} className="border-border">
                    <TableCell className="px-0 py-2.5 text-sm">
                      {r.name}
                    </TableCell>
                    <TableCell className="py-2.5 text-right font-mono text-sm tabular-nums">
                      {r.claimed}
                    </TableCell>
                    <TableCell className="px-0 py-2.5 text-right text-xs text-muted-foreground">
                      {r.stock}
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
            <ul className="grid divide-y divide-border">
              {recentRedemptions.map((r) => (
                <li
                  key={r.badge}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5"
                >
                  <span className="w-10 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {r.at}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm">{r.reward}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {r.badge} · by {r.staff}
                    </p>
                  </div>
                  <span className="size-1.5 rounded-full bg-emerald-400/70" />
                </li>
              ))}
            </ul>
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
