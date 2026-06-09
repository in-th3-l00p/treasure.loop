import { CreateOrganization } from "@clerk/nextjs"

export default function NoOrganizationPage() {
  return (
    <div className="product-shell flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid max-w-md gap-8 text-center">
        <div className="grid gap-2">
          <span className="mx-auto grid size-10 place-items-center rounded-md bg-primary/15 text-primary">
            <span className="block size-2 rounded-full bg-primary" />
          </span>
          <h1 className="text-xl font-medium tracking-tight">
            Pick or create an event
          </h1>
          <p className="text-sm text-muted-foreground">
            TreasureLoop scopes every checkpoint, scan, and badge to an
            event. Create one to start configuring, or wait for an
            invitation from an organizer.
          </p>
        </div>
        <CreateOrganization
          afterCreateOrganizationUrl="/app"
          skipInvitationScreen
        />
      </div>
    </div>
  )
}
