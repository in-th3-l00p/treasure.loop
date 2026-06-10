import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy notice · TreasureLoop",
  description:
    "What TreasureLoop collects when you play, why, what stays on-chain forever, and how to export or erase your data.",
}

const lastUpdated = "June 2026"

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 py-16">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-[0.14em] text-muted-foreground uppercase hover:text-foreground"
      >
        ← TreasureLoop
      </Link>

      <h1 className="mt-8 font-heading text-3xl font-medium tracking-tight">
        Privacy notice
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Plain language, no dark patterns. Last updated {lastUpdated}.
      </p>

      <div className="mt-10 grid gap-9 text-[15px] leading-relaxed text-muted-foreground">
        <section className="grid gap-2">
          <h2 className="text-base font-medium text-foreground">
            What we collect
          </h2>
          <p>
            When you play a TreasureLoop hunt we store, scoped to that one
            event:
          </p>
          <ul className="ml-4 grid list-disc gap-1.5">
            <li>
              <span className="text-foreground">Your wallet address.</span> You
              prove you control it by signing a message (SIWE). We never see or
              store your private keys, and signing never authorizes a payment.
            </li>
            <li>
              <span className="text-foreground">Your scans.</span> Which
              checkpoints you reached and when.
            </li>
            <li>
              <span className="text-foreground">Your redemptions.</span> Which
              physical prizes you claimed at the prize desk, with the time and
              any staff note.
            </li>
            <li>
              <span className="text-foreground">Your finisher badge mint.</span>{" "}
              The transaction hash and token id, if you completed the loop and
              minted.
            </li>
          </ul>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium text-foreground">Why</h2>
          <p>
            We use this only to run the game: to show your progress, to stop a
            checkpoint being claimed twice, to let the prize desk verify you
            finished, and to keep an audit trail for the event organizer. We do
            not sell your data and we do not use it for advertising.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium text-foreground">
            What lives on-chain — and stays there
          </h2>
          <p>
            If you finish and mint your finisher badge, that badge is an NFT on
            a public blockchain (Base). It is tied to your wallet address and is
            permanent and public by design. We cannot edit or delete it — it is
            not ours to remove. Anyone can read it on-chain. Keep that in mind
            before you mint.
          </p>
        </section>

        <section className="grid gap-2">
          <h2 className="text-base font-medium text-foreground">
            Your rights: export and erasure
          </h2>
          <p>
            While signed in to the play surface you can, at any time:
          </p>
          <ul className="ml-4 grid list-disc gap-1.5">
            <li>
              <span className="text-foreground">Export your data</span> — get
              everything we hold about you for the event (wallet, scans,
              redemptions, badge mint) as a JSON file.
            </li>
            <li>
              <span className="text-foreground">Erase your data</span> — we
              delete your scans and redemptions and anonymize your player
              record, then sign you out. The on-chain badge stays, because it is
              public-chain data we cannot delete.
            </li>
          </ul>
          <p>
            Connect your wallet on the{" "}
            <Link href="/play" className="text-primary hover:text-primary/80">
              play page
            </Link>{" "}
            to use these. Questions or a manual request? Contact the event
            organizer who invited you.
          </p>
        </section>
      </div>
    </main>
  )
}
