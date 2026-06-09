"use client"

import { useRouter } from "next/navigation"
import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  GaugeIcon,
  GiftIcon,
  GripVerticalIcon,
  MapPinnedIcon,
  PlusIcon,
  RouteIcon,
  ScanLineIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import {
  checkpoints,
  players,
  sponsors,
  verificationQueue,
} from "@/lib/mock-data"

const statusDot: Record<string, string> = {
  Healthy: "bg-emerald-400",
  Busy: "bg-amber-400",
  "Needs staff": "bg-rose-400",
  Offline: "bg-muted-foreground",
}

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="top-[15%] sm:max-w-[640px] border border-border shadow-2xl shadow-black/40"
    >
      <CommandInput placeholder="Search checkpoints, sponsors, players, or actions…" />
      <CommandList>
        <CommandEmpty>
          <div className="grid gap-1.5 py-2 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing matches.
            </p>
            <p className="font-mono text-[11px] text-muted-foreground/60">
              Try a checkpoint name, badge ID, or wallet
            </p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Jump to">
          <CommandItem onSelect={() => go("/app")} keywords={["live", "dashboard", "home"]}>
            <GaugeIcon /> Live overview
            <CommandShortcut>G L</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/routes")} keywords={["configure", "build"]}>
            <RouteIcon /> Configure route
            <CommandShortcut>G R</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/prize-desk")} keywords={["verify", "redeem"]}>
            <ShieldCheckIcon /> Prize desk
            <CommandShortcut>G V</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/sponsors")}>
            <TicketIcon /> Sponsors
            <CommandShortcut>G S</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/app/players")}>
            <UsersIcon /> Players
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => go("/app/prize-desk")} keywords={["scan", "redeem", "badge"]}>
            <ScanLineIcon /> Verify a badge…
          </CommandItem>
          <CommandItem onSelect={() => go("/app/routes")} keywords={["new", "create"]}>
            <PlusIcon /> Add a checkpoint…
          </CommandItem>
          <CommandItem onSelect={() => go("/app/routes")} keywords={["staff", "operator"]}>
            <UsersIcon /> Invite booth staff…
          </CommandItem>
          <CommandItem onSelect={() => go("/app/prize-desk")} keywords={["queue"]}>
            <GiftIcon /> Open today&apos;s redemption log
          </CommandItem>
          <CommandItem onSelect={() => onOpenChange(false)} keywords={["csv", "download"]}>
            <DownloadIcon /> Export today&apos;s report
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Checkpoints">
          {checkpoints.map((cp) => (
            <CommandItem
              key={cp.id}
              onSelect={() => go(`/app/routes#${cp.id}`)}
              keywords={[cp.sponsor, cp.area, cp.status]}
            >
              <MapPinnedIcon />
              <span className="flex-1">{cp.name}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span
                  className={`size-1.5 rounded-full ${statusDot[cp.status]}`}
                />
                {cp.sponsor}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Sponsors">
          {sponsors.map((s) => (
            <CommandItem
              key={s.name}
              onSelect={() => go("/app/sponsors")}
              keywords={[s.tier]}
            >
              <TicketIcon />
              <span className="flex-1">{s.name}</span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {s.visits.toLocaleString()} visits
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Verification queue">
          {verificationQueue.map((q) => (
            <CommandItem
              key={q.badge}
              onSelect={() => go("/app/prize-desk")}
              keywords={[q.wallet]}
            >
              {q.flags.length > 0 ? (
                <AlertTriangleIcon className="text-amber-300" />
              ) : (
                <CheckIcon className="text-emerald-400" />
              )}
              <span className="flex-1">{q.player}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {q.badge}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Players">
          {players.map((p) => (
            <CommandItem
              key={p.wallet}
              onSelect={() => go("/app/players")}
              keywords={[p.wallet, p.status]}
            >
              <span className="grid size-4 place-items-center rounded-full bg-primary/15 text-[8px] font-medium text-primary">
                {p.name
                  .split(" ")
                  .map((s) => s[0])
                  .join("")}
              </span>
              <span className="flex-1">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.progress}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Help">
          <CommandItem onSelect={() => onOpenChange(false)}>
            <ArrowRightIcon /> Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => onOpenChange(false)}>
            <GripVerticalIcon /> Tips for organizers
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
