"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronsUpDownIcon,
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
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] text-sidebar-foreground/65 transition-colors",
        "hover:text-sidebar-foreground",
        "data-[active]:text-sidebar-foreground"
      )}
    >
      <Icon className="size-3.5 text-sidebar-foreground/40 group-hover:text-sidebar-foreground/70 group-data-[active]:text-primary" />
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
      <p className="px-2 pt-4 pb-1 text-[11px] text-sidebar-foreground/35">
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
      <aside className="hidden w-[228px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <span className="grid size-6 place-items-center rounded-md bg-primary/15 text-primary">
            <span className="block size-1.5 rounded-full bg-primary" />
          </span>
          <span className="text-[13px] font-medium tracking-tight text-sidebar-foreground">
            TreasureLoop
          </span>
        </div>

        <div className="px-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-sidebar-accent"
          >
            <span className="grid size-6 shrink-0 place-items-center rounded bg-primary/12 text-[10px] font-medium text-primary">
              EC
            </span>
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-[13px] text-sidebar-foreground">
                ETH Cluj 2026
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/45">
                {event.dates}
              </span>
            </span>
            <ChevronsUpDownIcon className="size-3 text-sidebar-foreground/40" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-4">
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

        <div className="px-3 pb-4">
          <div className="grid gap-0.5">
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
          <div className="mt-3 flex items-center gap-2.5 px-2 pt-3 text-[13px]">
            <span className="grid size-6 place-items-center rounded-full bg-primary/15 text-[10px] font-medium text-primary">
              CT
            </span>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sidebar-foreground">
                Catalin Tisca
              </span>
              <span className="truncate text-[11px] text-sidebar-foreground/45">
                Organizer
              </span>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-md lg:px-10">
          <Crumb pathname={pathname} />
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live rehearsal
            </span>
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
    <div className="flex items-center gap-2 text-[13px]">
      <span className="text-muted-foreground">{event.name.split(":")[0]}</span>
      <span className="text-muted-foreground/40">/</span>
      <span className="text-foreground">{label}</span>
    </div>
  )
}
