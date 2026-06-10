import { cn } from "@/lib/utils"

export function Section({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("mb-12 last:mb-0", className)}>{children}</section>
  )
}

/** Hairline-divided section header: title, muted hint, trailing slot. */
export function SectionHeading({
  title,
  hint,
  trailing,
  className,
}: {
  title: string
  hint?: string
  trailing?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        "mb-5 flex items-end justify-between gap-3 border-b border-border pb-3",
        className
      )}
    >
      <div>
        <h2 className="text-sm font-medium">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {trailing}
    </div>
  )
}
