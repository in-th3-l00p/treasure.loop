import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, CalendarIcon, MapPinIcon } from "lucide-react"

import { listPublicEvents, type PublicEventCard } from "@/lib/events-public"
import { formatDateRange } from "@/lib/format"
import { networkLabel } from "@/lib/play-client"

export const metadata: Metadata = {
  title: "Explore · TreasureLoop",
  description:
    "Browse live and upcoming TreasureLoop hunts. Pick an event, scan the floor, and mint your finisher badge.",
}

export default async function ExplorePage() {
  const events = await listPublicEvents()

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 size-[44rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-6 pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-md border border-border bg-card/60">
              <span className="block size-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(73%_0.17_296_/_0.7)]" />
            </span>
            <span className="text-[13px] font-medium tracking-tight">
              TreasureLoop
            </span>
          </Link>
          <Link
            href="/play"
            className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground"
          >
            Your events →
          </Link>
        </header>

        <div className="mx-auto grid max-w-2xl gap-3 pt-16 pb-12 text-center sm:pt-20">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Discover hunts
          </p>
          <h1 className="font-heading text-[40px] leading-[1.02] font-medium tracking-tight sm:text-[52px]">
            Explore events
          </h1>
          <p className="mx-auto max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Live and upcoming TreasureLoop hunts. Pick one, scan the staffed
            checkpoints, solve the clue chain, and mint your finisher badge.
          </p>
        </div>

        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function EventCard({ event }: { event: PublicEventCard }) {
  const dates = formatDateRange(event.startsAt, event.endsAt)

  return (
    <Link
      href={`/e/${event.slug}`}
      className="group grid h-full grid-rows-[auto_1fr] overflow-hidden rounded-2xl border border-border bg-card/40 transition-colors hover:border-primary/40 hover:bg-card/60 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <CoverImage url={event.coverImageUrl} name={event.name} />

      <div className="grid content-start gap-3 p-4">
        <div className="flex items-center gap-2">
          <StatusChip status={event.status} />
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            {networkLabel(event.network)}
          </span>
        </div>

        <div className="grid gap-1.5">
          <h2 className="font-heading text-xl leading-tight font-medium tracking-tight">
            {event.name}
          </h2>
          {event.summary && (
            <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {event.summary}
            </p>
          )}
        </div>

        <div className="mt-1 grid gap-1.5 text-xs text-muted-foreground">
          {dates && (
            <span className="flex items-center gap-1.5">
              <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
              {dates}
            </span>
          )}
          {event.venue && (
            <span className="flex items-center gap-1.5">
              <MapPinIcon className="size-3.5 shrink-0 text-muted-foreground/70" />
              <span className="truncate">{event.venue}</span>
            </span>
          )}
        </div>

        <span className="mt-1 flex items-center gap-1 text-sm font-medium text-primary">
          View event
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}

function CoverImage({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return (
      // Cover URLs are arbitrary remote hosts not configured for
      // next/image, so a plain img keeps the build host-agnostic.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="aspect-[16/9] w-full object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="relative grid aspect-[16/9] w-full place-items-center overflow-hidden bg-[radial-gradient(circle_at_30%_20%,oklch(73%_0.17_296_/_0.45),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(60%_0.15_270_/_0.4),transparent_55%)]">
      <span className="font-heading text-5xl font-medium text-foreground/80">
        {name.charAt(0).toUpperCase()}
      </span>
    </div>
  )
}

function StatusChip({ status }: { status: string }) {
  const live = status.toLowerCase() === "live"
  return (
    <span
      className={
        live
          ? "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-emerald-300 uppercase"
          : "inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2 py-0.5 font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase"
      }
    >
      {live && (
        <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_oklch(75%_0.18_155_/_0.8)]" />
      )}
      {status}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto grid max-w-md gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-16 text-center">
      <p className="font-heading text-xl font-medium tracking-tight">
        No public events yet
      </p>
      <p className="text-sm leading-relaxed text-muted-foreground">
        There are no hunts listed right now. Check back soon, or talk to an
        organizer about running one at your next conference.
      </p>
      <Link
        href="/"
        className="mt-2 text-sm font-medium text-primary hover:underline"
      >
        Back to home
      </Link>
    </div>
  )
}
