import {
  AlertTriangleIcon,
  CheckIcon,
  CircleCheckIcon,
  ClockIcon,
  PackageIcon,
  ScanLineIcon,
  ShieldCheckIcon,
  WalletIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
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
    <div className="px-5 pt-6 pb-14 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Prize desk · Main hall exit
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            Verification
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Verify on-chain completion badges and hand out the physical reward
            tier the player is eligible for.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="h-7 rounded-full border-emerald-400/30 bg-emerald-400/8 px-2.5 font-mono text-[10px] tracking-[0.12em] text-emerald-300 uppercase"
          >
            <ShieldCheckIcon className="mr-1 size-3" /> Staff: Vlad M.
          </Badge>
          <Button variant="outline" className="h-8">
            Today&apos;s log
          </Button>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Scan or enter badge
                  </CardTitle>
                  <CardDescription className="text-xs">
                    NFC, QR, or manual badge ID lookup
                  </CardDescription>
                </div>
                <Badge
                  variant="outline"
                  className="h-6 rounded-full border-border bg-secondary/40 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
                >
                  Base Sepolia
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <ScanLineIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    defaultValue={current.badge}
                    className="h-10 pl-9 font-mono text-sm tracking-[0.06em]"
                    placeholder="TL-CLUJ-..."
                  />
                </div>
                <Button className="h-10 px-4">
                  Verify
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Hint icon={ScanLineIcon} label="Tap to scan NFC" active />
                <Hint icon={WalletIcon} label="Connect wallet read" />
                <Hint icon={CheckIcon} label="Manual entry" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
                    <CircleCheckIcon className="size-5" />
                  </span>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      {current.player}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Badge {current.badge} · completed {current.completedAt}
                    </CardDescription>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="h-6 rounded-full border-emerald-400/30 bg-emerald-400/8 font-mono text-[10px] tracking-[0.1em] text-emerald-300 uppercase"
                >
                  <span className="status-dot mr-1.5" /> Eligible
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailField label="Wallet" value={current.wallet} mono />
                <DetailField
                  label="Route"
                  value="Cluj Loop 01 (5/5)"
                />
                <DetailField label="First scan" value="11:42" />
              </div>

              <Separator className="bg-border/60" />

              <div>
                <p className="mb-2 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                  Reward tier
                </p>
                <div className="grid gap-2">
                  {current.eligible.map((reward, i) => (
                    <div
                      key={reward}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-md border px-3 py-2.5 transition-colors",
                        i === 0
                          ? "border-primary/40 bg-primary/8"
                          : "border-border bg-secondary/30"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <PackageIcon
                          className={cn(
                            "size-4",
                            i === 0 ? "text-primary" : "text-muted-foreground"
                          )}
                        />
                        <div>
                          <p className="text-sm font-medium">{reward}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {i === 0
                              ? "Recommended next tier"
                              : "Also available to claim"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant={i === 0 ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs"
                      >
                        {i === 0 ? "Hand out & redeem" : "Redeem"}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {current.flags.length > 0 && (
                <div className="flex items-start gap-3 rounded-md border border-amber-400/30 bg-amber-400/8 px-3 py-2.5">
                  <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  <div className="flex-1 text-xs text-amber-100/80">
                    {current.flags.join(" · ")}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Waiting at desk
              </CardTitle>
              <CardDescription className="text-xs">
                {others.length} players holding eligible badges
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pb-3">
              {others.map((p) => (
                <div
                  key={p.badge}
                  className="grid grid-cols-[28px_1fr_auto] items-center gap-3 rounded-md border border-border bg-secondary/30 px-3 py-2.5"
                >
                  <span className="grid size-7 place-items-center rounded-md bg-primary/15 font-mono text-[10px] text-primary">
                    {p.player.split(" ").map((s) => s[0]).join("")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{p.player}</p>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {p.badge}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {p.flags.length > 0 && (
                      <AlertTriangleIcon className="size-3.5 text-amber-300" />
                    )}
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {p.completedAt}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Reward stock
              </CardTitle>
              <CardDescription className="text-xs">
                What is left to hand out today
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60">
                    <TableHead className="h-7 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Reward
                    </TableHead>
                    <TableHead className="h-7 text-right text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Claimed
                    </TableHead>
                    <TableHead className="h-7 text-right text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Stock
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rewards.map((r) => (
                    <TableRow key={r.name} className="border-border/60">
                      <TableCell className="text-sm">{r.name}</TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums">
                        {r.claimed}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground">
                        {r.stock}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  Recent redemptions
                </CardTitle>
                <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <ClockIcon className="size-3" /> Last 30 min
                </span>
              </div>
            </CardHeader>
            <CardContent className="grid gap-1.5 pb-3">
              {recentRedemptions.map((r) => (
                <div
                  key={r.badge}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md px-2 py-1.5 hover:bg-secondary/30"
                >
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                    {r.at}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px]">{r.reward}</p>
                    <p className="truncate font-mono text-[10px] text-muted-foreground">
                      {r.badge} · by {r.staff}
                    </p>
                  </div>
                  <CircleCheckIcon className="size-3.5 text-emerald-400/70" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Hint({
  icon: Icon,
  label,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-3 py-2 text-xs",
        active
          ? "border-primary/40 bg-primary/8 text-foreground"
          : "border-border bg-secondary/30 text-muted-foreground"
      )}
    >
      <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} />
      {label}
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
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
      <p
        className={cn(
          "mt-0.5 text-sm font-medium",
          mono && "font-mono tracking-[0.04em]"
        )}
      >
        {value}
      </p>
    </div>
  )
}
