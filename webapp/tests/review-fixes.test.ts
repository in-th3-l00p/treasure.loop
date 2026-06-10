import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { eq } from "drizzle-orm"

import {
  badgeMints,
  events,
  fragments,
  leadConsents,
  players,
} from "@/db/schema"
import {
  __resetStoreDb,
  __setStoreDb,
  recordBadgeMint,
  recordScan,
} from "@/lib/player-store"
import {
  __resetDataRightsDb,
  __setDataRightsDb,
  erasePlayerData,
} from "@/lib/data-rights"

import { newTestDb, seedTestEvent } from "./db-utils"

const WALLET = "0x1111111111111111111111111111111111111111" as const

let handle: Awaited<ReturnType<typeof newTestDb>>

beforeEach(async () => {
  handle = await newTestDb()
  __setStoreDb(handle.db)
  __setDataRightsDb(handle.db)
})

afterEach(() => {
  __resetStoreDb()
  __resetDataRightsDb()
})

describe("rehearsal mode blocks the mint (regression)", () => {
  it("recordBadgeMint refuses and writes no badge_mints row in rehearsal", async () => {
    const seeded = await seedTestEvent(handle.db, 2)
    const eventId = seeded.event.id
    // Finish the loop.
    for (const id of seeded.checkpointIds) {
      await recordScan({ eventId, wallet: WALLET, checkpointId: id })
    }
    // Flip the event into dress-rehearsal.
    await handle.db
      .update(events)
      .set({ rehearsal: true })
      .where(eq(events.id, eventId))

    const result = await recordBadgeMint({
      eventId,
      wallet: WALLET,
      txHash: "0x" + "ab".repeat(32),
      tokenId: 1,
    })
    expect(result).toBeNull()
    const mints = await handle.db.select().from(badgeMints)
    expect(mints).toHaveLength(0)
  })
})

describe("GDPR erasure removes sponsor-shared PII (regression)", () => {
  it("deletes lead_consents and fragments for the player", async () => {
    const seeded = await seedTestEvent(handle.db, 1)
    const eventId = seeded.event.id
    // Create a player by scanning, then attach a lead consent + fragment.
    await recordScan({
      eventId,
      wallet: WALLET,
      checkpointId: seeded.checkpointIds[0],
    })
    const [player] = await handle.db.select().from(players)
    await handle.db.insert(leadConsents).values({
      eventId,
      playerId: player.id,
      checkpointId: seeded.checkpointIds[0],
      wallet: WALLET,
    })
    await handle.db.insert(fragments).values({
      eventId,
      playerId: player.id,
      checkpointId: seeded.checkpointIds[0],
      fragmentKind: "A",
      shortCode: "ABCDE",
    })

    const result = await erasePlayerData(WALLET, eventId)
    expect(result.erased).toBe(true)
    expect(result.leadConsentsDeleted).toBe(1)
    expect(result.fragmentsDeleted).toBe(1)

    const consents = await handle.db.select().from(leadConsents)
    const frags = await handle.db.select().from(fragments)
    expect(consents).toHaveLength(0)
    expect(frags).toHaveLength(0)
  })
})
