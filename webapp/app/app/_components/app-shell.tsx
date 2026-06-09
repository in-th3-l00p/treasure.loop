"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BellIcon,
  CalendarRangeIcon,
  GaugeIcon,
  GiftIcon,
  LifeBuoyIcon,
  MapPinnedIcon,
  RouteIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { event } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

const primaryNav = [
  { name: "Overview", href: "/app", icon: GaugeIcon },
  { name: "Routes", href: "/app/routes", icon: RouteIcon },
  { name: "Checkpoints", href: "/app/checkpoints", icon: MapPinnedIcon },
  { name: "Sponsors", href: "/app/sponsors", icon: TicketIcon },
  { name: "Players", href: "/app/players", icon: UsersIcon },
]

const opsNav = [
  { name: "Prize desk", href: "/app/prize-desk", icon: GiftIcon },
  { name: "Verification", href: "/app/verification", icon: ShieldCheckIcon },
]

const footerNav = [
  { name: "Settings", href: "/app/settings", icon: SettingsIcon },
  { name: "Support", href: "/app/support", icon: LifeBuoyIcon },
]

function NavItem({
  href,
  icon: Icon,
  active,
  children,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      data-active={active || undefined}
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground/72 transition-colors",
        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
        "data-[active]:bg-sidebar-accent data-[active]:text-sidebar-foreground"
      )}
    >
      <Icon className="size-4 text-sidebar-foreground/55 group-hover:text-sidebar-foreground group-data-[active]:text-primary" />
      <span className="flex-1">{children}</span>
    </Link>
  )
}

function NavSection({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-0.5">
      <p className="px-2.5 pt-3 pb-1 font-mono text-[10px] font-semibold tracking-[0.16em] text-sidebar-foreground/40 uppercase">
        {label}
      </p>
      {children}
    </div>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/app") return pathname === "/app"
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="product-shell flex min-h-screen">
      <aside className="hidden w-[244px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <span className="grid size-8 place-items-center rounded-lg border border-sidebar-border bg-sidebar-accent text-primary">
            <span className="block size-2 rounded-full bg-primary shadow-[0_0_10px_oklch(73%_0.17_296_/_0.7)]" />
          </span>
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-[13px] font-semibold tracking-tight text-sidebar-foreground">
              TreasureLoop
            </span>
            <span className="text-[11px] text-sidebar-foreground/55">
              Organizer console
            </span>
          </div>
        </div>

        <Separator className="bg-sidebar-border" />

        <div className="px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/60 px-2.5 py-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary/15 text-[10px] font-semibold text-primary">
              EC
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[12px] font-medium text-sidebar-foreground">
                ETH Cluj 2026
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/50">
                {event.dates}
              </span>
            </span>
            <CalendarRangeIcon className="size-3.5 text-sidebar-foreground/40" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavSection label="Manage">
            {primaryNav.map((item) => (
              <NavItem
                key={item.name}
                href={item.href}
                icon={item.icon}
                active={isActive(item.href)}
              >
                {item.name}
              </NavItem>
            ))}
          </NavSection>

          <NavSection label="Operations">
            {opsNav.map((item) => (
              <NavItem
                key={item.name}
                href={item.href}
                icon={item.icon}
                active={isActive(item.href)}
              >
                {item.name}
              </NavItem>
            ))}
          </NavSection>
        </nav>

        <div className="border-t border-sidebar-border px-3 py-3">
          <div className="grid gap-0.5 pb-3">
            {footerNav.map((item) => (
              <NavItem
                key={item.name}
                href={item.href}
                icon={item.icon}
                active={isActive(item.href)}
              >
                {item.name}
              </NavItem>
            ))}
          </div>
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <Avatar className="size-7">
              <AvatarFallback className="bg-primary/15 text-[11px] font-semibold text-primary">
                CT
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[12px] font-medium text-sidebar-foreground">
                Catalin Tisca
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/50">
                Organizer · {event.organizer}
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b border-border bg-background/85 px-5 backdrop-blur-md lg:px-7">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="grid size-7 place-items-center rounded-md border border-border bg-sidebar-accent text-primary lg:hidden"
            >
              <span className="block size-1.5 rounded-full bg-primary" />
            </Link>
            <Crumb pathname={pathname} />
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="hidden h-7 rounded-full border border-border bg-secondary/60 px-2.5 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase sm:inline-flex"
            >
              <span className="status-dot mr-1.5 text-emerald-400" />
              {event.status}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-muted-foreground hover:text-foreground"
            >
              <BellIcon className="size-4" />
            </Button>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </main>
    </div>
  )
}

function Crumb({ pathname }: { pathname: string }) {
  const segments = pathname.split("/").filter(Boolean)
  const label =
    segments.length === 1
      ? "Overview"
      : segments
          .slice(1)
          .map((s) =>
            s.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
          )
          .join(" / ")

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{event.name.split(":")[0]}</span>
      <span className="text-muted-foreground/40">/</span>
      <span className="font-medium text-foreground">{label}</span>
    </div>
  )
}
