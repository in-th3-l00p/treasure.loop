import { describe, expect, it, vi } from "vitest"
import { SiweMessage, generateNonce } from "siwe"
import {
  createWalletClient,
  http,
  type Hex,
} from "viem"
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts"
import { baseSepolia } from "viem/chains"

/**
 * These tests exercise the SIWE library the way our /api/play/auth/verify
 * route does. We don't boot Next.js — instead we replicate the exact
 * verify call shape and confirm:
 *   - a freshly-signed valid message verifies
 *   - a tampered message fails
 *   - a wrong-nonce message fails
 *   - signatures from a different account fail
 */

function makeAccount() {
  const pk: Hex = generatePrivateKey()
  return privateKeyToAccount(pk)
}

async function signSiwe(opts: {
  account: ReturnType<typeof makeAccount>
  nonce: string
  domain?: string
  uri?: string
  chainId?: number
  issuedAt?: string
}) {
  const message = new SiweMessage({
    domain: opts.domain ?? "treasure.loop",
    address: opts.account.address,
    statement: "Sign in to TreasureLoop",
    uri: opts.uri ?? "https://treasure.loop/play",
    version: "1",
    chainId: opts.chainId ?? baseSepolia.id,
    nonce: opts.nonce,
    issuedAt: opts.issuedAt ?? new Date().toISOString(),
  })
  const prepared = message.prepareMessage()
  const wallet = createWalletClient({
    account: opts.account,
    chain: baseSepolia,
    transport: http(),
  })
  const signature = await wallet.signMessage({ message: prepared })
  return { message, prepared, signature }
}

describe("SIWE verify", () => {
  it("verifies a freshly-signed message with the expected nonce", async () => {
    const account = makeAccount()
    const nonce = generateNonce()
    const { message, signature } = await signSiwe({ account, nonce })

    const result = await message.verify({ signature, nonce })
    expect(result.success).toBe(true)
    expect(result.data.address.toLowerCase()).toBe(
      account.address.toLowerCase()
    )
    expect(result.data.chainId).toBe(baseSepolia.id)
  })

  it("rejects when the nonce on the message doesn't match the expected nonce", async () => {
    const account = makeAccount()
    const issuedNonce = generateNonce()
    const replayNonce = generateNonce()
    const { message, signature } = await signSiwe({
      account,
      nonce: issuedNonce,
    })

    await expect(
      message.verify({ signature, nonce: replayNonce })
    ).rejects.toBeTruthy()
  })

  it("rejects a signature produced by a different account", async () => {
    const account = makeAccount()
    const attacker = makeAccount()
    const nonce = generateNonce()
    const { prepared } = await signSiwe({ account, nonce })

    // Re-sign the prepared bytes with the attacker's key, then construct
    // a fresh SiweMessage object as the verify route does.
    const wallet = createWalletClient({
      account: attacker,
      chain: baseSepolia,
      transport: http(),
    })
    const attackerSig = await wallet.signMessage({ message: prepared })

    const replay = new SiweMessage(prepared)
    await expect(
      replay.verify({ signature: attackerSig, nonce })
    ).rejects.toBeTruthy()
  })

  it("rejects when the message body has been tampered with", async () => {
    const account = makeAccount()
    const nonce = generateNonce()
    const { prepared, signature } = await signSiwe({ account, nonce })
    // Swap the statement → signature no longer matches.
    const tampered = prepared.replace(
      "Sign in to TreasureLoop",
      "Drain my wallet"
    )
    const replay = new SiweMessage(tampered)
    await expect(
      replay.verify({ signature, nonce })
    ).rejects.toBeTruthy()
  })

  it("emits unique nonces for each call", () => {
    const seen = new Set<string>()
    for (let i = 0; i < 32; i++) {
      const n = generateNonce()
      expect(n.length).toBeGreaterThanOrEqual(8)
      expect(seen.has(n)).toBe(false)
      seen.add(n)
    }
  })
})

describe("SIWE message expiry guard", () => {
  // We don't enforce expiry server-side via siwe (we trust the session
  // cookie expiry instead). Still, document the assumption that an
  // old-issuedAt message is parsable but doesn't auto-pass.
  it("an issuedAt far in the past still verifies if the signature matches", async () => {
    const account = makeAccount()
    const nonce = generateNonce()
    const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
    const { message, signature } = await signSiwe({
      account,
      nonce,
      issuedAt: yearAgo.toISOString(),
    })
    const result = await message.verify({ signature, nonce })
    expect(result.success).toBe(true)
  })
})

describe("session shape", () => {
  it("a real Next.js route file exists for each step of the flow", async () => {
    // Smoke check that the route files exist and export the expected HTTP
    // method handlers — catches accidental renames in CI.
    vi.resetModules()
    const nonce = await import("@/app/api/play/auth/nonce/route")
    const verify = await import("@/app/api/play/auth/verify/route")
    const me = await import("@/app/api/play/auth/me/route")
    const logout = await import("@/app/api/play/auth/logout/route")
    expect(typeof nonce.GET).toBe("function")
    expect(typeof verify.POST).toBe("function")
    expect(typeof me.GET).toBe("function")
    expect(typeof logout.POST).toBe("function")
  })
})
