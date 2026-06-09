import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { base, baseSepolia } from "wagmi/chains"

/**
 * wagmi + RainbowKit config for the attendee surface.
 *
 * The attendee experience is separate from the operator console:
 * attendees authenticate via wallet connection (no Clerk, no
 * organizations, no email/password). Their "session" is just the
 * connected wallet address that signs the badge mint at completion.
 *
 * Project id comes from WalletConnect Cloud — only needed for the
 * WalletConnect transport (deeplink to mobile wallets). When unset,
 * RainbowKit prints a warning but injected wallets (MetaMask, Rabby,
 * Coinbase Wallet browser ext) still work fine for local dev.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "TreasureLoop",
  appDescription:
    "Conference treasure hunt — scan checkpoints, mint your finisher badge.",
  appUrl: "https://treasure.loop",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "demo",
  chains: [baseSepolia, base],
  ssr: true,
})
