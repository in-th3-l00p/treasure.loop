import "server-only"

import { createPublicClient, http } from "viem"

import {
  BADGE_ABI,
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_CONTRACT_CONFIGURED,
} from "./badge-contract"

/**
 * Read the badge contract's minting-pause state.
 *
 * The contract exposes a `mintingPaused()` view but the webapp ships
 * no owner key and the ABI has no pause/unpause *write* — pausing is an
 * on-chain owner action performed out-of-band (multisig / deploy tool).
 * So the live dashboard can honestly *read* the current state and tell
 * the operator whether minting is open, but it can't flip it from here.
 *
 * When the contract isn't configured (zero address, local dev) there is
 * nothing on-chain to read; we say so rather than guessing.
 */

export interface BadgePauseState {
  /** Contract address is set and non-zero. */
  configured: boolean
  /** Current on-chain `mintingPaused()` value; null when unreadable. */
  paused: boolean | null
  /** Whether this surface can write a new pause state (today: never). */
  canToggle: boolean
  /** Human explanation for the disabled/no-op control. */
  detail: string
}

const publicClient = createPublicClient({
  chain: BADGE_CHAIN,
  transport: http(),
})

export async function readBadgePauseState(): Promise<BadgePauseState> {
  if (!BADGE_CONTRACT_CONFIGURED) {
    return {
      configured: false,
      paused: null,
      canToggle: false,
      detail:
        "Badge contract isn't configured (NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS unset). Deploy the contract to read or control minting.",
    }
  }

  try {
    const paused = (await publicClient.readContract({
      address: BADGE_CONTRACT_ADDRESS,
      abi: BADGE_ABI,
      functionName: "mintingPaused",
    })) as boolean

    return {
      configured: true,
      paused,
      // No owner key + no pause write in the webapp's ABI: changing the
      // state is an on-chain owner action done elsewhere. We expose the
      // read truthfully and keep the toggle as an explained no-op.
      canToggle: false,
      detail: paused
        ? "Minting is paused on-chain. Resume it from the contract owner wallet (multisig / deploy tool); this console is read-only for pause state."
        : "Minting is open on-chain. To pause, use the contract owner wallet — this console has no owner key and can only read the state.",
    }
  } catch (e) {
    return {
      configured: true,
      paused: null,
      canToggle: false,
      detail: `Couldn't read mintingPaused() from the contract: ${
        e instanceof Error ? e.message : "unknown error"
      }.`,
    }
  }
}
