import Link from "next/link"
import { SignUp } from "@clerk/nextjs"
import { ArrowLeftIcon } from "lucide-react"

export default function SignUpPage() {
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
              Operator sign up
            </span>
          </div>

          <div className="relative my-12 grid max-w-xl gap-6 lg:my-0">
            <div className="grid gap-3">
              <p className="font-mono text-[11px] tracking-[0.18em] text-primary uppercase">
                Get started
              </p>
              <h1 className="font-heading text-5xl font-medium leading-[0.95] tracking-tight text-foreground md:text-6xl">
                Stand up an event in one afternoon.
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-muted-foreground">
                Create your account, spin up an organization for the event,
                and invite the booth staff and prize-desk operators you
                need.
              </p>
            </div>

            <ul className="grid gap-3 border-t border-border pt-5 text-sm text-muted-foreground">
              <Step n="01" title="Sign up">
                Email + password or a single-sign-on provider.
              </Step>
              <Step n="02" title="Create the event organization">
                Each event scopes its checkpoints, sponsors, and prize stock.
              </Step>
              <Step n="03" title="Invite your team">
                Pick roles per invite: organizer, booth staff, prize desk,
                sponsor.
              </Step>
            </ul>
          </div>

          <div className="relative text-xs text-muted-foreground">
            <p>
              Already have an account?{" "}
              <Link href="/login" className="text-foreground underline">
                Sign in instead
              </Link>
              .
            </p>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 lg:p-12">
          <div className="grid w-full max-w-[360px] gap-7">
            <header className="grid gap-1">
              <p className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase">
                Create account
              </p>
              <h2 className="text-xl font-medium tracking-tight text-foreground">
                Set up your operator profile
              </h2>
              <p className="text-sm text-muted-foreground">
                You can invite your team after creating the event
                organization.
              </p>
            </header>
            <SignUp
              routing="path"
              path="/sign-up"
              signInUrl="/login"
              forceRedirectUrl="/app"
              signInForceRedirectUrl="/app"
            />
          </div>
        </section>
      </div>
    </main>
  )
}

function Step({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <li className="grid grid-cols-[28px_1fr] gap-3">
      <span className="grid size-7 place-items-center rounded-full border border-primary/30 bg-primary/10 font-mono text-[10px] font-medium text-primary">
        {n}
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{children}</p>
      </div>
    </li>
  )
}
