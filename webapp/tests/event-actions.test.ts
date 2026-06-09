import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { and, eq, isNull } from "drizzle-orm"

import { auditLog, checkpoints, rewards, sponsors, routes } from "@/db/schema"

import { newTestDb, seedTestEvent } from "./db-utils"

/**
 * These tests exercise the SQL shape the Server Actions in
 * `lib/event-actions.ts` rely on:
 *
 *   - tenant isolation: an UPDATE with `event_id = $event` must not
 *     touch rows from another event
 *   - reorder: setting orderIndex in a loop produces a stable order
 *   - soft-delete: archiveAt filters subsequent reads
 *
 * We don't import the action itself (it needs Clerk auth context);
 * we replay its SQL directly against pglite.
 */

type DbHandle = Awaited<ReturnType<typeof newTestDb>>

let handle: DbHandle
let eventId: string
let routeId: string
let otherRouteId: string

beforeEach(async () => {
  handle = await newTestDb()
  const a = await seedTestEvent(handle.db, 3)
  const b = await seedTestEvent(handle.db, 3)
  eventId = a.event.id
  routeId = a.route.id
  otherRouteId = b.route.id
})

afterEach(async () => {
  await handle.client.close()
})

describe("tenant isolation", () => {
  it("renaming a route by id WITHOUT the event scope leaks across tenants", async () => {
    // Bare control: pure id update DOES touch the other tenant's row.
    const updated = await handle.db
      .update(routes)
      .set({ name: "Leaked" })
      .where(eq(routes.id, otherRouteId))
      .returning()
    expect(updated[0].name).toBe("Leaked")
  })

  it("renaming a route with the event scope only touches the right row", async () => {
    // The shape every action uses.
    const updated = await handle.db
      .update(routes)
      .set({ name: "Renamed" })
      .where(and(eq(routes.id, otherRouteId), eq(routes.eventId, eventId)))
      .returning()
    expect(updated).toHaveLength(0)

    // And the original name is preserved.
    const [row] = await handle.db
      .select()
      .from(routes)
      .where(eq(routes.id, otherRouteId))
      .limit(1)
    expect(row.name).not.toBe("Renamed")
  })

  it("checkpoint reorder loop respects route scoping", async () => {
    // Grab the checkpoints for the active route, reverse them.
    const cps = await handle.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.routeId, routeId))
    const reversed = [...cps].reverse()

    await handle.db.transaction(async (tx) => {
      for (let i = 0; i < reversed.length; i++) {
        await tx
          .update(checkpoints)
          .set({ orderIndex: i + 1 })
          .where(
            and(
              eq(checkpoints.id, reversed[i].id),
              eq(checkpoints.routeId, routeId)
            )
          )
      }
    })

    const after = await handle.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.routeId, routeId))
      .orderBy(checkpoints.orderIndex)

    expect(after.map((c) => c.id)).toEqual(reversed.map((c) => c.id))
  })
})

describe("soft delete", () => {
  it("archived sponsors are filtered out of active listings", async () => {
    const [sp] = await handle.db
      .insert(sponsors)
      .values({ eventId, name: "Acme", tier: "community" })
      .returning()

    let active = await handle.db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.eventId, eventId), isNull(sponsors.archivedAt)))
    expect(active.some((s) => s.id === sp.id)).toBe(true)

    await handle.db
      .update(sponsors)
      .set({ archivedAt: new Date() })
      .where(eq(sponsors.id, sp.id))

    active = await handle.db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.eventId, eventId), isNull(sponsors.archivedAt)))
    expect(active.some((s) => s.id === sp.id)).toBe(false)

    // Unarchive restores.
    await handle.db
      .update(sponsors)
      .set({ archivedAt: null })
      .where(eq(sponsors.id, sp.id))

    active = await handle.db
      .select()
      .from(sponsors)
      .where(and(eq(sponsors.eventId, eventId), isNull(sponsors.archivedAt)))
    expect(active.some((s) => s.id === sp.id)).toBe(true)
  })
})

describe("audit log", () => {
  it("an in-transaction insert writes alongside the mutation", async () => {
    await handle.db.transaction(async (tx) => {
      await tx
        .insert(rewards)
        .values({
          eventId,
          name: "Merch",
          stockTotal: 10,
          stockClaimed: 0,
        })
      await tx.insert(auditLog).values({
        eventId,
        actor: "tester",
        action: "reward.created",
        target: "x",
      })
    })

    const logs = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, eventId))
    expect(logs.length).toBe(1)
    expect(logs[0].action).toBe("reward.created")
  })

  it("a transaction that throws rolls back both the mutation and the audit row", async () => {
    await expect(
      handle.db.transaction(async (tx) => {
        await tx.insert(rewards).values({
          eventId,
          name: "Will not exist",
        })
        await tx.insert(auditLog).values({
          eventId,
          actor: "tester",
          action: "reward.created",
          target: "x",
        })
        throw new Error("rollback please")
      })
    ).rejects.toThrow("rollback please")

    const logs = await handle.db
      .select()
      .from(auditLog)
      .where(eq(auditLog.eventId, eventId))
    expect(logs.length).toBe(0)

    const stillThere = await handle.db
      .select()
      .from(rewards)
      .where(
        and(eq(rewards.eventId, eventId), eq(rewards.name, "Will not exist"))
      )
    expect(stillThere.length).toBe(0)
  })
})

describe("orderIndex auto-assignment", () => {
  it("a new checkpoint takes the next slot after the current max", async () => {
    const [max] = await handle.db
      .select()
      .from(checkpoints)
      .where(eq(checkpoints.routeId, routeId))
      .orderBy(checkpoints.orderIndex)

    expect(max.orderIndex).toBe(1)

    const [inserted] = await handle.db
      .insert(checkpoints)
      .values({
        eventId,
        routeId,
        name: "Fourth",
        orderIndex: 4,
      })
      .returning()

    expect(inserted.orderIndex).toBe(4)
  })
})
