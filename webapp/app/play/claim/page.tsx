"use client"

import Link from "next/link"
import { useCallback, useState } from "react"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { type Hex, parseEventLogs } from "viem"
import { useAccount, usePublicClient, useWriteContract } from "wagmi"
import {
  AlertTriangleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  GiftIcon,
  Loader2Icon,
  SparklesIcon,
  WalletIcon,
} from "lucide-react"

import { BADGE_ABI, MOCK_CHAIN } from "@/lib/badge-contract"
import { explorerTxUrl, isAlreadyMinted, networkLabel } from "@/lib/play-client"
import {
  useConfirmMint,
  useMockMint,
  useOnchainBadgeHeld,
  usePlayEvent,
  useProgress,
  useRequestMintPermit,
} from "@/lib/play-hooks"

import { PlayCta } from "../_components/play-cta"

type MintState =
  | "idle"
  | "ineligible"
  | "rehearsal"
  | "ready"
  | "requesting-permit"
  | "awaiting-signature"
  | "confirming"
  | "recording"
  | "done"
  | "error"

export default function ClaimPage() {
  const { isConnected, address } = useAccount()
  const { data: progress, isLoading: loadingProgress, error: progressError } =
    useProgress()
  const { data: playEvent } = usePlayEvent()
  const { held: onchainHeld } = useOnchainBadgeHeld(address)
  const requestPermit = useRequestMintPermit()
  const confirmMint = useConfirmMint()
  const mockMintMutation = useMockMint()

  const {
    writeContractAsync,
    data: txHash,
    reset: resetWrite,
  } = useWriteContract()
  const publicClient = usePublicClient()

  const [state, setState] = useState<MintState>("idle")
  const [error, setError] = useState<string | null>(null)
  const [tokenId, setTokenId] = useState<number | null>(null)

  const eventTitle = playEvent?.name.split(":")[0] ?? "TreasureLoop"
  const network = playEvent?.network ?? "base-sepolia"
  const rehearsal = playEvent?.rehearsal ?? false

  const shortAddress = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null

  // Reset to a state derived from current progress on every render —
  // no effect, no flicker. Async transitions below override it.
  //
  // On-chain truth wins in the already-minted direction: if the wallet
  // holds the badge we render "done" even when the server DB has no
  // mint record (or failed to load), so a wiped/rolled-back DB can't
  // strand a player who already minted.
  const derivedState: MintState = (() => {
    if (isAlreadyMinted({ badgeMintedAt: progress?.badgeMintedAt, onchainHeld }))
      return "done"
    if (progressError) return "error"
    if (loadingProgress) return "idle"
    if (!progress) return "idle"
    if (!progress.finished) return "ineligible"
    // Dress-rehearsal: the player finished, but no badge is minted on
    // chain. We surface a clear rehearsal state instead of a mint CTA so
    // the screen never implies an on-chain mint that won't happen.
    if (rehearsal) return "rehearsal"
    return "ready"
  })()

  // Only overwrite the local state when the user isn't mid-mint.
  const effective: MintState =
    state === "requesting-permit" ||
    state === "awaiting-signature" ||
    state === "confirming" ||
    state === "recording"
      ? state
      : state === "done"
        ? "done"
        : derivedState

  const mint = useCallback(async () => {
    setError(null)
    setTokenId(null)
    setState("requesting-permit")
    try {
      const permit = await requestPermit.mutateAsync()
      setState("awaiting-signature")
      const hash = await writeContractAsync({
        address: permit.contract,
        abi: BADGE_ABI,
        functionName: "mint",
        args: [
          {
            player: permit.permit.player,
            chainId: BigInt(permit.permit.chainId),
            nonce: permit.permit.nonce,
            deadline: BigInt(permit.permit.deadline),
          },
          permit.signature,
        ],
        chainId: permit.chainId,
      })
      setState("confirming")
      let mintedTokenId: number | undefined
      if (publicClient) {
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        const transfers = parseEventLogs({
          abi: BADGE_ABI,
          logs: receipt.logs,
          eventName: "Transfer",
        })
        // The mint emits exactly one Transfer from the zero address;
        // token ids are sequential, so Number() never loses precision.
        const id = transfers.find(
          (t) => t.args.from === "0x0000000000000000000000000000000000000000"
        )?.args.tokenId
        if (id !== undefined) {
          mintedTokenId = Number(id)
          setTokenId(mintedTokenId)
        }
      }
      setState("recording")
      await confirmMint.mutateAsync({
        txHash: hash as Hex,
        tokenId: mintedTokenId,
      })
      setState("done")
    } catch (e) {
      const code = (e as Error & { code?: string }).code
      if (code === "rehearsal-mode") {
        setError(
          "This event is in dress-rehearsal mode — finisher badges aren't minted on chain."
        )
      } else if (code === "contract-not-configured") {
        setError(
          "Badge contract isn't deployed in this environment yet. Set NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS and BADGE_SIGNER_PRIVATE_KEY."
        )
      } else {
        setError(
          e instanceof Error
            ? e.message
            : "Mint failed. Check your wallet and try again."
        )
      }
      setState("error")
      resetWrite()
    }
  }, [requestPermit, writeContractAsync, publicClient, confirmMint, resetWrite])

  // PoC mock mint: no wallet transaction — the server records a synthetic
  // badge for the SIWE-authenticated wallet.
  const mockMint = useCallback(async () => {
    setError(null)
    setTokenId(null)
    setState("recording")
    try {
      const r = await mockMintMutation.mutateAsync()
      if (r.tokenId != null) setTokenId(r.tokenId)
      setState("done")
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Mock mint failed. Try again."
      )
      setState("error")
    }
  }, [mockMintMutation])

  const minted = effective === "done"
  const mintBusy =
    effective === "requesting-permit" ||
    effective === "awaiting-signature" ||
    effective === "confirming" ||
    effective === "recording"

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,oklch(73%_0.17_296_/_0.25),transparent_60%)] blur-2xl" />
      </div>

      <header className="relative mx-auto flex w-full max-w-md items-center justify-between px-5 pt-6">
        <Link
          href="/play/progress"
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          Progress
        </Link>
        <StatusPill state={effective} />
      </header>

      <div className="relative mx-auto grid w-full max-w-md gap-7 px-5 pt-10 pb-12">
        <div className="grid gap-3 text-center">
          <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
            {eventTitle}
          </p>
          <h1 className="text-[38px] leading-tight font-medium tracking-tight">
            {minted
              ? "Badge minted."
              : effective === "ineligible"
                ? "Keep going."
                : effective === "rehearsal"
                  ? "Rehearsal complete."
                  : "You closed the loop."}
          </h1>
          <p className="mx-auto max-w-xs text-sm leading-relaxed text-muted-foreground">
            {minted
              ? "Show this badge at the prize desk to claim your reward."
              : effective === "ineligible"
                ? `Scan ${(progress?.total ?? 0) - (progress?.scanned.length ?? 0)} more checkpoint(s) before you can mint.`
                : effective === "rehearsal"
                  ? "Rehearsal mode — finisher badges aren't minted on chain. You walked the full loop; the real mint goes live when the organizer ends rehearsal."
                  : "Mint your finisher badge and show it at the prize desk to unlock your rewards."}
          </p>
        </div>

        <Badge
          minted={minted}
          eventTitle={eventTitle}
          networkName={networkLabel(network)}
        />

        <div className="grid gap-2">
          {effective === "rehearsal" ? (
            <>
              <div className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 text-[12px] text-primary">
                <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
                <p>
                  This event is running in dress-rehearsal mode. No badge is
                  minted on chain and nothing is written to your wallet.
                </p>
              </div>
              <PlayCta href="/play/progress">
                <CheckCircle2Icon className="size-4" />
                Back to progress
              </PlayCta>
            </>
          ) : MOCK_CHAIN ? (
            effective === "done" ? (
              <PlayCta href="/play/progress">
                <CheckCircle2Icon className="size-4" />
                Continue
              </PlayCta>
            ) : effective === "ineligible" ? (
              <PlayCta href="/play/scan">Keep playing</PlayCta>
            ) : (
              <PlayCta onClick={mockMint} disabled={mintBusy}>
                {mintBusy ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Finalizing…
                  </>
                ) : (
                  <>
                    <SparklesIcon className="size-4" />
                    Mint finisher badge
                  </>
                )}
              </PlayCta>
            )
          ) : (
          <ConnectButton.Custom>
            {({ openConnectModal, account, chain, mounted }) => {
              const connected = mounted && !!account && !!chain
              if (!mounted) {
                return (
                  <div className="h-12 rounded-xl bg-primary opacity-50" />
                )
              }
              if (!connected) {
                return (
                  <PlayCta onClick={openConnectModal}>
                    <WalletIcon className="size-4" />
                    Connect wallet to mint
                  </PlayCta>
                )
              }
              if (effective === "done") {
                return (
                  <PlayCta href="/play/progress">
                    <CheckCircle2Icon className="size-4" />
                    Continue
                  </PlayCta>
                )
              }
              if (effective === "ineligible") {
                return <PlayCta href="/play/scan">Keep playing</PlayCta>
              }
              const busy =
                effective === "requesting-permit" ||
                effective === "awaiting-signature" ||
                effective === "confirming" ||
                effective === "recording"
              return (
                <PlayCta onClick={mint} disabled={busy}>
                  {busy ? (
                    <>
                      <Loader2Icon className="size-4 animate-spin" />
                      {mintLabel(effective)}
                    </>
                  ) : (
                    <>
                      <SparklesIcon className="size-4" />
                      Mint finisher badge
                    </>
                  )}
                </PlayCta>
              )
            }}
          </ConnectButton.Custom>
          )}

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-[11px] text-rose-200"
            >
              <AlertTriangleIcon className="mt-0.5 size-3 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {isConnected && shortAddress && !minted && (
            <p className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <CheckCircle2Icon className="size-3 text-emerald-400" />
              Minting to {shortAddress}
            </p>
          )}

          {minted && txHash && (
            <p className="text-center text-[11px] text-muted-foreground">
              {tokenId !== null ? `Token #${tokenId} · ` : ""}Confirmed on
              chain ·{" "}
              <a
                href={explorerTxUrl(network, txHash)}
                className="text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener"
              >
                view tx
              </a>
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
                Staff verify your badge on-chain and hand out the physical
                reward tier you&apos;ve earned.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function Badge({
  minted,
  eventTitle,
  networkName,
}: {
  minted: boolean
  eventTitle: string
  networkName: string
}) {
  return (
    <div className="relative grid place-items-center rounded-3xl border border-primary/40 bg-primary/5 p-8">
      <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_50%_30%,oklch(73%_0.17_296_/_0.16),transparent_60%)]" />
      <div className="relative grid gap-5 text-center">
        <div className="relative mx-auto grid size-28 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/50 opacity-60 blur-xl" />
          <div className="relative grid size-24 place-items-center rounded-full border border-primary/50 bg-primary/80 shadow-[0_20px_40px_-12px_oklch(73%_0.17_296_/_0.6)]">
            {minted ? (
              <CheckCircle2Icon className="size-9 text-primary-foreground" />
            ) : (
              <SparklesIcon className="size-9 text-primary-foreground" />
            )}
          </div>
        </div>
        <div className="grid gap-1">
          <p className="text-xl font-medium tracking-tight">
            {eventTitle} Finisher
          </p>
          <p className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
            On-chain badge · {networkName}
          </p>
        </div>
      </div>
    </div>
  )
}

function StatusPill({ state }: { state: MintState }) {
  const base =
    "font-mono text-[10px] tracking-[0.14em] uppercase"
  if (state === "done") {
    return (
      <span role="status" className={`${base} text-emerald-300/90`}>
        Minted
      </span>
    )
  }
  if (state === "ineligible") {
    return (
      <span role="status" className={`${base} text-muted-foreground`}>
        Loop incomplete
      </span>
    )
  }
  if (state === "rehearsal") {
    return (
      <span role="status" className={`${base} text-primary`}>
        Rehearsal
      </span>
    )
  }
  return (
    <span role="status" className={`${base} text-primary`}>
      Loop complete
    </span>
  )
}

function mintLabel(state: MintState): string {
  switch (state) {
    case "requesting-permit":
      return "Issuing permit…"
    case "awaiting-signature":
      return "Confirm in wallet…"
    case "confirming":
      return "Waiting for chain…"
    case "recording":
      return "Finalizing…"
    default:
      return ""
  }
}
