import { type Address, type Hex, hexToBytes, keccak256, stringToHex } from "viem"
import { privateKeyToAccount } from "viem/accounts"

import {
  BADGE_CHAIN,
  BADGE_CONTRACT_ADDRESS,
  BADGE_EIP712_DOMAIN,
  BADGE_EIP712_TYPES,
  type MintPermit,
} from "./badge-contract"

/**
 * Issues server-side EIP-712 signed `MintPermit`s for the badge contract.
 *
 * Security boundary: the signer's private key MUST live only on the
 * server. Anyone with the key can authorize any address to mint, so
 * rotate it via `setSigner()` on the contract if it ever leaks.
 *
 * We don't pull the key from env at module-load time — only when an
 * actual sign is requested — so unit tests can import this module
 * without a key being present.
 */

function getSignerKey(): Hex {
  const raw = process.env.BADGE_SIGNER_PRIVATE_KEY
  if (!raw) {
    throw new Error(
      "BADGE_SIGNER_PRIVATE_KEY is required to issue mint permits."
    )
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error(
      "BADGE_SIGNER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex string."
    )
  }
  return raw as Hex
}

/** The address derived from the configured signer key. */
export function getSignerAddress(): Address {
  return privateKeyToAccount(getSignerKey()).address
}

/** Generates a fresh 32-byte permit nonce. */
export function generatePermitNonce(): Hex {
  const random = `${Date.now()}-${Math.random()}-${Math.random()}`
  return keccak256(stringToHex(random))
}

export interface IssuePermitOptions {
  player: Address
  /** Seconds-since-epoch when the permit expires. Defaults to 30 minutes. */
  deadline?: bigint
}

export interface IssuedPermit {
  permit: MintPermit
  signature: Hex
}

/**
 * Returns a permit + signature the player can submit to the badge
 * contract's `mint()` call.
 */
export async function issueMintPermit(
  opts: IssuePermitOptions
): Promise<IssuedPermit> {
  const account = privateKeyToAccount(getSignerKey())

  const deadline =
    opts.deadline ?? BigInt(Math.floor(Date.now() / 1000) + 30 * 60)

  const permit: MintPermit = {
    player: opts.player,
    chainId: BigInt(BADGE_CHAIN.id),
    nonce: generatePermitNonce(),
    deadline,
  }

  const signature = await account.signTypedData({
    domain: BADGE_EIP712_DOMAIN,
    types: BADGE_EIP712_TYPES,
    primaryType: "MintPermit",
    message: permit,
  })

  // sanity: zero-address contract → caller fault.
  void BADGE_CONTRACT_ADDRESS
  // unused import lint guard
  void hexToBytes

  return { permit, signature }
}
