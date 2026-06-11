import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeftIcon, ArrowRightIcon, TrophyIcon } from "lucide-react"

import { formatDateRange } from "@/lib/format"
import {
  getProfileByHandle,
  getProfileCollection,
} from "@/lib/player-profiles"

export async function generateMetadata({
  params,
}: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params
  const profile = await getProfileByHandle(handle)
  if (!profile) return { title: "Player not found · TreasureLoop" }
  const name = profile.displayName ?? `@${profile.handle}`
  return {
    title: `${name} · TreasureLoop`,
    description: profile.bio ?? undefined,
  }
}

export default async function PublicProfilePage({
  params,
}: PageProps<"/u/[handle]">) {
  const { handle } = await params
  const profile = await getProfileByHandle(handle)
  if (!profile) notFound()

  const badges = await getProfileCollection(profile.wallet)
  const name = profile.displayName ?? `@${profile.handle}`

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 size-[44rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.22),transparent_60%)] blur-2xl" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-5 pt-6 pb-20 sm:px-8">
        <header className="flex items-center justify-between">
          <Link
            href="/explore"
            className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3.5" />
            Explore
          </Link>
          <span className="font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
            Player profile
          </span>
        </header>

        <section className="flex flex-col items-center gap-5 pt-12 text-center sm:flex-row sm:items-center sm:gap-7 sm:text-left">
          <ProfileAvatar
            url={profile.avatarUrl}
            name={profile.displayName}
            handle={profile.handle}
          />
          <div className="grid gap-2">
            <h1 className="font-heading text-[32px] leading-[1.05] font-medium tracking-tight sm:text-[40px]">
              {name}
            </h1>
            {profile.handle && (
              <p className="font-mono text-[13px] tracking-[0.06em] text-primary">
                @{profile.handle}
              </p>
            )}
            {profile.bio && (
              <p className="max-w-prose pt-1 text-sm leading-relaxed text-muted-foreground">
                {profile.bio}
              </p>
            )}
          </div>
        </section>

        <section className="grid gap-5 pt-16">
          <div className="flex items-baseline justify-between gap-3">
            <div className="grid gap-1">
              <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
                Collection
              </p>
              <h2 className="font-heading text-2xl font-medium tracking-tight">
                Finisher badges
              </h2>
            </div>
            {badges.length > 0 && (
              <span className="font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase">
                {badges.length} earned
              </span>
            )}
          </div>

          {badges.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/30 px-6 py-12 text-center">
              <span className="grid size-10 place-items-center rounded-full border border-border bg-card/60 text-muted-foreground">
                <TrophyIcon className="size-4" />
              </span>
              <p className="text-sm text-muted-foreground">
                No finisher badges yet.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {badges.map((badge) => (
                <li key={`${badge.eventSlug}-${badge.tokenId ?? "x"}`}>
                  <Link
                    href={`/e/${badge.eventSlug}`}
                    className="group grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-2xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/40 hover:bg-card/60"
                  >
                    <BadgeTile />
                    <div className="grid gap-0.5">
                      <p className="truncate text-sm font-medium">
                        {badge.eventName}
                      </p>
                      <p className="font-mono text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                        {formatDateRange(badge.mintedAt, null) ?? "Minted"}
                        {badge.tokenId !== null && ` · #${badge.tokenId}`}
                      </p>
                    </div>
                    <ArrowRightIcon className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  )
}

function ProfileAvatar({
  url,
  name,
  handle,
}: {
  url: string | null
  name: string | null
  handle: string | null
}) {
  const initial = (name ?? handle ?? "?").charAt(0).toUpperCase()
  if (url) {
    return (
      // Avatar URLs are arbitrary remote hosts not configured for
      // next/image, so a plain img keeps the build host-agnostic.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="size-24 shrink-0 rounded-2xl border border-border object-cover"
      />
    )
  }
  return (
    <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-[radial-gradient(circle_at_30%_20%,oklch(73%_0.17_296_/_0.45),transparent_55%),radial-gradient(circle_at_80%_90%,oklch(60%_0.15_270_/_0.4),transparent_55%)]">
      <span className="font-heading text-4xl font-medium text-foreground/80">
        {initial}
      </span>
    </div>
  )
}

function BadgeTile() {
  return (
    <span className="grid size-11 place-items-center overflow-hidden rounded-xl border border-border bg-[radial-gradient(circle_at_30%_20%,oklch(73%_0.17_296_/_0.5),transparent_60%)] text-primary">
      <TrophyIcon className="size-4" />
    </span>
  )
}
