"use client"

import { useRouter } from "next/navigation"
import {
  ActivityIcon,
  ClipboardCheckIcon,
  GaugeIcon,
  GiftIcon,
  MapPinnedIcon,
  PlusIcon,
  QrCodeIcon,
  RouteIcon,
  ScanLineIcon,
  TicketIcon,
  UserPlus2Icon,
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  checkpointStatusMeta,
  type CheckpointStatusValue,
} from "@/components/product/status"

/** Real event entities the server layout feeds the palette. */
export interface PaletteData {
  checkpoints: {
    id: string
    name: string
    sponsorName: string | null
    status: string
  }[]
  sponsors: { id: string; name: string; tier: string }[]
}

const statusDot: Record<CheckpointStatusValue, string> = {
  healthy: "bg-emerald-400",
  busy: "bg-amber-400",
  needs_staff: "bg-rose-400",
  offline: "bg-muted-foreground",
}

export function CommandPalette({
  open,
  onOpenChange,
  reachable,
  data,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reachable: Set<string>
  data: PaletteData
}) {
  const router = useRouter()

  const go = (href: string) => {
    onOpenChange(false)
    router.push(href)
  }

  const canReach = (href: string) => reachable.has(href)

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      className="top-[15%] sm:max-w-[640px] border border-border shadow-2xl shadow-black/40"
    >
      <CommandInput placeholder="Search checkpoints, sponsors, or actions…" />
      <CommandList>
        <CommandEmpty>
          <div className="grid gap-1.5 py-2 text-center">
            <p className="text-sm text-muted-foreground">Nothing matches.</p>
            <p className="font-mono text-[11px] text-muted-foreground">
              Try a checkpoint or sponsor name
            </p>
          </div>
        </CommandEmpty>

        <CommandGroup heading="Jump to">
          {canReach("/app") && (
            <CommandItem
              onSelect={() => go("/app")}
              keywords={["live", "dashboard", "home", "overview"]}
            >
              <GaugeIcon /> Overview
            </CommandItem>
          )}
          {canReach("/app/live") && (
            <CommandItem
              onSelect={() => go("/app/live")}
              keywords={["ops", "dashboard", "monitor", "realtime", "report"]}
            >
              <ActivityIcon /> Live ops
            </CommandItem>
          )}
          {canReach("/app/routes") && (
            <CommandItem
              onSelect={() => go("/app/routes")}
              keywords={["configure", "build", "checkpoints"]}
            >
              <RouteIcon /> Routes
            </CommandItem>
          )}
          {canReach("/app/sponsors") && (
            <CommandItem onSelect={() => go("/app/sponsors")}>
              <TicketIcon /> Sponsors
            </CommandItem>
          )}
          {canReach("/app/team") && (
            <CommandItem
              onSelect={() => go("/app/team")}
              keywords={["staff", "invite", "members"]}
            >
              <UserPlus2Icon /> Team
            </CommandItem>
          )}
          {canReach("/app/prize-desk") && (
            <CommandItem
              onSelect={() => go("/app/prize-desk")}
              keywords={["verify", "redeem"]}
            >
              <GiftIcon /> Prize desk
            </CommandItem>
          )}
          {canReach("/app/booth") && (
            <CommandItem
              onSelect={() => go("/app/booth")}
              keywords={["kiosk", "code", "totp"]}
            >
              <QrCodeIcon /> Booth kiosk
            </CommandItem>
          )}
          {canReach("/app/preflight") && (
            <CommandItem
              onSelect={() => go("/app/preflight")}
              keywords={["checks", "go", "ready"]}
            >
              <ClipboardCheckIcon /> Preflight checks
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Actions">
          {canReach("/app/prize-desk") && (
            <CommandItem
              onSelect={() => go("/app/prize-desk")}
              keywords={["scan", "redeem", "badge", "wallet"]}
            >
              <ScanLineIcon /> Verify a badge…
            </CommandItem>
          )}
          {canReach("/app/routes") && (
            <CommandItem
              onSelect={() => go("/app/routes")}
              keywords={["new", "create", "checkpoint"]}
            >
              <PlusIcon /> Add a checkpoint…
            </CommandItem>
          )}
          {canReach("/app/team") && (
            <CommandItem
              onSelect={() => go("/app/team")}
              keywords={["staff", "operator", "invite"]}
            >
              <UserPlus2Icon /> Invite a teammate…
            </CommandItem>
          )}
        </CommandGroup>

        {data.checkpoints.length > 0 && canReach("/app/routes") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Checkpoints">
              {data.checkpoints.map((cp) => {
                const meta =
                  checkpointStatusMeta[cp.status as CheckpointStatusValue] ??
                  checkpointStatusMeta.offline
                return (
                  <CommandItem
                    key={cp.id}
                    onSelect={() => go(`/app/routes?cp=${cp.id}`)}
                    keywords={[cp.sponsorName ?? "", meta.label]}
                  >
                    <MapPinnedIcon />
                    <span className="flex-1">{cp.name}</span>
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className={`size-1.5 rounded-full ${
                          statusDot[cp.status as CheckpointStatusValue] ??
                          statusDot.offline
                        }`}
                      />
                      {cp.sponsorName ?? meta.label}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </>
        )}

        {data.sponsors.length > 0 && canReach("/app/sponsors") && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sponsors">
              {data.sponsors.map((s) => (
                <CommandItem
                  key={s.id}
                  onSelect={() => go(`/app/sponsors?s=${s.id}`)}
                  keywords={[s.tier]}
                >
                  <TicketIcon />
                  <span className="flex-1">{s.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {s.tier}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
