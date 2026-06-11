import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  SparklesIcon,
  TrophyIcon,
} from "lucide-react"

import { getPublicEventCardBySlug } from "@/lib/events-public"
import { shortAddress } from "@/lib/format"
import { getEventLeaderboard, type LeaderboardRow } from "@/lib/leaderboard"

export async function generateMetadata({
  params,
}: PageProps<"/e/[slug]/leaderboard">): Promise<Metadata> {
  const { slug } = await params
  const event = await getPublicEventCardBySlug(slug)
  if (!event) return { title: "Event not found · TreasureLoop" }
  return {
    title: `Leaderboard · ${event.name} · TreasureLoop`,
    description: `Who's ahead in the ${event.name} treasure hunt.`,
  }
}

export default async function EventLeaderboardPage({
  params,
}: PageProps<"/e/[slug]/leaderboard">) {
  const { slug } = await params
  const event = await getPublicEventCardBySlug(slug)
  if (!event) notFound()

  const rows = await getEventLeaderboard(event.id)

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 size-[44rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-5 pt-6 pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            href={`/e/${event.slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            {event.name}
          </Link>
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Leaderboard
          </span>
        </header>

        <section className="grid gap-2 pt-12">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Leaderboard
          </p>
          <h1 className="font-heading text-[32px] leading-[1.05] font-medium tracking-tight sm:text-[40px]">
            {event.name}
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
            Closers first by finish time, then everyone else by how far
            they&rsquo;ve made it around the loop.
          </p>
        </section>

        <section className="pt-10">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-14 text-center">
              <span className="grid size-10 place-items-center rounded-full border border-border bg-card/60 text-muted-foreground">
                <TrophyIcon className="size-4" />
              </span>
              <p className="text-sm text-muted-foreground">
                No players yet — be the first to start the hunt.
              </p>
              <Link
                href={`/e/${event.slug}/play`}
                className="mt-1 text-xs text-primary underline-offset-4 hover:underline"
              >
                Start the hunt →
              </Link>
            </div>
          ) : (
            <ol className="grid gap-2.5">
              {rows.map((row) => (
                <LeaderboardEntry key={row.wallet} row={row} />
              ))}
            </ol>
          )}
        </section>
      </div>
    </main>
  )
}

function LeaderboardEntry({ row }: { row: LeaderboardRow }) {
  const name =
    row.displayName ??
    (row.handle ? `@${row.handle}` : shortAddress(row.wallet))
  const pct = row.total > 0 ? (row.scannedCount / row.total) * 100 : 0

  const inner = (
    <div className="grid grid-cols-[28px_44px_1fr] items-center gap-3 rounded-2xl border border-border bg-card/40 p-3.5 transition-colors group-hover:border-primary/40 group-hover:bg-card/60">
      <span
        className={
          row.rank <= 3
            ? "text-center font-heading text-lg font-medium tabular-nums text-primary"
            : "text-center font-mono text-xs tabular-nums text-muted-foreground"
        }
      >
        {row.rank}
      </span>
      <Avatar
        url={row.avatarUrl}
        name={row.displayName}
        handle={row.handle}
        wallet={row.wallet}
      />
      <div className="grid min-w-0 gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{name}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {row.finished && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-emerald-300 uppercase">
                <CheckCircle2Icon className="size-2.5" />
                Finished
              </span>
            )}
            {row.minted && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] tracking-[0.1em] text-amber-300 uppercase">
                <SparklesIcon className="size-2.5" />
                Minted
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary/50">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
            {row.scannedCount} / {row.total}
          </span>
        </div>
      </div>
    </div>
  )

  if (row.handle) {
    return (
      <li>
        <Link href={`/u/${row.handle}`} className="group block">
          {inner}
        </Link>
      </li>
    )
  }
  return <li className="group">{inner}</li>
}

function Avatar({
  url,
  name,
  handle,
  wallet,
}: {
  url: string | null
  name: string | null
  handle: string | null
  wallet: string
}) {
  const initial = (name ?? handle ?? wallet.replace(/^0x/i, "") ?? "?")
    .charAt(0)
    .toUpperCase()
  if (url) {
    return (
      // Avatar URLs are arbitrary remote hosts not configured for
      // next/image, so a plain img keeps the build host-agnostic.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="size-11 shrink-0 rounded-xl border border-border object-cover"
      />
    )
  }
  return (
    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_30%_20%,oklch(73%_0.17_296_/_0.45),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(60%_0.15_270_/_0.4),transparent_55%)]">
      <span className="font-heading text-lg font-medium text-foreground/80">
        {initial}
      </span>
    </div>
  )
}
