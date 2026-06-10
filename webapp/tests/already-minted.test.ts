import { describe, expect, it } from "vitest"

import { isAlreadyMinted } from "@/lib/play-client"

describe("isAlreadyMinted", () => {
  it("is true when the server recorded a mint", () => {
    expect(
      isAlreadyMinted({ badgeMintedAt: 1700000000, onchainHeld: false })
    ).toBe(true)
  })

  it("is true when the chain says the wallet holds the badge", () => {
    // Resilience: DB has no record (wiped) but the chain proves the mint.
    expect(isAlreadyMinted({ badgeMintedAt: null, onchainHeld: true })).toBe(
      true
    )
  })

  it("is false when neither source reports a mint", () => {
    expect(isAlreadyMinted({ badgeMintedAt: null, onchainHeld: false })).toBe(
      false
    )
  })

  it("falls back to the server record when the chain is unknown", () => {
    // onchainHeld === null means contract not configured / no wallet.
    expect(isAlreadyMinted({ badgeMintedAt: null, onchainHeld: null })).toBe(
      false
    )
    expect(
      isAlreadyMinted({ badgeMintedAt: 1700000000, onchainHeld: null })
    ).toBe(true)
  })

  it("treats undefined badgeMintedAt as no server record", () => {
    expect(
      isAlreadyMinted({ badgeMintedAt: undefined, onchainHeld: false })
    ).toBe(false)
  })
})
