"use client"

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { useState } from "react"
import { WagmiProvider } from "wagmi"

import { wagmiConfig } from "@/lib/wagmi"

import "@rainbow-me/rainbowkit/styles.css"

export function PlayProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "oklch(73% 0.17 296)",
            accentColorForeground: "oklch(98% 0.005 286)",
            borderRadius: "medium",
            fontStack: "system",
            overlayBlur: "small",
          })}
          modalSize="compact"
          appInfo={{
            appName: "TreasureLoop",
            learnMoreUrl: "/",
          }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
