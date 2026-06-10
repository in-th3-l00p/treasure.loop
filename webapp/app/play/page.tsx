"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { SiweMessage } from "siwe"
import { useAccount, useSignMessage } from "wagmi"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  Loader2Icon,
  MapPinIcon,
  TrophyIcon,
} from "lucide-react"

import { networkLabel } from "@/lib/play-client"
import {
  useLogout,
  usePlayEvent,
  useRequestNonce,
  useSession,
  useVerifySiwe,
} from "@/lib/play-hooks"

import { PlayCta } from "./_components/play-cta"

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

type SignState = "idle" | "preparing" | "signing" | "verifying"

export default function PlayLanding() {
  const router = useRouter()
  const { address, chainId, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const session = useSession()
  const { data: playEvent } = usePlayEvent()
  const requestNonce = useRequestNonce()
  const verifySiwe = useVerifySiwe()
  const logout = useLogout()

  const [signState, setSignState] = useState<SignState>("idle")
  const [error, setError] = useState<string | null>(null)

  const eventTitle = playEvent?.name.split(":")[0] ?? "TreasureLoop"
  const checkpointCount = playEvent?.checkpoints.length ?? null

  // Detect wallet ↔ session mismatch in render (no useEffect).
  const sessionAddress = session.data?.address ?? null
  const sessionMatches =
    !!sessionAddress &&
    !!address &&
    sessionAddress.toLowerCase() === address.toLowerCase()

  // If the wallet disconnected, or we connected with a different
  // wallet than the session, sign out. Event-driven via mutation, not
  // an effect.
  if (
    !logout.isPending &&
    sessionAddress &&
    (!isConnected || (address && !sessionMatches))
  ) {
    logout.mutate()
  }

  const runSiwe = useCallback(async () => {
    if (!address || !chainId) return
    setError(null)
    setSignState("preparing")
    try {
      const { nonce } = await requestNonce.mutateAsync()
      const message = new SiweMessage({
        domain:
          typeof window !== "undefined"
            ? window.location.host
            : "treasure.loop",
        address,
        statement:
          "Sign in to TreasureLoop. Your signature proves wallet ownership and does not authorize any transaction.",
        uri:
          typeof window !== "undefined"
            ? window.location.origin
            : "https://treasure.loop",
        version: "1",
        chainId,
        nonce,
        issuedAt: new Date().toISOString(),
      })
      const prepared = message.prepareMessage()
      setSignState("signing")
      const signature = await signMessageAsync({ message: prepared })
      setSignState("verifying")
      await verifySiwe.mutateAsync({ message: prepared, signature })
      router.push("/play/scan")
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Sign-in failed. Try again."
      setError(msg)
      setSignState("idle")
    }
  }, [address, chainId, requestNonce, signMessageAsync, verifySiwe, router])

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-24 size-[40rem] rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.3),transparent_60%)] blur-2xl" />
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
          {eventTitle}
        </span>
      </header>

      <div className="relative mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-md flex-col justify-between px-5 pt-12 pb-10">
        <div className="grid gap-7">
          <div className="grid gap-3">
            <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
              {eventTitle}
            </p>
            <h1 className="font-heading text-[44px] leading-[0.95] font-medium tracking-tight">
              Hunt the floor,
              <br />
              mint the loop.
            </h1>
            <p className="max-w-sm text-[15px] leading-relaxed text-muted-foreground">
              Connect your wallet, scan the opening marker, and chase the clue
              between staffed sponsor checkpoints. Closing the loop mints your
              finisher badge.
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
                    className="h-12 w-full rounded-xl bg-primary opacity-50"
                  />
                )
              }
              if (!connected) {
                return (
                  <PlayCta onClick={openConnectModal}>
                    Connect wallet to play
                    <ArrowRightIcon className="size-4" />
                  </PlayCta>
                )
              }
              if (sessionMatches) {
                return (
                  <PlayCta href="/play/scan">
                    <CheckCircle2Icon className="size-4" />
                    Start the hunt
                    <ArrowRightIcon className="size-4" />
                  </PlayCta>
                )
              }
              return (
                <PlayCta onClick={runSiwe} disabled={signState !== "idle"}>
                  {signState === "idle" ? (
                    <>
                      Sign in with your wallet
                      <ArrowRightIcon className="size-4" />
                    </>
                  ) : (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      {labelFor(signState)}
                    </>
                  )}
                </PlayCta>
              )
            }}
          </ConnectButton.Custom>

          {error && (
            <p className="text-center text-[11px] text-rose-300/90">{error}</p>
          )}

          <p className="text-center text-[11px] text-muted-foreground">
            We never charge gas to play. Mint happens on completion.
          </p>

          <div className="flex items-center justify-center gap-4 pt-3 font-mono text-[10px] tracking-[0.14em] text-muted-foreground/60 uppercase">
            {playEvent && <span>{networkLabel(playEvent.network)}</span>}
            {checkpointCount !== null && (
              <>
                <span className="size-0.5 rounded-full bg-muted-foreground/40" />
                <span>{checkpointCount} checkpoints</span>
              </>
            )}
            {playEvent?.venue && (
              <>
                <span className="size-0.5 rounded-full bg-muted-foreground/40" />
                <span>{playEvent.venue}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

function labelFor(state: SignState): string {
  switch (state) {
    case "preparing":
      return "Preparing message…"
    case "signing":
      return "Check your wallet…"
    case "verifying":
      return "Verifying signature…"
    default:
      return ""
  }
}
