import {
  type Address,
  type Hex,
  getAddress,
  isAddress,
} from "viem"
import { baseSepolia } from "viem/chains"

/**
 * Static config + ABI for the TreasureLoopBadge ERC-721.
 *
 * Address comes from env so it can differ per network (Sepolia dev,
 * Base mainnet at event time). For local dev without a deployed
 * contract we fall back to the zero address — the UI knows to show a
 * "contract not configured" state when it sees it.
 */

export const ZERO_ADDRESS: Address =
  "0x0000000000000000000000000000000000000000"

export const BADGE_CHAIN = baseSepolia

const RAW_ADDRESS = process.env.NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS

export const BADGE_CONTRACT_ADDRESS: Address =
  RAW_ADDRESS && isAddress(RAW_ADDRESS) ? getAddress(RAW_ADDRESS) : ZERO_ADDRESS

export const BADGE_CONTRACT_CONFIGURED =
  BADGE_CONTRACT_ADDRESS !== ZERO_ADDRESS

/**
 * PoC mock-chain mode (DEV ONLY). When `NEXT_PUBLIC_MOCK_CHAIN=1` and we
 * are not in production, the app fakes the blockchain: the claim flow
 * records a synthetic finisher badge with no real transaction, and the
 * prize desk reads badge ownership from the database instead of an RPC.
 * Hard-gated off in production so it can never weaken a live event.
 */
export const MOCK_CHAIN =
  process.env.NEXT_PUBLIC_MOCK_CHAIN === "1" &&
  process.env.NODE_ENV !== "production"

/** Matches the EIP-712 typed-data domain inside the contract. */
export const BADGE_EIP712_DOMAIN = {
  name: "TreasureLoop",
  version: "1",
  chainId: BADGE_CHAIN.id,
  verifyingContract: BADGE_CONTRACT_ADDRESS,
} as const

/** Matches `struct MintPermit` in TreasureLoopBadge.sol. */
export const BADGE_EIP712_TYPES = {
  MintPermit: [
    { name: "player", type: "address" },
    { name: "chainId", type: "uint256" },
    { name: "nonce", type: "bytes32" },
    { name: "deadline", type: "uint256" },
  ],
} as const

export interface MintPermit {
  player: Address
  chainId: bigint
  nonce: Hex
  deadline: bigint
}

/** Minimal ABI — only what the webapp needs to read / write. */
export const BADGE_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "permit",
        type: "tuple",
        components: [
          { name: "player", type: "address" },
          { name: "chainId", type: "uint256" },
          { name: "nonce", type: "bytes32" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "hasMinted",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mintingPaused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const
