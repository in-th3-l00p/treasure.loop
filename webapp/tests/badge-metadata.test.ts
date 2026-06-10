import { describe, expect, it } from "vitest"

import { buildBadgeMetadata } from "@/lib/badge-metadata"

describe("buildBadgeMetadata", () => {
  const meta = buildBadgeMetadata({
    tokenId: 7,
    eventName: "ETH Cluj 2026: TreasureLoop Pilot",
    networkName: "Base Sepolia",
  })

  it("names the token after the event and id", () => {
    expect(meta.name).toBe("ETH Cluj 2026 Finisher #7")
  })

  it("inlines the image as an SVG data URI", () => {
    expect(meta.image.startsWith("data:image/svg+xml;base64,")).toBe(true)
    const svg = Buffer.from(
      meta.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf-8")
    expect(svg).toContain("<svg")
    expect(svg).toContain("ETH CLUJ 2026")
    expect(svg).toContain("#7")
  })

  it("carries event and network attributes", () => {
    expect(meta.attributes).toContainEqual({
      trait_type: "Event",
      value: "ETH Cluj 2026",
    })
    expect(meta.attributes).toContainEqual({
      trait_type: "Network",
      value: "Base Sepolia",
    })
  })

  it("escapes XML-special characters in the event name", () => {
    const hostile = buildBadgeMetadata({
      tokenId: 1,
      eventName: "Hack & Load <2026>",
      networkName: "Base Sepolia",
    })
    const svg = Buffer.from(
      hostile.image.replace("data:image/svg+xml;base64,", ""),
      "base64"
    ).toString("utf-8")
    expect(svg).toContain("HACK &amp; LOAD &lt;2026&gt;")
    expect(svg).not.toContain("<2026>")
  })
})
