import { cn } from "@/lib/utils"

/**
 * Layout primitives every console page shares. One source for the page
 * container width and the header pattern so the surfaces stay aligned.
 */

export function ProductPage({
  className,
  children,
  width = "wide",
}: {
  className?: string
  children: React.ReactNode
  width?: "wide" | "narrow"
}) {
  return (
    <div
      className={cn(
        "mx-auto px-6 pt-8 pb-16 lg:px-10",
        width === "wide" ? "max-w-[1280px]" : "max-w-[1180px]",
        className
      )}
    >
      {children}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children?: React.ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-6 pb-8">
      <div className="max-w-xl">
        <h1 className="text-xl font-medium tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  )
}
