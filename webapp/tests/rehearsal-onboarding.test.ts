import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { and, eq, isNull } from "drizzle-orm"

import {
  __resetStoreDb,
  __setStoreDb,
  getPublicEvent,
  isEventInRehearsal,
} from "@/lib/player-store"
import { auditLog, events } from "@/db/schema"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * Phase 11 — dress-rehearsal mode + onboarding completion state.
 *
 * We don't import the Server Actions (they need Clerk auth context).
 * Instead we exercise:
 *   - the store helper the mint-permit route calls (`isEventInRehearsal`),
 *     which is the mint path's rehearsal decision, and
 *   - the SQL shape the toggle / onboarding actions rely on (an
 *     event-scoped UPDATE + an in-transaction audit row).
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db as unknown as never)
  const seeded = await seedTestEvent(handle.db, 3)
  eventId = seeded.event.id
})

afterEach(async () => {
  __resetStoreDb()
  await handle.client.close()
})

describe("rehearsal flag default + mint-path decision", () => {
  it("a fresh event is not in rehearsal by default", async () => {
    const [row] = await handle.db
      .select({ rehearsal: events.rehearsal })
      .from(events)
      .where(eq(events.id, eventId))
    expect(row.rehearsal).toBe(false)
    expect(await isEventInRehearsal(eventId)).toBe(false)
  })

  it("toggling rehearsal on flips the mint-path decision", async () => {
    await handle.db
      .update(events)
      .set({ rehearsal: true })
      .where(eq(events.id, eventId))
    expect(await isEventInRehearsal(eventId)).toBe(true)

    await handle.db
      .update(events)
      .set({ rehearsal: false })
      .where(eq(events.id, eventId))
    expect(await isEventInRehearsal(eventId)).toBe(false)
  })

  it("the rehearsal flag is event-scoped — flipping one leaves others live", async () => {
    const other = await seedTestEvent(handle.db, 3)
    await handle.db
      .update(events)
      .set({ rehearsal: true })
      .where(eq(events.id, eventId))

    expect(await isEventInRehearsal(eventId)).toBe(true)
    expect(await isEventInRehearsal(other.event.id)).toBe(false)
  })

  it("surfaces rehearsal on the public event sheet the claim screen reads", async () => {
    let sheet = await getPublicEvent(eventId)
    expect(sheet?.rehearsal).toBe(false)

    await handle.db
      .update(events)
      .set({ rehearsal: true })
      .where(eq(events.id, eventId))

    sheet = await getPublicEvent(eventId)
    expect(sheet?.rehearsal).toBe(true)
  })

  it("a rehearsal toggle writes an audit row inside the same transaction", async () => {
    await handle.db.transaction(async (tx) => {
      await tx
        .update(events)
        .set({ rehearsal: true })
        .where(eq(events.id, eventId))
      await tx.insert(auditLog).values({
        eventId,
        actor: "organizer",
        action: "event.rehearsal_enabled",
        target: eventId,
        meta: { rehearsal: true },
      })
    })

    const logs = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, eventId))
    expect(logs).toHaveLength(1)
    expect(logs[0].action).toBe("event.rehearsal_enabled")
  })
})

describe("onboarding completion state", () => {
  it("a fresh event needs onboarding (onboardedAt is null)", async () => {
    const [row] = await handle.db
      .select({ onboardedAt: events.onboardedAt })
      .from(events)
      .where(eq(events.id, eventId))
    expect(row.onboardedAt).toBeNull()
  })

  it("completing onboarding stamps onboardedAt and stops the nag", async () => {
    const stamp = new Date()
    await handle.db
      .update(events)
      .set({ onboardedAt: stamp })
      .where(and(eq(events.id, eventId), isNull(events.onboardedAt)))

    const [row] = await handle.db
      .select({ onboardedAt: events.onboardedAt })
      .from(events)
      .where(eq(events.id, eventId))
    expect(row.onboardedAt).not.toBeNull()
  })

  it("re-running completion never overwrites the first stamp", async () => {
    const first = new Date("2026-01-01T00:00:00Z")
    await handle.db
      .update(events)
      .set({ onboardedAt: first })
      .where(and(eq(events.id, eventId), isNull(events.onboardedAt)))

    // A second completion is guarded by `isNull(onboardedAt)` — it's a no-op.
    await handle.db
      .update(events)
      .set({ onboardedAt: new Date("2026-06-01T00:00:00Z") })
      .where(and(eq(events.id, eventId), isNull(events.onboardedAt)))

    const [row] = await handle.db
      .select({ onboardedAt: events.onboardedAt })
      .from(events)
      .where(eq(events.id, eventId))
    expect(row.onboardedAt?.toISOString()).toBe(first.toISOString())
  })
})
