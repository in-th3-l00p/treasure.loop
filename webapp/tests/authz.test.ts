import { describe, expect, it } from "vitest"

import {
  ALL_ROLES,
  APP_ROUTES,
  AuthSubject,
  ROLES,
  Role,
  canAccessRoute,
  canConfigureEvent,
  canInviteStaff,
  canIssueScan,
  canVerifyRedemption,
  canViewOverview,
  canViewPlayers,
  canViewSponsorReports,
  hasRole,
  isMember,
  isRole,
} from "@/lib/authz"

// ───────────────────────────── Helpers ─────────────────────────────

const anon: AuthSubject = { userId: null, orgId: null, orgRole: null }
const signedInNoOrg: AuthSubject = {
  userId: "user_1",
  orgId: null,
  orgRole: null,
}
const signedInWithOrgNoRole: AuthSubject = {
  userId: "user_1",
  orgId: "org_1",
  orgRole: null,
}

const subject = (role: Role): AuthSubject => ({
  userId: "user_1",
  orgId: "org_1",
  orgRole: role,
})

// ─────────────────────────── Type guards ───────────────────────────

describe("isRole", () => {
  it("accepts every known role", () => {
    for (const role of ALL_ROLES) {
      expect(isRole(role)).toBe(true)
    }
  })

  it("rejects unknown strings", () => {
    expect(isRole("admin")).toBe(false)
    expect(isRole("organizer")).toBe(false) // missing the `org:` prefix
    expect(isRole("")).toBe(false)
  })

  it("rejects non-strings", () => {
    expect(isRole(null)).toBe(false)
    expect(isRole(undefined)).toBe(false)
    expect(isRole(42)).toBe(false)
    expect(isRole({})).toBe(false)
  })
})

// ───────────────────────────── isMember ─────────────────────────────

describe("isMember", () => {
  it("rejects anonymous subjects", () => {
    expect(isMember(anon)).toBe(false)
  })

  it("rejects signed-in users with no org", () => {
    expect(isMember(signedInNoOrg)).toBe(false)
  })

  it("rejects signed-in users in an org with no/invalid role", () => {
    expect(isMember(signedInWithOrgNoRole)).toBe(false)
    expect(
      isMember({ userId: "u", orgId: "o", orgRole: "org:bogus" })
    ).toBe(false)
  })

  it("accepts members with a known role", () => {
    for (const role of ALL_ROLES) {
      expect(isMember(subject(role))).toBe(true)
    }
  })
})

// ───────────────────────────── hasRole ─────────────────────────────

describe("hasRole", () => {
  it("returns false for non-members regardless of allowed set", () => {
    expect(hasRole(anon, [ROLES.ORGANIZER])).toBe(false)
    expect(hasRole(signedInNoOrg, ALL_ROLES)).toBe(false)
  })

  it("returns true only if subject role is in allowed list", () => {
    const organizer = subject(ROLES.ORGANIZER)
    expect(hasRole(organizer, [ROLES.ORGANIZER])).toBe(true)
    expect(hasRole(organizer, [ROLES.PRIZE_DESK])).toBe(false)
    expect(hasRole(organizer, [ROLES.ORGANIZER, ROLES.PRIZE_DESK])).toBe(
      true
    )
  })
})

// ─────────────────────────── Policy surface ───────────────────────────

describe("canViewOverview", () => {
  it("denies anonymous and non-members", () => {
    expect(canViewOverview(anon)).toBe(false)
    expect(canViewOverview(signedInNoOrg)).toBe(false)
  })

  it("allows every org role", () => {
    for (const role of ALL_ROLES) {
      expect(canViewOverview(subject(role))).toBe(true)
    }
  })
})

describe("canConfigureEvent", () => {
  it("allows only organizers", () => {
    expect(canConfigureEvent(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canConfigureEvent(subject(ROLES.PRIZE_DESK))).toBe(false)
    expect(canConfigureEvent(subject(ROLES.BOOTH_STAFF))).toBe(false)
    expect(canConfigureEvent(subject(ROLES.SPONSOR))).toBe(false)
  })
})

describe("canIssueScan", () => {
  it("allows organizers and booth staff", () => {
    expect(canIssueScan(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canIssueScan(subject(ROLES.BOOTH_STAFF))).toBe(true)
  })

  it("denies prize desk and sponsors", () => {
    expect(canIssueScan(subject(ROLES.PRIZE_DESK))).toBe(false)
    expect(canIssueScan(subject(ROLES.SPONSOR))).toBe(false)
  })
})

describe("canVerifyRedemption", () => {
  it("allows organizers and prize desk", () => {
    expect(canVerifyRedemption(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canVerifyRedemption(subject(ROLES.PRIZE_DESK))).toBe(true)
  })

  it("denies booth staff and sponsors", () => {
    expect(canVerifyRedemption(subject(ROLES.BOOTH_STAFF))).toBe(false)
    expect(canVerifyRedemption(subject(ROLES.SPONSOR))).toBe(false)
  })
})

describe("canViewPlayers", () => {
  it("allows only organizers (PII surface)", () => {
    expect(canViewPlayers(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canViewPlayers(subject(ROLES.PRIZE_DESK))).toBe(false)
    expect(canViewPlayers(subject(ROLES.BOOTH_STAFF))).toBe(false)
    expect(canViewPlayers(subject(ROLES.SPONSOR))).toBe(false)
  })
})

describe("canViewSponsorReports", () => {
  it("allows organizers and sponsors", () => {
    expect(canViewSponsorReports(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canViewSponsorReports(subject(ROLES.SPONSOR))).toBe(true)
  })

  it("denies prize desk and booth staff", () => {
    expect(canViewSponsorReports(subject(ROLES.PRIZE_DESK))).toBe(false)
    expect(canViewSponsorReports(subject(ROLES.BOOTH_STAFF))).toBe(false)
  })
})

describe("canInviteStaff", () => {
  it("allows only organizers", () => {
    expect(canInviteStaff(subject(ROLES.ORGANIZER))).toBe(true)
    expect(canInviteStaff(subject(ROLES.PRIZE_DESK))).toBe(false)
  })
})

// ────────────────────────── canAccessRoute ───────────────────────────

describe("canAccessRoute", () => {
  it("denies anyone who isn't a member", () => {
    expect(canAccessRoute(anon, "/app")).toBe(false)
    expect(canAccessRoute(signedInNoOrg, "/app")).toBe(false)
    expect(canAccessRoute(signedInWithOrgNoRole, "/app")).toBe(false)
  })

  it("matches /app exactly for every member role", () => {
    for (const role of ALL_ROLES) {
      expect(canAccessRoute(subject(role), "/app")).toBe(true)
    }
  })

  it("gates configuration routes to organizer", () => {
    expect(canAccessRoute(subject(ROLES.ORGANIZER), "/app/routes")).toBe(
      true
    )
    expect(canAccessRoute(subject(ROLES.BOOTH_STAFF), "/app/routes")).toBe(
      false
    )
    expect(
      canAccessRoute(subject(ROLES.ORGANIZER), "/app/checkpoints")
    ).toBe(true)
    expect(
      canAccessRoute(subject(ROLES.PRIZE_DESK), "/app/checkpoints")
    ).toBe(false)
  })

  it("gates prize desk and verification to prize_desk and organizer", () => {
    expect(
      canAccessRoute(subject(ROLES.PRIZE_DESK), "/app/prize-desk")
    ).toBe(true)
    expect(
      canAccessRoute(subject(ROLES.ORGANIZER), "/app/verification")
    ).toBe(true)
    expect(
      canAccessRoute(subject(ROLES.BOOTH_STAFF), "/app/prize-desk")
    ).toBe(false)
    expect(canAccessRoute(subject(ROLES.SPONSOR), "/app/prize-desk")).toBe(
      false
    )
  })

  it("gates sponsor reports to organizer and sponsor", () => {
    expect(canAccessRoute(subject(ROLES.SPONSOR), "/app/sponsors")).toBe(
      true
    )
    expect(
      canAccessRoute(subject(ROLES.BOOTH_STAFF), "/app/sponsors")
    ).toBe(false)
  })

  it("applies the policy to nested paths via prefix match", () => {
    expect(
      canAccessRoute(subject(ROLES.SPONSOR), "/app/sponsors/neon-labs")
    ).toBe(true)
    expect(
      canAccessRoute(subject(ROLES.BOOTH_STAFF), "/app/sponsors/neon-labs")
    ).toBe(false)
    expect(
      canAccessRoute(subject(ROLES.ORGANIZER), "/app/routes/cluj-loop-01")
    ).toBe(true)
  })

  it("falls back to member-only for unmapped /app paths", () => {
    expect(canAccessRoute(subject(ROLES.ORGANIZER), "/app/settings")).toBe(
      true
    )
    expect(canAccessRoute(anon, "/app/settings")).toBe(false)
  })
})

// ─────────────────────────── APP_ROUTES audit ────────────────────────
// Catches accidental policy drift: every declared route must be reachable
// by at least one role and denied to at least one role.

describe("APP_ROUTES policy audit", () => {
  it("every declared route is reachable by an organizer", () => {
    const organizer = subject(ROLES.ORGANIZER)
    for (const route of APP_ROUTES) {
      expect(
        route.check(organizer),
        `organizer should reach ${route.href}`
      ).toBe(true)
    }
  })

  it("no declared route is reachable by anonymous", () => {
    for (const route of APP_ROUTES) {
      expect(
        route.check(anon),
        `anonymous should not reach ${route.href}`
      ).toBe(false)
    }
  })

  it("every non-overview route denies at least one role", () => {
    for (const route of APP_ROUTES) {
      if (route.href === "/app") continue // overview is intentionally open
      const someoneDenied = ALL_ROLES.some(
        (role) => !route.check(subject(role))
      )
      expect(
        someoneDenied,
        `${route.href} should not be open to every role — that's suspicious`
      ).toBe(true)
    }
  })
})
