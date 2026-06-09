import type { Metadata } from "next"
import { Geist, Geist_Mono, Newsreader } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { dark } from "@clerk/themes"

import { TooltipProvider } from "@/components/ui/tooltip"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "TreasureLoop - Conference treasure hunt protocol",
  description:
    "Turn a conference venue into a playable map with staffed checkpoints, off-chain gameplay, on-chain completion badges, and physical prize redemption.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "oklch(73% 0.17 296)",
          colorBackground: "oklch(11% 0.005 286)",
          colorInputBackground: "oklch(14% 0.004 286)",
          colorInputText: "oklch(96% 0.004 286)",
          colorText: "oklch(96% 0.004 286)",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        },
        elements: {
          card: "shadow-none border border-border bg-card",
          headerTitle: "tracking-tight font-medium",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/90 normal-case",
          socialButtonsBlockButton:
            "border border-border bg-secondary/30 hover:bg-secondary/60",
          footerActionLink: "text-primary hover:text-primary/80",
        },
      }}
    >
      <html
        lang="en"
        className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col">
          <TooltipProvider>{children}</TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  )
}
