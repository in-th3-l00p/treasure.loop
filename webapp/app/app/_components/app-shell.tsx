"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"
import {
  GaugeIcon,
  GiftIcon,
  LifeBuoyIcon,
  MapPinnedIcon,
  RouteIcon,
  SearchIcon,
  SettingsIcon,
  ShieldCheckIcon,
  TicketIcon,
  UsersIcon,
} from "lucide-react"

import { event } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

import { CommandPalette } from "./command-palette"

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
  items,
  reachable,
  isActive,
}: {
  label: string
  items: { name: string; href: string; icon: React.ComponentType<{ className?: string }> }[]
  reachable: Set<string>
  isActive: (href: string) => boolean
}) {
  const visible = items.filter((i) => reachable.has(i.href) || !reachableKnowsAbout(i.href, reachable))
  if (visible.length === 0) return null
  return (
    <div className="grid gap-0.5">
      <p className="px-2 pt-4 pb-1 text-[11px] text-sidebar-foreground/35">
        {label}
      </p>
      {visible.map((item) => (
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
  )
}

// If `reachable` was built from APP_ROUTES, it only mentions routes whose
// policy was declared. For routes the policy module doesn't know about
// (e.g. /app/settings) we keep them visible by default — same as the
// middleware fallback.
function reachableKnowsAbout(href: string, reachable: Set<string>): boolean {
  return reachable.has(href) || Array.from(reachable).some((h) => href.startsWith(`${h}/`))
}

export function AppShell({
  children,
  reachable,
}: {
  children: React.ReactNode
  reachable: Set<string>
}) {
  const pathname = usePathname()
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const cmdOrCtrl = e.metaKey || e.ctrlKey
      if (cmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletteOpen((prev) => !prev)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

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
          <OrganizationSwitcher
            hidePersonal
            afterCreateOrganizationUrl="/app"
            afterSelectOrganizationUrl="/app"
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger:
                  "w-full px-2 py-2 rounded-md hover:bg-sidebar-accent transition-colors",
                organizationPreviewMainIdentifier:
                  "text-[13px] text-sidebar-foreground truncate",
                organizationPreviewSecondaryIdentifier:
                  "text-[11px] text-sidebar-foreground/45 truncate",
                organizationSwitcherTriggerIcon:
                  "text-sidebar-foreground/40 size-3",
              },
            }}
          />
        </div>

        <div className="px-3 pt-3">
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-2 py-1.5 text-left text-[12px] text-sidebar-foreground/55 transition-colors hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            <SearchIcon className="size-3.5 text-sidebar-foreground/40" />
            <span className="flex-1">Search</span>
            <Kbd>⌘K</Kbd>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-4">
          <NavSection
            label="Manage"
            items={primaryNav}
            reachable={reachable}
            isActive={isActive}
          />
          <NavSection
            label="Operations"
            items={opsNav}
            reachable={reachable}
            isActive={isActive}
          />
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
          <div className="mt-3 flex items-center gap-2.5 px-2 pt-3">
            <UserButton
              appearance={{
                elements: {
                  userButtonAvatarBox: "size-7",
                  userButtonOuterIdentifier:
                    "text-[13px] text-sidebar-foreground",
                  userButtonBox: "flex-row-reverse",
                },
              }}
              showName
            />
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-4 border-b border-border bg-background/85 px-6 backdrop-blur-md lg:px-10">
          <Crumb pathname={pathname} />
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-border px-2 py-1 text-muted-foreground transition-colors hover:border-border hover:text-foreground lg:flex"
            >
              <SearchIcon className="size-3" />
              <span>Jump to…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Live rehearsal
            </span>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </main>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        reachable={reachable}
      />
    </div>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-border bg-background/40 px-1 font-mono text-[10px] text-muted-foreground">
      {children}
    </span>
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
