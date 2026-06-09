"use client"

import Link from "next/link"
import { ArrowLeftIcon, QrCodeIcon, ScanLineIcon } from "lucide-react"

import { checkpoints } from "@/lib/mock-data"

export default function ScanPage() {
  const next = checkpoints[2] // Hardware Vault as the next stop in the mock flow

  return (
    <main className="play-scan relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.3),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Back
        </Link>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Step 3 of 5
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-8 px-5 pt-10 pb-12">
        <div className="grid gap-3">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            Next checkpoint
          </p>
          <h1 className="font-heading text-[36px] leading-tight font-medium tracking-tight">
            {next.name}
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {next.clue}
          </p>
          <p className="text-xs text-muted-foreground/70">
            Operated by {next.sponsor} · {next.area}
          </p>
        </div>

        <div className="relative grid place-items-center rounded-3xl border border-border bg-card/30 p-8">
          <div className="absolute inset-x-8 top-8 grid grid-cols-2 justify-between">
            <span className="size-6 border-t border-l border-primary/50" />
            <span className="size-6 justify-self-end border-t border-r border-primary/50" />
          </div>
          <div className="absolute inset-x-8 bottom-8 grid grid-cols-2 justify-between">
            <span className="size-6 border-b border-l border-primary/50" />
            <span className="size-6 justify-self-end border-b border-r border-primary/50" />
          </div>
          <div className="relative grid size-44 place-items-center">
            <ScanLineIcon className="size-12 text-primary/70" />
            <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Hold your phone over the booth&apos;s NFC tag
          </p>
        </div>

        <div className="grid gap-2">
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-card/40 text-sm font-medium text-foreground transition-colors hover:bg-card/60"
          >
            <QrCodeIcon className="size-4" />
            Scan a QR code instead
          </button>
          <Link
            href="/play/progress"
            className="text-center text-xs text-muted-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
          >
            View your progress
          </Link>
        </div>
      </div>
    </main>
  )
}
