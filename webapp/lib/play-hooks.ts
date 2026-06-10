"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { type Address } from "viem"
import { useReadContract } from "wagmi"

import {
  BADGE_ABI,
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
} from "./badge-contract"
import {
  type IssuedFragment,
  type MintPermitResponse,
  type PublicProgress,
  combineFragments,
  confirmMint,
  getActiveFragment,
  getPlayEvent,
  getProgress,
  getSession,
  logout,
  recordScan,
  reportPairCheating,
  requestMintPermit,
  requestNonce,
  verifySiwe,
} from "./play-client"

/**
 * TanStack Query keys for the attendee surface. Centralised so a single
 * `invalidate("progress")` after a scan refreshes every screen that
 * reads it.
 */
export const playKeys = {
  session: ["play", "session"] as const,
  progress: ["play", "progress"] as const,
  event: ["play", "event"] as const,
  fragment: ["play", "fragment"] as const,
}

/** The public event sheet: name, network, ordered checkpoints. */
export function usePlayEvent() {
  return useQuery({
    queryKey: playKeys.event,
    queryFn: async () => (await getPlayEvent()).event,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

export function useSession() {
  return useQuery({
    queryKey: playKeys.session,
    queryFn: getSession,
    staleTime: 30_000,
    retry: false,
  })
}

export function useProgress() {
  return useQuery({
    queryKey: playKeys.progress,
    queryFn: async () => (await getProgress()).progress,
    retry: false,
    refetchOnWindowFocus: true,
  })
}

export function useRequestNonce() {
  return useMutation({ mutationFn: requestNonce })
}

export function useVerifySiwe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: verifySiwe,
    onSuccess: () => qc.invalidateQueries({ queryKey: playKeys.session }),
  })
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      qc.setQueryData(playKeys.session, {
        address: null,
        chainId: null,
        issuedAt: null,
      })
      qc.invalidateQueries({ queryKey: playKeys.progress })
    },
  })
}

export function useRecordScan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: recordScan,
    onSuccess: (data: {
      progress?: PublicProgress
      fragment?: IssuedFragment
    }) => {
      // A pair checkpoint returns a fragment, not progress; refresh the
      // fragment query instead of writing progress.
      if (data.progress) qc.setQueryData(playKeys.progress, data.progress)
      if (data.fragment) qc.invalidateQueries({ queryKey: playKeys.fragment })
    },
  })
}

/** The player's current pair fragment, if any. */
export function useActiveFragment() {
  return useQuery({
    queryKey: playKeys.fragment,
    queryFn: async () => (await getActiveFragment()).fragment,
    retry: false,
    refetchOnWindowFocus: true,
  })
}

export function useCombineFragments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: combineFragments,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: playKeys.fragment })
      qc.invalidateQueries({ queryKey: playKeys.progress })
    },
  })
}

export function useReportPairCheating() {
  return useMutation({ mutationFn: reportPairCheating })
}

export function useRequestMintPermit() {
  return useMutation<MintPermitResponse>({ mutationFn: requestMintPermit })
}

export function useConfirmMint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: confirmMint,
    onSuccess: () => qc.invalidateQueries({ queryKey: playKeys.progress }),
  })
}

/**
 * On-chain "does this wallet already hold a badge" check.
 *
 * Reads `balanceOf(address)` from the badge ERC-721 directly so the
 * claim page can detect an already-minted wallet even if the server DB
 * lost its mint record. Returns `null` (rather than false) when the
 * contract isn't configured or no wallet is connected, so callers can
 * tell "no badge" apart from "we don't know" and fall back to the
 * server-driven state without surfacing errors.
 */
export function useOnchainBadgeHeld(address: Address | undefined): {
  held: boolean | null
  isLoading: boolean
} {
  const enabled = BADGE_CONTRACT_CONFIGURED && !!address
  const { data, isLoading } = useReadContract({
    address: BADGE_CONTRACT_ADDRESS,
    abi: BADGE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: BADGE_CHAIN.id,
    query: { enabled },
  })

  if (!enabled) return { held: null, isLoading: false }
  if (typeof data !== "bigint") return { held: null, isLoading }
  return { held: data > BigInt(0), isLoading }
}
