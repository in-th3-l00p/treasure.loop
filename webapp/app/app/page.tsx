import Link from "next/link"
import {
  ActivityIcon,
  BadgeCheckIcon,
  BellIcon,
  CalendarDaysIcon,
  ChevronDownIcon,
  CircleDollarSignIcon,
  ClipboardListIcon,
  GiftIcon,
  MapIcon,
  MoreHorizontalIcon,
  QrCodeIcon,
  RadioTowerIcon,
  RouteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SparklesIcon,
  TicketCheckIcon,
  UsersIcon,
} from "lucide-react"

import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Progress,
  ProgressLabel,
} from "@/components/ui/progress"
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  checkpoints,
  event,
  activity,
  players,
  rewards,
  sponsors,
} from "@/lib/mock-data"

const navigation = [
  { name: "Overview", icon: ActivityIcon, active: true },
  { name: "Route graph", icon: RouteIcon },
  { name: "Checkpoints", icon: QrCodeIcon },
  { name: "Players", icon: UsersIcon },
  { name: "Rewards", icon: GiftIcon },
  { name: "Settings", icon: SettingsIcon },
]

const stats = [
  {
    label: "Active players",
    value: event.activePlayers.toLocaleString(),
    detail: `${event.attendeeCount.toLocaleString()} attendees imported`,
    icon: UsersIcon,
  },
  {
    label: "Sponsor visits",
    value: event.sponsorVisits.toLocaleString(),
    detail: "Qualified booth interactions",
    icon: RadioTowerIcon,
  },
  {
    label: "Completions",
    value: event.completions.toLocaleString(),
    detail: `${event.badgeMints} badges minted`,
    icon: BadgeCheckIcon,
  },
  {
    label: "Prize claims",
    value: "74",
    detail: "Physical desk verifications",
    icon: TicketCheckIcon,
  },
]

function StatusBadge({ status }: { status: string }) {
  if (status === "Healthy" || status === "Open" || status === "Minting") {
    return <Badge>{status}</Badge>
  }

  if (status === "Busy" || status === "Limited") {
    return <Badge variant="secondary">{status}</Badge>
  }

  return <Badge variant="destructive">{status}</Badge>
}

export default function AppPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
        <aside className="hidden border-r border-border bg-sidebar/80 p-5 lg:flex lg:flex-col">
          <Link href="/" className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl border border-border bg-primary/20 text-primary">
              <MapIcon />
            </span>
            TreasureLoop
          </Link>

          <div className="mt-8 rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-primary">
                  Current event
                </p>
                <p className="mt-1 text-sm font-medium leading-5">{event.name}</p>
              </div>
              <ChevronDownIcon className="mt-1 text-muted-foreground" />
            </div>
            <Separator className="my-3" />
            <div className="flex flex-col gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-2">
                <CalendarDaysIcon /> {event.dates}
              </span>
              <span className="flex items-center gap-2">
                <ShieldCheckIcon /> {event.walletNetwork}
              </span>
            </div>
          </div>

          <nav className="mt-6 flex flex-col gap-1">
            {navigation.map((item) => (
              <a
                key={item.name}
                href="#"
                className={
                  item.active
                    ? "flex items-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground"
                    : "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }
              >
                <item.icon />
                {item.name}
              </a>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl border border-border bg-card p-4">
            <p className="text-sm font-medium">Prize desk mode</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Staff can verify badge ownership and mark physical rewards as
              claimed.
            </p>
            <Button className="mt-4 w-full" size="sm">
              Open desk view
            </Button>
          </div>
        </aside>

        <section className="min-w-0">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/86 px-4 backdrop-blur-xl md:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-primary">
                {event.status}
              </p>
              <h1 className="truncate font-heading text-2xl font-medium tracking-normal md:text-3xl">
                {event.name}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" aria-label="Notifications">
                <BellIcon />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                  InTheLoop Ops
                  <MoreHorizontalIcon data-icon="inline-end" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Workspace</DropdownMenuLabel>
                  <DropdownMenuGroup>
                    <DropdownMenuItem>Event settings</DropdownMenuItem>
                    <DropdownMenuItem>Billing preview</DropdownMenuItem>
                    <DropdownMenuItem>Invite staff</DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="flex flex-col gap-6 p-4 md:p-6 xl:p-8">
            <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
              <Card className="border-border/80 bg-card/86">
                <CardHeader>
                  <div>
                    <CardTitle className="text-3xl">Event command center</CardTitle>
                    <CardDescription>
                      A live-feeling snapshot of route progress, sponsor traffic,
                      and reward fulfillment for {event.venue}.
                    </CardDescription>
                  </div>
                  <CardAction>
                    <Badge variant="secondary">Mock data</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 md:grid-cols-4">
                    {stats.map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-2xl border border-border bg-secondary/35 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                            <stat.icon />
                          </span>
                          <Badge variant="outline">Live</Badge>
                        </div>
                        <p className="mt-5 text-3xl font-semibold tracking-tight">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-sm font-medium">{stat.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {stat.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/80 bg-card/86">
                <CardHeader>
                  <CardTitle>Loop readiness</CardTitle>
                  <CardDescription>
                    Operational confidence before opening doors.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <Progress value={event.routeCompletion}>
                    <ProgressLabel>Route completion</ProgressLabel>
                    <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                      {event.routeCompletion}%
                    </span>
                  </Progress>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-2xl font-semibold">5</p>
                      <p className="text-xs text-muted-foreground">Checkpoints</p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-2xl font-semibold">4</p>
                      <p className="text-xs text-muted-foreground">Sponsors</p>
                    </div>
                    <div className="rounded-xl border border-border p-3">
                      <p className="text-2xl font-semibold">1</p>
                      <p className="text-xs text-muted-foreground">Staff gap</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-primary/10 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-primary">
                      <SparklesIcon /> Recommended next action
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Assign one more volunteer to Hardware Vault before the
                      paired-fragment clue goes live.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>

            <Tabs defaultValue="route" className="gap-4">
              <TabsList>
                <TabsTrigger value="route">Route map</TabsTrigger>
                <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
                <TabsTrigger value="rewards">Rewards</TabsTrigger>
                <TabsTrigger value="players">Players</TabsTrigger>
              </TabsList>

              <TabsContent value="route">
                <section className="grid gap-4 xl:grid-cols-[1fr_360px]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Configured route graph</CardTitle>
                      <CardDescription>
                        How attendees move through the mocked event.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-5">
                        {checkpoints.map((checkpoint, index) => (
                          <div
                            key={checkpoint.id}
                            className="relative rounded-2xl border border-border bg-secondary/35 p-4"
                          >
                            {index < checkpoints.length - 1 && (
                              <span className="absolute left-[calc(100%_-_0.5rem)] top-1/2 hidden h-px w-5 bg-border md:block" />
                            )}
                            <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-primary">
                              {checkpoint.id}
                            </p>
                            <h3 className="mt-8 font-heading text-2xl font-medium leading-none">
                              {checkpoint.name}
                            </h3>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">
                              {checkpoint.area}
                            </p>
                            <div className="mt-5">
                              <StatusBadge status={checkpoint.status} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Live activity</CardTitle>
                      <CardDescription>
                        Event signals an operator would monitor.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-col gap-3">
                        {activity.map((item) => (
                          <div key={item} className="flex gap-3">
                            <span className="mt-1 size-2 rounded-full bg-primary" />
                            <p className="text-sm leading-6 text-muted-foreground">
                              {item}
                            </p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </TabsContent>

              <TabsContent value="checkpoints">
                <Card>
                  <CardHeader>
                    <CardTitle>Checkpoint operations</CardTitle>
                    <CardDescription>
                      Staff assignment, scan volume, sponsor ownership, and clue
                      health.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Checkpoint</TableHead>
                          <TableHead>Sponsor</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Scans</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Staff</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {checkpoints.map((checkpoint) => (
                          <TableRow key={checkpoint.id}>
                            <TableCell>
                              <div className="font-medium">{checkpoint.name}</div>
                              <div className="text-xs text-muted-foreground">
                                {checkpoint.clue}
                              </div>
                            </TableCell>
                            <TableCell>{checkpoint.sponsor}</TableCell>
                            <TableCell>{checkpoint.area}</TableCell>
                            <TableCell>{checkpoint.scans}</TableCell>
                            <TableCell>
                              <StatusBadge status={checkpoint.status} />
                            </TableCell>
                            <TableCell>{checkpoint.staff}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="rewards">
                <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Reward tiers</CardTitle>
                      <CardDescription>
                        What completion unlocks at the physical prize layer.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                      {rewards.map((reward) => (
                        <div
                          key={reward.name}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-border p-3"
                        >
                          <div>
                            <p className="font-medium">{reward.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {reward.claimed} claimed, {reward.stock}
                            </p>
                          </div>
                          <StatusBadge status={reward.status} />
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Sponsor station value</CardTitle>
                      <CardDescription>
                        The sponsor-facing proof that foot traffic is happening.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-3 md:grid-cols-2">
                      {sponsors.map((sponsor) => (
                        <div
                          key={sponsor.name}
                          className="rounded-2xl border border-border bg-secondary/30 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="font-heading text-2xl font-medium">
                              {sponsor.name}
                            </p>
                            <Badge variant="outline">{sponsor.tier}</Badge>
                          </div>
                          <div className="mt-5 grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-2xl font-semibold">
                                {sponsor.visits}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Booth visits
                              </p>
                            </div>
                            <div>
                              <p className="text-2xl font-semibold">
                                {sponsor.conversations}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Conversations
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </section>
              </TabsContent>

              <TabsContent value="players">
                <section className="grid gap-4 xl:grid-cols-[1fr_340px]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Player progress</CardTitle>
                      <CardDescription>
                        Mocked attendees moving through the loop.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Player</TableHead>
                            <TableHead>Wallet</TableHead>
                            <TableHead>Progress</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {players.map((player) => (
                            <TableRow key={player.wallet}>
                              <TableCell className="font-medium">{player.name}</TableCell>
                              <TableCell>{player.wallet}</TableCell>
                              <TableCell>{player.progress}</TableCell>
                              <TableCell>
                                <Badge variant="secondary">{player.status}</Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Prize desk queue</CardTitle>
                      <CardDescription>
                        People ready for badge or physical verification.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AvatarGroup>
                        {["CT", "AD", "RC", "ML"].map((initials, index) => (
                          <Avatar key={initials} size="lg">
                            <AvatarFallback>{initials}</AvatarFallback>
                            {index < 2 && <AvatarBadge />}
                          </Avatar>
                        ))}
                        <AvatarGroupCount>+12</AvatarGroupCount>
                      </AvatarGroup>
                      <Separator className="my-5" />
                      <div className="flex flex-col gap-3">
                        <Button>
                          <ClipboardListIcon data-icon="inline-start" />
                          Verify next claim
                        </Button>
                        <Button variant="outline">
                          <CircleDollarSignIcon data-icon="inline-start" />
                          Export sponsor report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </section>
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </div>
    </main>
  )
}
