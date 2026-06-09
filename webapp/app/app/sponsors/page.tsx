import Link from "next/link"
import {
  ArrowUpRightIcon,
  DownloadIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { requireRoles } from "@/lib/auth-server"
import { ROLES } from "@/lib/authz"
import { checkpoints, hourlyTraffic, sponsors } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

export default async function SponsorsPage() {
  await requireRoles([ROLES.ORGANIZER, ROLES.SPONSOR])
  const activeSponsor = sponsors[0]
  const activeCheckpoint = checkpoints.find(
    (c) => c.sponsor === activeSponsor.name
  )
  const conversionRate = Math.round(
    (activeSponsor.conversations / activeSponsor.visits) * 100
  )
  const maxScans = Math.max(...hourlyTraffic.map((h) => h.scans))

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-8 pb-16 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
        <div className="max-w-xl">
          <p className="text-xs text-muted-foreground">Sponsor performance</p>
          <h1 className="mt-1 text-xl font-medium tracking-tight">
            {activeSponsor.name}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Booth traffic, conversation rate, and qualified attendee signal for
            the {activeCheckpoint?.name} checkpoint.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" className="h-8 text-muted-foreground">
            <DownloadIcon className="mr-1.5 size-3.5" /> Export CSV
          </Button>
          <Button variant="outline" className="h-8">
            Share with sponsor
            <ArrowUpRightIcon className="ml-1 size-3.5" />
          </Button>
        </div>
      </header>

      <section className="mb-12">
        <div className="grid divide-x divide-border overflow-hidden rounded-lg border border-border sm:grid-cols-2 lg:grid-cols-4">
          {sponsors.map((s) => {
            const active = s.name === activeSponsor.name
            const rate = Math.round((s.conversations / s.visits) * 100)
            return (
              <Link
                key={s.name}
                href="#"
                data-active={active || undefined}
                className={cn(
                  "group relative flex flex-col gap-3 p-5 transition-colors",
                  "hover:bg-muted/30",
                  "data-[active]:bg-muted/40"
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-0 top-0 h-px transition-colors",
                    active ? "bg-primary" : "bg-transparent"
                  )}
                />
                <div className="flex items-start justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm",
                      active && "text-foreground"
                    )}
                  >
                    {s.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.tier}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className="flex flex-col leading-tight">
                    <span className="text-2xl font-medium tabular-nums tracking-tight">
                      {s.visits.toLocaleString()}
                    </span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      visits today
                    </span>
                  </div>
                  <div className="flex flex-col items-end leading-tight">
                    <span className="text-sm tabular-nums">{rate}%</span>
                    <span className="mt-0.5 text-xs text-muted-foreground">
                      talk-through
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="mb-12 grid gap-10 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <Tabs defaultValue="traffic">
            <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-medium">Traffic and conversation</h2>
                <p className="text-xs text-muted-foreground">
                  Scans recorded at the booth versus follow-up conversations
                </p>
              </div>
              <TabsList className="h-7 bg-transparent p-0 gap-0">
                <TabsTrigger
                  value="traffic"
                  className="h-7 rounded-none border-b border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  Today
                </TabsTrigger>
                <TabsTrigger
                  value="week"
                  className="h-7 rounded-none border-b border-transparent px-2 text-xs text-muted-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                >
                  All days
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="traffic">
              <BarChart
                data={hourlyTraffic.map((h, i) => {
                  const rate = 0.4 + (i % 5) * 0.08
                  const conv = Math.round(h.scans * rate * 0.4)
                  return {
                    label: h.hour,
                    primary: conv,
                    secondary: h.scans - conv,
                  }
                })}
                max={maxScans}
              />
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-primary" />
                  Conversations
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px] bg-primary/20" /> Scans
                </span>
              </div>
            </TabsContent>
            <TabsContent
              value="week"
              className="grid h-44 place-items-center text-xs text-muted-foreground"
            >
              Aggregated chart placeholder
            </TabsContent>
          </Tabs>
        </div>

        <div className="grid gap-8">
          <section>
            <div className="mb-5 border-b border-border pb-3">
              <h2 className="text-sm font-medium">Today&apos;s numbers</h2>
              <p className="text-xs text-muted-foreground">
                Across the {activeCheckpoint?.name} checkpoint
              </p>
            </div>
            <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
              <Metric
                label="Visits"
                value={activeSponsor.visits.toLocaleString()}
                hint="+128 today"
              />
              <Metric
                label="Conversations"
                value={activeSponsor.conversations.toLocaleString()}
                hint={`${conversionRate}% talk-through`}
              />
              <Metric label="Avg dwell" value="2m 14s" hint="vs 1m 48s prev" />
              <Metric label="Qualified" value="86" hint="+12% vs Gold avg" />
            </dl>
          </section>

          <section>
            <div className="mb-3 border-b border-border pb-3">
              <h2 className="text-sm font-medium">Top scan moments</h2>
              <p className="text-xs text-muted-foreground">
                When the booth was busiest
              </p>
            </div>
            <ul className="grid divide-y divide-border">
              {[
                { window: "15:00 – 15:30", scans: 88, label: "Post-keynote rush" },
                { window: "12:00 – 12:30", scans: 64, label: "Lunch break" },
                { window: "17:30 – 18:00", scans: 41, label: "Closing wave" },
              ].map((m) => (
                <li key={m.window} className="grid gap-1.5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {m.window}
                    </span>
                    <span className="font-mono text-sm tabular-nums">
                      {m.scans} scans
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{m.label}</p>
                  <Progress value={(m.scans / 100) * 100} className="h-[2px]" />
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-3 border-b border-border pb-3">
          <div>
            <h2 className="text-sm font-medium">Qualified leads</h2>
            <p className="text-xs text-muted-foreground">
              Attendees who completed this checkpoint and opted in to share
              their wallet with the sponsor
            </p>
          </div>
          <span className="text-xs text-muted-foreground">86 leads</span>
        </div>
        <ul className="grid divide-y divide-border">
          {[
            { name: "Catalin T.", wallet: "0x74...92b1", interest: "smart accounts", time: "11:42" },
            { name: "Ana D.", wallet: "0x31...ab70", interest: "AA wallets", time: "12:18" },
            { name: "Radu C.", wallet: "0x09...21fc", interest: "hardware integration", time: "13:04" },
            { name: "Mihai L.", wallet: "0x82...c914", interest: "compliance flows", time: "13:51" },
            { name: "Iulia M.", wallet: "0x4a...77fe", interest: "cross-chain UX", time: "14:22" },
          ].map((lead) => (
            <li
              key={lead.wallet}
              className="grid grid-cols-[28px_1fr_1.2fr_auto] items-center gap-4 py-3"
            >
              <span className="grid size-7 place-items-center rounded-full bg-primary/12 font-mono text-[10px] text-primary">
                {lead.name.split(" ").map((s) => s[0]).join("")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm">{lead.name}</p>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {lead.wallet}
                </p>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                Interested in {lead.interest}
              </p>
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {lead.time}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-medium tabular-nums tracking-tight">
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function BarChart({
  data,
  max,
  height = 168,
}: {
  data: { label: string; primary: number; secondary: number }[]
  max: number
  height?: number
}) {
  return (
    <div>
      <div
        className="relative grid gap-2"
        style={{
          height,
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
        }}
      >
        {data.map((d) => {
          const total = d.primary + d.secondary
          const totalPct = Math.max((total / max) * 100, 2)
          const primaryPct = total > 0 ? (d.primary / total) * 100 : 0
          return (
            <div key={d.label} className="relative h-full">
              <div
                className="absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-[2px]"
                style={{ height: `${totalPct}%` }}
              >
                <div
                  className="w-full bg-primary/20"
                  style={{ height: `${100 - primaryPct}%` }}
                />
                <div
                  className="w-full bg-primary"
                  style={{ height: `${primaryPct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div
        className="mt-2 grid gap-2 border-t border-border pt-2"
        style={{
          gridAutoFlow: "column",
          gridAutoColumns: "1fr",
        }}
      >
        {data.map((d) => (
          <span
            key={d.label}
            className="text-center font-mono text-[10px] text-muted-foreground"
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  )
}
