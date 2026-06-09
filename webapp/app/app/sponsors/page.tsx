import Link from "next/link"
import {
  ArrowUpRightIcon,
  DownloadIcon,
  MessageCircleIcon,
  TimerIcon,
  TrendingUpIcon,
  Users2Icon,
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
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { checkpoints, hourlyTraffic, sponsors } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const tierStyles: Record<string, string> = {
  Gold: "border-amber-400/40 bg-amber-400/10 text-amber-200",
  Prize: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200",
  Community: "border-sky-400/40 bg-sky-400/10 text-sky-200",
}

export default function SponsorsPage() {
  const activeSponsor = sponsors[0]
  const activeCheckpoint = checkpoints.find(
    (c) => c.sponsor === activeSponsor.name
  )
  const conversionRate = Math.round(
    (activeSponsor.conversations / activeSponsor.visits) * 100
  )
  const maxScans = Math.max(...hourlyTraffic.map((h) => h.scans))

  return (
    <div className="px-5 pt-6 pb-14 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-4 pb-6">
        <div>
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            Sponsor performance
          </p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">
            {activeSponsor.name}
          </h1>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Booth traffic, conversation rate, and qualified attendee signal for
            the {activeCheckpoint?.name} checkpoint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-8">
            <DownloadIcon className="mr-1.5 size-3.5" /> Export CSV
          </Button>
          <Button className="h-8">
            Share with sponsor
            <ArrowUpRightIcon className="ml-1 size-3.5" />
          </Button>
        </div>
      </header>

      <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
        {sponsors.map((s) => {
          const active = s.name === activeSponsor.name
          const rate = Math.round((s.conversations / s.visits) * 100)
          return (
            <Link
              key={s.name}
              href="#"
              data-active={active || undefined}
              className={cn(
                "group flex flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                "border-border bg-card hover:border-primary/30",
                "data-[active]:border-primary/50 data-[active]:bg-primary/8"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 rounded-full px-1.5 font-mono text-[9px] tracking-[0.08em] uppercase",
                    tierStyles[s.tier] ?? "border-border text-muted-foreground"
                  )}
                >
                  {s.tier}
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold tabular-nums tracking-tight">
                  {s.visits.toLocaleString()}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  visits · {rate}% talk
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <Tabs defaultValue="traffic">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-medium">
                    Traffic and conversation
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Scans recorded at the booth versus follow-up conversations
                  </CardDescription>
                </div>
                <TabsList className="h-8 bg-secondary/40 p-0.5">
                  <TabsTrigger value="traffic" className="h-7 px-3 text-xs">
                    Today
                  </TabsTrigger>
                  <TabsTrigger value="week" className="h-7 px-3 text-xs">
                    All days
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="traffic" className="mt-4">
                <div className="flex h-44 items-end gap-3">
                  {hourlyTraffic.map((h, i) => {
                    const rate = 0.4 + (i % 5) * 0.08
                    const conv = Math.round(h.scans * rate * 0.4)
                    return (
                      <div
                        key={h.hour}
                        className="flex flex-1 flex-col items-center gap-1.5"
                      >
                        <div className="flex w-full flex-1 flex-col justify-end gap-0.5">
                          <div
                            className="w-full rounded-t-sm bg-primary"
                            style={{ height: `${(conv / maxScans) * 100}%` }}
                          />
                          <div
                            className="w-full rounded-sm bg-primary/20"
                            style={{
                              height: `${((h.scans - conv) / maxScans) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {h.hour}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-4 flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary" />{" "}
                    Conversations
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-sm bg-primary/20" /> Scans
                  </span>
                </div>
              </TabsContent>
              <TabsContent
                value="week"
                className="mt-4 grid h-44 place-items-center text-xs text-muted-foreground"
              >
                Aggregated chart placeholder
              </TabsContent>
            </Tabs>
          </CardHeader>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardContent className="grid grid-cols-2 gap-3 py-4">
              <Metric
                icon={Users2Icon}
                label="Visits"
                value={activeSponsor.visits.toLocaleString()}
                hint="+128 today"
              />
              <Metric
                icon={MessageCircleIcon}
                label="Conversations"
                value={activeSponsor.conversations.toLocaleString()}
                hint={`${conversionRate}% talk-through`}
              />
              <Metric
                icon={TimerIcon}
                label="Avg dwell"
                value="2m 14s"
                hint="vs 1m 48s prev"
              />
              <Metric
                icon={TrendingUpIcon}
                label="Qualified"
                value="86"
                hint="+12% vs Gold avg"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                Top scan moments
              </CardTitle>
              <CardDescription className="text-xs">
                When the booth was busiest
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 pb-3">
              {[
                { window: "15:00 – 15:30", scans: 88, label: "Post-keynote rush" },
                { window: "12:00 – 12:30", scans: 64, label: "Lunch break" },
                { window: "17:30 – 18:00", scans: 41, label: "Closing wave" },
              ].map((m) => (
                <div
                  key={m.window}
                  className="grid gap-1.5 rounded-md border border-border bg-secondary/30 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                      {m.window}
                    </span>
                    <span className="font-mono text-sm font-medium tabular-nums">
                      {m.scans} scans
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{m.label}</p>
                  <Progress
                    value={(m.scans / 100) * 100}
                    className="h-1"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium">
                Qualified leads
              </CardTitle>
              <CardDescription className="text-xs">
                Attendees who completed this checkpoint and opted in to share
                their wallet with the sponsor
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className="h-6 rounded-full border-border bg-secondary/40 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
            >
              86 leads
            </Badge>
          </div>
        </CardHeader>
        <Separator className="bg-border/60" />
        <CardContent className="pb-3">
          <div className="grid gap-2">
            {[
              { name: "Catalin T.", wallet: "0x74...92b1", interest: "Smart accounts", time: "11:42" },
              { name: "Ana D.", wallet: "0x31...ab70", interest: "AA wallets", time: "12:18" },
              { name: "Radu C.", wallet: "0x09...21fc", interest: "Hardware integration", time: "13:04" },
              { name: "Mihai L.", wallet: "0x82...c914", interest: "Compliance flows", time: "13:51" },
              { name: "Iulia M.", wallet: "0x4a...77fe", interest: "Cross-chain UX", time: "14:22" },
            ].map((lead) => (
              <div
                key={lead.wallet}
                className="grid grid-cols-[28px_1fr_1.2fr_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-secondary/30"
              >
                <span className="grid size-7 place-items-center rounded-md bg-primary/15 font-mono text-[10px] text-primary">
                  {lead.name.split(" ").map((s) => s[0]).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{lead.name}</p>
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {lead.wallet}
                  </p>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  Interested in {lead.interest.toLowerCase()}
                </p>
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                  {lead.time}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className="size-3" />
        <span className="font-mono tracking-[0.12em] uppercase">{label}</span>
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight">
        {value}
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
    </div>
  )
}
