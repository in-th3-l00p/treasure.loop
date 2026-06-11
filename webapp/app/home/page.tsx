import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRightIcon, CompassIcon, UserRoundIcon } from "lucide-react"

import { formatDateRange } from "@/lib/format"
import { listPublicEvents } from "@/lib/events-public"
import { listMyEvents, type MyEvent } from "@/lib/event-rsvp"
import { getPlayAddress } from "@/lib/play-session"
import { getProfileByWallet } from "@/lib/player-profiles"

export const metadata: Metadata = { title: "Home · TreasureLoop" }

export default async function HomePage() {
  const wallet = await getPlayAddress()

  if (!wallet) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <Glow />
        <div className="relative mx-auto grid min-h-screen max-w-md place-items-center px-5">
          <div className="grid gap-4 text-center">
            <h1 className="font-heading text-4xl font-medium tracking-tight">
              Your hunts, in one place.
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connect your wallet to see the events you&apos;ve joined and the
              finisher badges you&apos;ve earned.
            </p>
            <div className="mt-2 grid gap-2">
              <Link
                href="/explore"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <CompassIcon className="size-4" />
                Explore events
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const [profile, myEvents, publicEvents] = await Promise.all([
    getProfileByWallet(wallet),
    listMyEvents(wallet),
    listPublicEvents(),
  ])

  const name =
    profile?.displayName ||
    (profile?.handle ? `@${profile.handle}` : null) ||
    `${wallet.slice(0, 6)}…${wallet.slice(-4)}`

  // Public events the player hasn't already joined — a light "discover more".
  const joined = new Set(myEvents.map((e) => e.id))
  const discover = publicEvents.filter((e) => !joined.has(e.id)).slice(0, 6)

  return (
    <main className="relative min-h-screen overflow-hidden pb-16">
      <Glow />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md border border-border bg-card/60">
            <span className="block size-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(73%_0.17_296_/_0.7)]" />
          </span>
          <span className="text-[13px] font-medium tracking-tight">
            TreasureLoop
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm text-muted-foreground">
          <Link href="/explore" className="transition-colors hover:text-foreground">
            Explore
          </Link>
          <Link
            href="/profile"
            className="flex items-center gap-1.5 transition-colors hover:text-foreground"
          >
            <UserRoundIcon className="size-3.5" />
            Profile
          </Link>
        </nav>
      </header>

      <div className="relative mx-auto grid w-full max-w-5xl gap-10 px-5 pt-10">
        <div className="grid gap-1">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Welcome back
          </p>
          <h1 className="font-heading text-3xl font-medium tracking-tight">
            {name}
          </h1>
        </div>

        <section className="grid gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">My events</h2>
            <span className="text-xs text-muted-foreground">
              {myEvents.length} joined
            </span>
          </div>
          {myEvents.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/20 p-8 text-center">
              <p className="text-sm text-muted-foreground">
                You haven&apos;t joined any events yet.
              </p>
              <Link
                href="/explore"
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                Explore events <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myEvents.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </section>

        {discover.length > 0 && (
          <section className="grid gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-sm font-medium">Discover more</h2>
              <Link
                href="/explore"
                className="text-xs text-primary hover:underline"
              >
                See all
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {discover.map((e) => (
                <EventCard
                  key={e.id}
                  event={{ ...e, status: null, rsvped: false, played: false }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function EventCard({
  event,
}: {
  event: Pick<
    MyEvent,
    "slug" | "name" | "summary" | "coverImageUrl" | "venue" | "startsAt" | "endsAt"
  > & { status?: MyEvent["status"] | null; rsvped?: boolean; played?: boolean }
}) {
  const dates = formatDateRange(event.startsAt, event.endsAt)
  const badge =
    event.played
      ? "Played"
      : event.status === "going"
        ? "Going"
        : event.status === "interested"
          ? "Interested"
          : null
  return (
    <Link
      href={`/e/${event.slug}`}
      className="group grid overflow-hidden rounded-2xl border border-border bg-card/30 transition-colors hover:border-primary/40"
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImageUrl}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center bg-[radial-gradient(circle_at_30%_20%,oklch(55%_0.18_296_/_0.55),oklch(20%_0.06_286)_70%)]">
            <span className="font-heading text-3xl text-white/80">
              {event.name.charAt(0)}
            </span>
          </div>
        )}
        {badge && (
          <span className="absolute top-2 right-2 rounded-full bg-background/80 px-2 py-0.5 font-mono text-[9px] tracking-[0.14em] text-primary uppercase backdrop-blur">
            {badge}
          </span>
        )}
      </div>
      <div className="grid gap-1.5 p-4">
        <h3 className="line-clamp-1 text-sm font-medium">{event.name}</h3>
        {event.summary && (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {event.summary}
          </p>
        )}
        <p className="mt-1 font-mono text-[10px] tracking-[0.12em] text-muted-foreground/70 uppercase">
          {[dates, event.venue].filter(Boolean).join(" · ")}
        </p>
      </div>
    </Link>
  )
}

function Glow() {
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute -top-32 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.18),transparent_60%)] blur-2xl" />
    </div>
  )
}
