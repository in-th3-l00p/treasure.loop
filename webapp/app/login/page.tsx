import Link from "next/link"
import { ArrowRightIcon, BadgeCheckIcon, KeyRoundIcon, MapPinnedIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { event } from "@/lib/mock-data"

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">
        <section className="relative flex flex-col justify-between overflow-hidden border-b border-border p-6 lg:border-r lg:border-b-0 lg:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,oklch(73%_0.17_296_/_0.28),transparent_28rem),radial-gradient(circle_at_82%_78%,oklch(73%_0.18_320_/_0.18),transparent_26rem)]" />
          <div className="relative flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 font-semibold">
              <span className="grid size-9 place-items-center rounded-xl border border-border bg-primary/20 text-primary">
                <MapPinnedIcon />
              </span>
              TreasureLoop
            </Link>
            <Badge variant="secondary">Organizer preview</Badge>
          </div>

          <div className="relative my-16 max-w-xl lg:my-0">
            <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.18em] text-primary">
              Event operations console
            </p>
            <h1 className="font-heading text-6xl font-medium leading-[0.95] tracking-normal text-foreground md:text-7xl">
              Run the loop without losing the floor.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
              A mocked sign-in for the organizer cockpit: checkpoint health,
              sponsor traffic, clue routing, badge minting, and prize desk
              verification in one place.
            </p>
          </div>

          <div className="relative grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">Event</p>
              <p className="mt-1 font-medium text-foreground">{event.name}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">Venue</p>
              <p className="mt-1 font-medium text-foreground">{event.venue}</p>
            </div>
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">Network</p>
              <p className="mt-1 font-medium text-foreground">{event.walletNetwork}</p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center p-6 lg:p-10">
          <Card className="w-full max-w-md border-border/80 bg-card/80 shadow-2xl shadow-primary/10">
            <CardHeader>
              <div className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                <KeyRoundIcon />
              </div>
              <CardTitle className="text-2xl">Sign in to TreasureLoop</CardTitle>
              <CardDescription>
                Use the mocked organizer credentials to enter the event console.
              </CardDescription>
              <CardAction>
                <Badge variant="outline">Mock</Badge>
              </CardAction>
            </CardHeader>
            <CardContent>
              <form className="flex flex-col gap-5">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="email">Email</FieldLabel>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      defaultValue="ops@treasure.loop"
                    />
                    <FieldDescription>
                      Demo account for the event organizer role.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="password">Password</FieldLabel>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      defaultValue="treasure-demo"
                    />
                  </Field>
                </FieldGroup>

                <Button className="h-10 w-full" render={<Link href="/app" />}>
                  Open mocked console
                  <ArrowRightIcon data-icon="inline-end" />
                </Button>
              </form>

              <Separator className="my-6" />

              <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/40 p-3">
                <BadgeCheckIcon className="mt-0.5 text-primary" />
                <div>
                  <p className="text-sm font-medium">No authentication is wired yet.</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    This is a visual mock for product feel, event flow, and interface
                    hierarchy.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  )
}
