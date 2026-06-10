"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import {
  type MintPermitResponse,
  type PublicProgress,
  confirmMint,
  getPlayEvent,
  getProgress,
  getSession,
  logout,
  recordScan,
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
    onSuccess: (data: { progress: PublicProgress }) => {
      qc.setQueryData(playKeys.progress, data.progress)
    },
  })
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
