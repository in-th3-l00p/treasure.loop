"use client"

import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  GiftIcon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react"
import { useAccount } from "wagmi"

export default function ClaimPage() {
  const { isConnected, address } = useAccount()

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null

  return (
    <main className="play-claim relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 size-[40rem] -translate-x-1/2 rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,oklch(73%_0.17_296_/_0.35),oklch(72%_0.18_320_/_0.25),oklch(73%_0.17_296_/_0.35))] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play/progress"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Progress
        </Link>
        <span className="font-mono text-[10px] tracking-[0.14em] text-emerald-300/90 uppercase">
          Loop complete
        </span>
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-7 px-5 pt-10 pb-12">
        <div className="grid gap-3 text-center">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            ETH Cluj 2026
          </p>
          <h1 className="font-heading text-[40px] leading-tight font-medium tracking-tight">
            You closed the loop.
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            Mint your finisher badge and show it at the prize desk to
            unlock your rewards.
          </p>
        </div>

        <div className="relative grid place-items-center rounded-3xl border border-primary/40 bg-gradient-to-b from-primary/10 to-fuchsia-400/5 p-8">
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_30%,oklch(73%_0.17_296_/_0.2),transparent_60%)]" />
          <div className="relative grid gap-5 text-center">
            <div className="relative mx-auto grid size-28 place-items-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary via-fuchsia-400 to-primary opacity-70 blur-xl" />
              <div className="relative grid size-24 place-items-center rounded-full border border-primary/50 bg-gradient-to-br from-primary/80 to-fuchsia-400/80 shadow-[0_20px_40px_-12px_oklch(73%_0.17_296_/_0.6)]">
                <SparklesIcon className="size-9 text-white" />
              </div>
            </div>
            <div className="grid gap-1">
              <p className="font-heading text-xl font-medium tracking-tight">
                Cluj Loop Finisher
              </p>
              <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
                Edition of 142 · Base Sepolia
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <ConnectButton.Custom>
            {({ openConnectModal, account, chain, mounted }) => {
              const ready = mounted
              const connected = ready && !!account && !!chain
              if (!connected) {
                return (
                  <button
                    type="button"
                    onClick={openConnectModal}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 text-[15px] font-medium text-primary-foreground transition-transform hover:-translate-y-px"
                  >
                    <WalletIcon className="size-4" />
                    Connect wallet to mint
                  </button>
                )
              }
              return (
                <button
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-fuchsia-400 text-[15px] font-medium text-primary-foreground transition-transform hover:-translate-y-px"
                >
                  <SparklesIcon className="size-4" />
                  Mint finisher badge
                </button>
              )
            }}
          </ConnectButton.Custom>

          {isConnected && shortAddress && (
            <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle2Icon className="size-3 text-emerald-400" />
              Minting to {shortAddress}
            </p>
          )}
        </div>

        <div className="grid gap-3 rounded-2xl border border-border bg-card/30 p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg border border-border bg-card/60 text-amber-300">
              <GiftIcon className="size-4" />
            </div>
            <div>
              <p className="text-sm font-medium">Then visit the prize desk</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                Main hall exit · open until 18:00. Staff verify your badge
                on-chain and hand out the physical reward tier you&apos;ve
                earned.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
