import Link from "next/link"
import { SignIn } from "@clerk/nextjs"
import { ArrowLeftIcon } from "lucide-react"

import { event } from "@/lib/mock-data"

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative flex flex-col justify-between overflow-hidden border-b border-border p-6 lg:border-r lg:border-b-0 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,oklch(73%_0.17_296_/_0.28),transparent_28rem),radial-gradient(circle_at_82%_78%,oklch(73%_0.18_320_/_0.18),transparent_26rem)]" />

          <div className="relative flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="size-3.5" />
              TreasureLoop
            </Link>
            <span className="text-xs text-muted-foreground">
              Organizer console
            </span>
          </div>

          <div className="relative my-12 grid max-w-xl gap-6 lg:my-0">
            <div className="grid gap-3">
              <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
                Event operations
              </p>
              <h1 className="font-heading text-5xl font-medium leading-[0.95] tracking-tight text-foreground md:text-6xl">
                Run the loop without losing the floor.
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Sign in to configure checkpoints, monitor sponsor traffic,
                and operate the prize desk during your event.
              </p>
            </div>

            <dl className="grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-3">
              <Stat label="Pilot event" value={event.name.split(":")[0]} />
              <Stat label="Venue" value={event.venue} />
              <Stat label="Network" value={event.walletNetwork} />
            </dl>
          </div>

          <div className="relative text-xs text-muted-foreground">
            <p>
              First time here? Create an account, then create an event
              organization to invite your booth staff and prize-desk team.
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 lg:p-12">
          <div className="grid w-full max-w-[360px] gap-7">
            <header className="grid gap-1">
              <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                Welcome back
              </p>
              <h2 className="text-xl font-medium tracking-tight text-foreground">
                Sign in to your operator account
              </h2>
              <p className="text-sm text-muted-foreground">
                Continue with your work email or a single-sign-on provider.
              </p>
            </header>
            <SignIn
              routing="path"
              path="/login"
              signUpUrl="/sign-up"
              forceRedirectUrl="/app"
              signUpForceRedirectUrl="/app"
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-foreground">{value}</dd>
    </div>
  )
}
