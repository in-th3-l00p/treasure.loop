/**
 * Full-page empty state for console routes (no event, no checkpoints).
 * Teaches the next step instead of dead-ending.
 */
export function PageEmpty({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mx-auto max-w-md px-6 pt-24 text-center">
      <h1 className="text-xl font-medium tracking-tight">{title}</h1>
      {children && (
        <p className="mt-2 text-sm text-muted-foreground">{children}</p>
      )}
    </div>
  )
}
