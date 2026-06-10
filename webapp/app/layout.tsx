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
          colorPrimaryForeground: "oklch(98% 0.005 286)",
          colorBackground: "transparent",
          // Clerk v7 variable names. The older colorText / colorTextSecondary
          // / colorInputBackground are ignored by newer components (e.g. the
          // org-create task screen), which then fell back to dark defaults.
          colorForeground: "oklch(96% 0.004 286)",
          colorMutedForeground: "oklch(70% 0.006 286)",
          colorMuted: "oklch(20% 0.01 286)",
          colorInput: "oklch(21% 0.012 286)",
          colorInputForeground: "oklch(96% 0.004 286)",
          colorBorder: "oklch(80% 0.03 300 / 0.22)",
          colorRing: "oklch(73% 0.17 296 / 0.4)",
          // Keep the legacy names too for any component still reading them.
          colorInputBackground: "oklch(21% 0.012 286)",
          colorInputText: "oklch(96% 0.004 286)",
          colorText: "oklch(96% 0.004 286)",
          colorTextSecondary: "oklch(70% 0.006 286)",
          colorDanger: "oklch(64% 0.18 25)",
          colorSuccess: "oklch(72% 0.16 160)",
          colorNeutral: "oklch(96% 0.002 286)",
          colorShimmer: "oklch(40% 0.004 286)",
          borderRadius: "0.5rem",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontSize: "14px",
          spacingUnit: "0.875rem",
        },
        layout: {
          socialButtonsPlacement: "top",
          socialButtonsVariant: "blockButton",
          logoPlacement: "none",
          showOptionalFields: false,
          shimmer: true,
        },
        elements: {
          rootBox: "w-full",
          card: "bg-transparent shadow-none border-0 p-0 w-full mx-auto",
          cardBox: "bg-transparent shadow-none border-0 w-full",
          header: "hidden",
          headerTitle: "hidden",
          headerSubtitle: "hidden",
          main: "gap-4 w-full",
          form: "gap-3.5",
          formField: "gap-1.5",
          formFieldRow: "gap-1.5",
          formFieldLabel:
            "text-[11px] tracking-tight text-muted-foreground font-normal",
          formFieldLabelRow: "mb-0",
          formFieldInput:
            "h-9 rounded-md border border-border bg-secondary/30 text-sm px-3 outline-none transition-colors focus:border-primary/50 focus:bg-secondary/50",
          formFieldInputShowPasswordButton:
            "text-muted-foreground hover:text-foreground",
          formFieldHintText: "text-[11px] text-muted-foreground",
          formFieldAction: "text-[11px] text-muted-foreground hover:text-foreground",
          formFieldSuccessText: "text-[11px] text-emerald-400/90",
          formFieldErrorText: "text-[11px] text-rose-300/90",
          formButtonPrimary:
            "bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md text-sm font-medium normal-case shadow-none transition-colors after:hidden",
          formButtonRow: "mt-1",
          formResendCodeLink:
            "text-primary hover:text-primary/80 text-xs",
          socialButtons: "gap-2",
          socialButtonsBlockButton:
            "border border-border bg-secondary/30 hover:bg-secondary/60 h-9 rounded-md text-sm font-normal normal-case shadow-none transition-colors",
          socialButtonsBlockButtonText: "text-sm font-normal",
          socialButtonsBlockButtonArrow: "hidden",
          socialButtonsProviderIcon: "size-4",
          socialButtonsIconButton:
            "border border-border bg-secondary/30 hover:bg-secondary/60 size-9 rounded-md",
          dividerRow: "my-3",
          dividerLine: "bg-border",
          dividerText:
            "text-[10px] text-muted-foreground/60 uppercase tracking-[0.14em] font-mono",
          footer:
            "bg-transparent border-0 mt-2 p-0 [&>div]:bg-transparent [&>div]:border-0 [&>div]:shadow-none",
          footerAction: "text-xs px-0 py-0",
          footerActionText: "text-xs text-muted-foreground",
          footerActionLink:
            "text-primary hover:text-primary/80 font-normal text-xs",
          footerPages: "hidden",
          identityPreview:
            "bg-secondary/30 border border-border rounded-md",
          identityPreviewText: "text-sm",
          identityPreviewEditButton:
            "text-muted-foreground hover:text-foreground",
          alert:
            "border border-rose-500/30 bg-rose-500/10 text-rose-200 rounded-md",
          alertText: "text-xs",
          otpCodeFieldInput:
            "border border-border bg-secondary/30 text-foreground rounded-md",
          backRow: "mb-2",
          backButton:
            "text-xs text-muted-foreground hover:text-foreground",
          userButtonBox: "flex-row-reverse gap-2.5",
          userButtonOuterIdentifier:
            "text-[13px] text-sidebar-foreground",
          userButtonAvatarBox: "size-7",
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
