import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  type Address,
  type Hex,
  generatePrivateKey,
  privateKeyToAccount,
} from "viem/accounts"
import { getAddress, verifyTypedData } from "viem"

import {
  BADGE_CHAIN,
  BADGE_EIP712_DOMAIN,
  BADGE_EIP712_TYPES,
} from "@/lib/badge-contract"
import {
  generatePermitNonce,
  getSignerAddress,
  issueMintPermit,
} from "@/lib/mint-permits"

const PLAYER: Address = getAddress(
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
)

let signerKey: Hex
let signerAccount: ReturnType<typeof privateKeyToAccount>

beforeEach(() => {
  signerKey = generatePrivateKey()
  signerAccount = privateKeyToAccount(signerKey)
  vi.stubEnv("BADGE_SIGNER_PRIVATE_KEY", signerKey)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("generatePermitNonce", () => {
  it("emits 32-byte hex values that don't repeat", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 64; i++) {
      const n = generatePermitNonce()
      expect(n).toMatch(/^0x[0-9a-f]{64}$/i)
      expect(seen.has(n)).toBe(false)
      seen.add(n)
    }
  })
})

describe("getSignerAddress", () => {
  it("derives the expected address from BADGE_SIGNER_PRIVATE_KEY", () => {
    expect(getSignerAddress()).toBe(signerAccount.address)
  })
  it("throws if the key is unset", () => {
    vi.stubEnv("BADGE_SIGNER_PRIVATE_KEY", "")
    expect(() => getSignerAddress()).toThrow(/required/)
  })
  it("throws if the key is malformed", () => {
    vi.stubEnv("BADGE_SIGNER_PRIVATE_KEY", "not-a-key")
    expect(() => getSignerAddress()).toThrow(/0x-prefixed/)
  })
})

describe("issueMintPermit", () => {
  it("produces a permit whose signature recovers to the signer address", async () => {
    const { permit, signature } = await issueMintPermit({ player: PLAYER })

    expect(permit.player).toBe(PLAYER)
    expect(permit.chainId).toBe(BigInt(BADGE_CHAIN.id))
    expect(permit.nonce).toMatch(/^0x[0-9a-f]{64}$/i)
    expect(permit.deadline).toBeGreaterThan(BigInt(Math.floor(Date.now() / 1000)))

    const ok = await verifyTypedData({
      address: signerAccount.address,
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: permit,
      signature,
    })
    expect(ok).toBe(true)
  })

  it("a signature from a different key fails verification", async () => {
    const { permit } = await issueMintPermit({ player: PLAYER })
    const otherKey = generatePrivateKey()
    const otherAccount = privateKeyToAccount(otherKey)
    const otherSig = await otherAccount.signTypedData({
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: permit,
    })
    const ok = await verifyTypedData({
      address: signerAccount.address, // expecting the original signer
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: permit,
      signature: otherSig,
    })
    expect(ok).toBe(false)
  })

  it("modifying the permit body invalidates the signature", async () => {
    const { permit, signature } = await issueMintPermit({ player: PLAYER })
    const tampered = { ...permit, deadline: permit.deadline + 60n * 60n }
    const ok = await verifyTypedData({
      address: signerAccount.address,
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: tampered,
      signature,
    })
    expect(ok).toBe(false)
  })

  it("honors an explicit deadline", async () => {
    const future = BigInt(Math.floor(Date.now() / 1000) + 60)
    const { permit } = await issueMintPermit({
      player: PLAYER,
      deadline: future,
    })
    expect(permit.deadline).toBe(future)
  })

  it("pulls a fresh nonce for each call", async () => {
    const a = await issueMintPermit({ player: PLAYER })
    const b = await issueMintPermit({ player: PLAYER })
    expect(a.permit.nonce).not.toBe(b.permit.nonce)
    expect(a.signature).not.toBe(b.signature)
  })

  it("permits issued for two different players don't cross-verify", async () => {
    const playerA = await issueMintPermit({ player: PLAYER })
    const otherPlayer: Address = getAddress(
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    )
    const playerB = await issueMintPermit({ player: otherPlayer })
    const swapped = { ...playerA.permit, player: otherPlayer }
    const ok = await verifyTypedData({
      address: signerAccount.address,
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: swapped,
      signature: playerA.signature,
    })
    expect(ok).toBe(false)
    // sanity: playerB's permit verifies for playerB only
    const okB = await verifyTypedData({
      address: signerAccount.address,
      domain: BADGE_EIP712_DOMAIN,
      types: BADGE_EIP712_TYPES,
      primaryType: "MintPermit",
      message: playerB.permit,
      signature: playerB.signature,
    })
    expect(okB).toBe(true)
  })
})

describe("contract EIP-712 domain shape", () => {
  it("matches the contract's expected (name, version, chainId)", () => {
    expect(BADGE_EIP712_DOMAIN.name).toBe("TreasureLoop")
    expect(BADGE_EIP712_DOMAIN.version).toBe("1")
    expect(BADGE_EIP712_DOMAIN.chainId).toBe(BADGE_CHAIN.id)
  })
  it("MintPermit struct order matches the Solidity typehash", () => {
    expect(BADGE_EIP712_TYPES.MintPermit.map((t) => t.name)).toEqual([
      "player",
      "chainId",
      "nonce",
      "deadline",
    ])
    expect(BADGE_EIP712_TYPES.MintPermit.map((t) => t.type)).toEqual([
      "address",
      "uint256",
      "bytes32",
      "uint256",
    ])
  })
})
