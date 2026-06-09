import { NextResponse } from "next/server"
import { verifyWebhook } from "@clerk/nextjs/webhooks"

import {
  archiveEventForOrg,
  ensureEventForOrg,
} from "@/lib/event-provisioning"

/**
 * Clerk webhook → event lifecycle.
 *
 * Wire-up (one-time, Clerk dashboard):
 *   1. Endpoints → Add endpoint → https://<your-domain>/api/webhooks/clerk
 *   2. Subscribe to: organization.created, organization.updated,
 *      organization.deleted
 *   3. Copy the signing secret into CLERK_WEBHOOK_SIGNING_SECRET in
 *      the webapp environment.
 *
 * If you don't wire the webhook the app still works for the first
 * person who signs in to an org — the `/no-organization` page calls
 * `ensureEventForOrg` server-side as a fallback.
 */
export async function POST(req: Request) {
  let event: Awaited<ReturnType<typeof verifyWebhook>>
  try {
    event = await verifyWebhook(req)
  } catch (err) {
    return NextResponse.json(
      { error: "invalid-signature", message: String(err) },
      { status: 401 }
    )
  }

  switch (event.type) {
    case "organization.created":
    case "organization.updated": {
      const data = event.data as { id: string; name: string }
      await ensureEventForOrg({ orgId: data.id, orgName: data.name })
      return NextResponse.json({ ok: true })
    }
    case "organization.deleted": {
      const data = event.data as { id?: string }
      if (data.id) await archiveEventForOrg(data.id)
      return NextResponse.json({ ok: true })
    }
    default:
      // Ignore everything else (user.*, session.*, etc.) but ack so
      // Clerk doesn't retry.
      return NextResponse.json({ ok: true, ignored: event.type })
  }
}
