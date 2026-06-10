import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * The one primary action every play screen ends with. Solid primary,
 * thumb-height, full width — the same shape on every screen so the
 * player never hunts for "what's next".
 */
const base =
  "inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium transition-colors disabled:opacity-60"

const variants = {
  primary:
    "bg-primary text-primary-foreground shadow-[0_8px_24px_-10px_oklch(56%_0.18_286_/_0.6)] hover:bg-primary/90",
  secondary:
    "border border-border bg-card/40 text-foreground hover:bg-card/60",
} as const

type Variant = keyof typeof variants

export function PlayCta({
  href,
  variant = "primary",
  className,
  children,
  ...props
}: {
  href?: string
  variant?: Variant
  className?: string
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const classes = cn(base, variants[variant], className)
  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button type="button" className={classes} {...props}>
      {children}
    </button>
  )
}
