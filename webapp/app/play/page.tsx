"use client"

import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MapPinIcon,
  TrophyIcon,
} from "lucide-react"

const benefits = [
  {
    icon: MapPinIcon,
    title: "Check in at any booth",
    body: "Scan the NFC tag or QR code to claim that checkpoint. No app install.",
  },
  {
    icon: ArrowRightIcon,
    title: "Follow the clue chain",
    body: "Each checkpoint reveals what the next one is — and who runs it.",
  },
  {
    icon: TrophyIcon,
    title: "Finish, mint, redeem",
    body: "Close the loop to mint your finisher badge and unlock the prize desk.",
  },
]

export default function PlayLanding() {

  return (
    <main className="play-landing relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 size-[40rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.35),transparent_60%)] blur-2xl" />
        <div className="absolute -right-32 -bottom-24 size-[40rem] rounded-full bg-[radial-gradient(circle,oklch(72%_0.18_320_/_0.28),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md border border-border bg-card/60">
            <span className="block size-1.5 rounded-full bg-primary shadow-[0_0_10px_oklch(73%_0.17_296_/_0.7)]" />
          </span>
          <span className="text-[13px] font-medium tracking-tight">
            TreasureLoop
          </span>
        </Link>
        <span className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
          Player
        </span>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md flex-col justify-between px-5 pt-12 pb-10">
        <div className="grid gap-7">
          <div className="grid gap-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
              ETH Cluj 2026
            </p>
            <h1 className="font-heading text-[44px] leading-[0.95] font-medium tracking-tight">
              Hunt the floor,
              <br />
              mint the loop.
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Connect your wallet, scan the opening marker, and chase the
              clue between staffed sponsor checkpoints. Closing the loop
              mints your finisher badge.
            </p>
          </div>

          <div className="grid gap-4">
            {benefits.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="grid grid-cols-[24px_1fr] items-start gap-3"
              >
                <span className="mt-1 grid size-6 place-items-center rounded-md border border-border bg-card/60 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <ConnectButton.Custom>
            {({ openConnectModal, account, chain, mounted }) => {
              const connected = mounted && !!account && !!chain
              if (!mounted) {
                return (
                  <div
                    aria-hidden
                    className="h-12 w-full rounded-xl bg-gradient-to-r from-primary via-primary to-fuchsia-400 opacity-60"
                  />
                )
              }
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="group relative inline-flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-primary via-primary to-fuchsia-400 text-[15px] font-medium text-primary-foreground shadow-[0_12px_32px_-8px_oklch(56%_0.18_286_/_0.5)] transition-transform hover:-translate-y-px"
                  >
                    Connect wallet to play
                    <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </button>
                )
              }
              return (
                <Link
                  href="/play/scan"
                  className="group relative inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-primary to-fuchsia-400 text-[15px] font-medium text-primary-foreground shadow-[0_12px_32px_-8px_oklch(56%_0.18_286_/_0.5)] transition-transform hover:-translate-y-px"
                >
                  <CheckCircle2Icon className="size-4" />
                  Start the hunt
                  <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )
            }}
          </ConnectButton.Custom>

          <p className="text-center text-[11px] text-muted-foreground">
            We never charge gas to play. Mint happens on completion.
          </p>

          <div className="flex items-center justify-center gap-4 pt-3 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            <span>Base Sepolia</span>
            <span className="size-0.5 rounded-full bg-muted-foreground/40" />
            <span>5 checkpoints</span>
            <span className="size-0.5 rounded-full bg-muted-foreground/40" />
            <span>~45 min</span>
          </div>
        </div>
      </div>
    </main>
  )
}
