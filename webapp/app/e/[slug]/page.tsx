import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  MapPinIcon,
  RouteIcon,
  ScanLineIcon,
  TrophyIcon,
  UsersIcon,
} from "lucide-react"

import { getPublicEventCardBySlug } from "@/lib/events-public"
import { formatDateRange } from "@/lib/format"
import { networkLabel } from "@/lib/play-client"
import { getPublicEvent } from "@/lib/player-store"

const howItWorks = [
  {
    icon: ScanLineIcon,
    title: "Scan staffed checkpoints",
    body: "Hold your phone to the NFC tag or scan the QR at each booth to claim it. No app install.",
  },
  {
    icon: RouteIcon,
    title: "Solve the clue chain",
    body: "Every checkpoint reveals what the next one is, and who runs it. Follow the route across the floor.",
  },
  {
    icon: UsersIcon,
    title: "Pair up to progress",
    body: "Some clues split a fragment between two players, so strangers have to find each other.",
  },
  {
    icon: TrophyIcon,
    title: "Mint your finisher badge",
    body: "Close the loop to mint an on-chain badge to your wallet and unlock the prize desk.",
  },
]

export async function generateMetadata({
  params,
}: PageProps<"/e/[slug]">): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEventCardBySlug(slug)
  if (!event) return { title: "Event not found · TreasureLoop" }
  return {
    title: `${event.name} · TreasureLoop`,
    description: event.summary ?? undefined,
  }
}

export default async function EventDetailPage({
  params,
}: PageProps<"/e/[slug]">) {
  const { slug } = await params
  const event = await getPublicEventCardBySlug(slug)
  if (!event) notFound()

  const detail = await getPublicEvent(event.id)
  const checkpointCount = detail?.checkpoints.length ?? null
  const teaser = (detail?.checkpoints ?? [])
    .slice(0, 5)
    .map((cp) => cp.name)
  const moreCheckpoints =
    checkpointCount !== null ? Math.max(0, checkpointCount - teaser.length) : 0
  const dates = formatDateRange(event.startsAt, event.endsAt)
  const live = event.status.toLowerCase() === "live"

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 size-[44rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-5xl px-5 pt-6 pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/explore"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Explore
          </Link>
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            <StatusChip status={event.status} />
            {networkLabel(event.network)}
          </span>
        </header>

        <div className="grid gap-8 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-10">
          <div className="grid gap-6 lg:order-2">
            <CoverImage url={event.coverImageUrl} name={event.name} />
          </div>

          <div className="grid content-start gap-5 lg:order-1">
            <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
              {live ? "Live now" : "Treasure hunt"}
            </p>
            <h1 className="font-heading text-[38px] leading-[1.03] font-medium tracking-tight sm:text-[48px]">
              {event.name}
            </h1>
            {event.summary && (
              <p className="max-w-prose text-base leading-relaxed text-muted-foreground">
                {event.summary}
              </p>
            )}

            <dl className="grid gap-3 pt-1 sm:grid-cols-2">
              {dates && (
                <Fact icon={CalendarIcon} label="When" value={dates} />
              )}
              {event.venue && (
                <Fact icon={MapPinIcon} label="Where" value={event.venue} />
              )}
              <Fact
                icon={ScanLineIcon}
                label="Checkpoints"
                value={
                  checkpointCount !== null
                    ? `${checkpointCount} to solve`
                    : "Routed on arrival"
                }
              />
              <Fact
                icon={TrophyIcon}
                label="Network"
                value={networkLabel(event.network)}
              />
            </dl>

            <div className="grid gap-3 pt-2 sm:flex sm:items-center">
              <Link
                href={`/e/${event.slug}/play`}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_0_24px_oklch(73%_0.17_296_/_0.35)] transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
              >
                Play the hunt
                <ArrowRightIcon className="size-4" />
              </Link>
              <span className="text-center text-xs text-muted-foreground sm:text-left">
                No app install. We never charge gas to play.
              </span>
            </div>
          </div>
        </div>

        <section className="grid gap-6 pt-16">
          <div className="grid gap-2">
            <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
              How it works
            </p>
            <h2 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
              Scan the floor, close the loop.
            </h2>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {howItWorks.map(({ icon: Icon, title, body }) => (
              <li
                key={title}
                className="grid grid-cols-[28px_1fr] items-start gap-3 rounded-2xl border border-border bg-card/40 p-4"
              >
                <span className="mt-0.5 grid size-7 place-items-center rounded-md border border-border bg-card/60 text-primary">
                  <Icon className="size-4" />
                </span>
                <div className="grid gap-1">
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {teaser.length > 0 && (
          <section className="grid gap-4 pt-14">
            <div className="grid gap-2">
              <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
                The route
              </p>
              <h2 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
                A taste of the checkpoints
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {teaser.map((name) => (
                <span
                  key={name}
                  className="rounded-full border border-border bg-secondary/30 px-3 py-1.5 text-xs text-muted-foreground"
                >
                  {name}
                </span>
              ))}
              {moreCheckpoints > 0 && (
                <span className="rounded-full border border-dashed border-border px-3 py-1.5 text-xs text-primary/80">
                  +{moreCheckpoints} more
                </span>
              )}
            </div>
            <p className="max-w-prose text-xs text-muted-foreground">
              Clues unlock in order as you scan each staffed checkpoint —
              start the hunt to get routed from the opening marker.
            </p>
          </section>
        )}

        <div className="mt-16 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card/40 px-6 py-10 text-center">
          <p className="font-heading text-xl font-medium tracking-tight sm:text-2xl">
            Ready to play {event.name}?
          </p>
          <Link
            href={`/e/${event.slug}/play`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-medium text-primary-foreground shadow-[0_0_24px_oklch(73%_0.17_296_/_0.35)] transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none"
          >
            Play the hunt
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </div>
    </main>
  )
}

function Fact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CalendarIcon
  label: string
  value: string
}) {
  return (
    <div className="grid grid-cols-[28px_1fr] items-start gap-2.5">
      <span className="mt-0.5 grid size-7 place-items-center rounded-md border border-border bg-card/60 text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="grid gap-0.5">
        <dt className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
          {label}
        </dt>
        <dd className="text-sm font-medium">{value}</dd>
      </div>
    </div>
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
        className="aspect-[16/10] w-full rounded-2xl border border-border object-cover"
      />
    )
  }
  return (
    <div className="relative grid aspect-[16/10] w-full place-items-center overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_30%_20%,oklch(73%_0.17_296_/_0.45),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(60%_0.15_270_/_0.4),transparent_55%)]">
      <span className="font-heading text-7xl font-medium text-foreground/80">
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
