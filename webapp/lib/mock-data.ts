export const event = {
  name: "ETH Cluj 2026: TreasureLoop Pilot",
  venue: "Cluj Innovation Hall",
  dates: "17-19 July 2026",
  status: "Live rehearsal",
  organizer: "InTheLoop Ops",
  walletNetwork: "Base Sepolia",
  routeCompletion: 68,
  attendeeCount: 1248,
  activePlayers: 386,
  completions: 142,
  sponsorVisits: 3124,
  badgeMints: 118,
}

export const checkpoints = [
  {
    id: "CP-01",
    name: "Opening Gate",
    sponsor: "InTheLoop",
    area: "Registration atrium",
    clue: "Find the signal that starts the loop.",
    scans: 1042,
    completion: 92,
    status: "Healthy",
    staff: "Mara Ionescu",
  },
  {
    id: "CP-02",
    name: "Builder Alley",
    sponsor: "Neon Labs",
    area: "Sponsor row A",
    clue: "Ask for the opcode hidden in plain sight.",
    scans: 748,
    completion: 76,
    status: "Healthy",
    staff: "Alex Radu",
  },
  {
    id: "CP-03",
    name: "Hardware Vault",
    sponsor: "Ledger",
    area: "Security lounge",
    clue: "Two fragments unlock the vault phrase.",
    scans: 512,
    completion: 61,
    status: "Needs staff",
    staff: "Unassigned",
  },
  {
    id: "CP-04",
    name: "Protocol Garden",
    sponsor: "Lisk",
    area: "Outdoor terrace",
    clue: "Find another player holding the matching shard.",
    scans: 394,
    completion: 46,
    status: "Busy",
    staff: "Ioana Pop",
  },
  {
    id: "CP-05",
    name: "Prize Desk",
    sponsor: "ETH Cluj",
    area: "Main hall exit",
    clue: "Close the loop and claim your proof.",
    scans: 142,
    completion: 100,
    status: "Healthy",
    staff: "Vlad Muntean",
  },
]

export const sponsors = [
  { name: "Neon Labs", tier: "Gold", visits: 748, conversations: 219 },
  { name: "Ledger", tier: "Prize", visits: 512, conversations: 184 },
  { name: "Lisk", tier: "Gold", visits: 394, conversations: 136 },
  { name: "Base Romania", tier: "Community", visits: 286, conversations: 92 },
]

export const rewards = [
  { name: "On-chain finisher badge", claimed: 118, stock: "Unlimited", status: "Minting" },
  { name: "Ledger Nano raffle", claimed: 84, stock: "120 entries", status: "Open" },
  { name: "Speaker dinner pass", claimed: 12, stock: "16 passes", status: "Limited" },
  { name: "Conference merch pack", claimed: 74, stock: "200 packs", status: "Open" },
]

export const activity = [
  "Ledger checkpoint requested another volunteer",
  "28 players completed a paired-fragment clue",
  "Badge mint queue settled 19 completions",
  "Opening Gate scanned 82 new attendees this hour",
  "Prize Desk verified 17 physical claims",
]

export const players = [
  { name: "Catalin T.", wallet: "0x74...92b1", progress: "5/5", status: "Badge minted" },
  { name: "Ana D.", wallet: "0x31...ab70", progress: "4/5", status: "Prize eligible" },
  { name: "Radu C.", wallet: "0x09...21fc", progress: "3/5", status: "Needs pair clue" },
  { name: "Mihai L.", wallet: "0x82...c914", progress: "2/5", status: "Active route" },
]
