/**
 * ERC-721 metadata for the finisher badge, OpenSea-compatible.
 *
 * The image is an inline SVG data URI so wallets render the badge with
 * a single metadata fetch — no separate image host to keep alive
 * during the event. Colors are hex (not oklch): wallet SVG renderers
 * are conservative.
 */

export interface BadgeMetadata {
  name: string
  description: string
  image: string
  attributes: { trait_type: string; value: string }[]
}

export function buildBadgeMetadata(input: {
  tokenId: number
  eventName: string
  networkName: string
}): BadgeMetadata {
  // "ETH Cluj 2026: TreasureLoop Pilot" → "ETH Cluj 2026"
  const eventTitle = input.eventName.split(":")[0].trim()
  const svg = badgeSvg(eventTitle, input.tokenId)
  return {
    name: `${eventTitle} Finisher #${input.tokenId}`,
    description:
      `Finisher badge for the ${eventTitle} TreasureLoop. ` +
      `The holder completed every staffed checkpoint on the venue floor; ` +
      `completion settled on-chain and gated the physical prize desk.`,
    image: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
    attributes: [
      { trait_type: "Event", value: eventTitle },
      { trait_type: "Network", value: input.networkName },
      { trait_type: "Badge", value: "Finisher" },
    ],
  }
}

function badgeSvg(eventTitle: string, tokenId: number): string {
  const title = escapeXml(eventTitle.toUpperCase())
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600" viewBox="0 0 600 600">`,
    `<rect width="600" height="600" fill="#0f0d14"/>`,
    `<circle cx="300" cy="270" r="150" fill="none" stroke="#a78bfa" stroke-width="3" opacity="0.9"/>`,
    `<circle cx="300" cy="270" r="118" fill="none" stroke="#a78bfa" stroke-width="1" opacity="0.35"/>`,
    `<circle cx="300" cy="270" r="10" fill="#a78bfa"/>`,
    `<text x="300" y="470" text-anchor="middle" font-family="monospace" font-size="26" letter-spacing="6" fill="#f4f1fa">${title}</text>`,
    `<text x="300" y="510" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="4" fill="#8d87a0">TREASURELOOP FINISHER</text>`,
    `<text x="300" y="550" text-anchor="middle" font-family="monospace" font-size="16" letter-spacing="2" fill="#a78bfa">#${tokenId}</text>`,
    `</svg>`,
  ].join("")
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
