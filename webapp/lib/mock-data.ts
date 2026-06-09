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

export type CheckpointHealth = "Healthy" | "Busy" | "Needs staff" | "Offline"

export const hourlyTraffic = [
  { hour: "10:00", scans: 42, completions: 4 },
  { hour: "11:00", scans: 88, completions: 12 },
  { hour: "12:00", scans: 124, completions: 28 },
  { hour: "13:00", scans: 96, completions: 22 },
  { hour: "14:00", scans: 156, completions: 38 },
  { hour: "15:00", scans: 184, completions: 46 },
  { hour: "16:00", scans: 142, completions: 34 },
  { hour: "17:00", scans: 96, completions: 18 },
]

export const verificationQueue = [
  {
    badge: "TL-CLUJ-0118",
    player: "Catalin T.",
    wallet: "0x74...92b1",
    completedAt: "2 min ago",
    eligible: ["On-chain finisher badge", "Ledger Nano raffle", "Conference merch pack"],
    flags: [],
  },
  {
    badge: "TL-CLUJ-0117",
    player: "Ana D.",
    wallet: "0x31...ab70",
    completedAt: "6 min ago",
    eligible: ["On-chain finisher badge", "Conference merch pack"],
    flags: [],
  },
  {
    badge: "TL-CLUJ-0116",
    player: "Iulia M.",
    wallet: "0x4a...77fe",
    completedAt: "11 min ago",
    eligible: ["On-chain finisher badge"],
    flags: ["Same wallet claimed merch yesterday"],
  },
]

export const recentRedemptions = [
  { badge: "TL-CLUJ-0115", reward: "Conference merch pack", staff: "Vlad", at: "14:38" },
  { badge: "TL-CLUJ-0114", reward: "Ledger Nano raffle", staff: "Vlad", at: "14:32" },
  { badge: "TL-CLUJ-0113", reward: "Conference merch pack", staff: "Mara", at: "14:21" },
  { badge: "TL-CLUJ-0112", reward: "Speaker dinner pass", staff: "Vlad", at: "14:09" },
]
