import { PlayProviders } from "./_components/play-providers"

export default function PlayLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <PlayProviders>
      <div className="play-shell relative flex min-h-screen flex-col bg-background text-foreground">
        {children}
      </div>
    </PlayProviders>
  )
}
