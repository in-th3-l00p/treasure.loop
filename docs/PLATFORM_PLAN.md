# TreasureLoop → social treasure-hunt platform

The plan to evolve TreasureLoop from a single-event PoC into a Luma-style
social platform: discover IRL treasure-hunt events, join them, play the
hunt, and collect on-chain finisher badges into a profile.

## Locked product decisions
- **Player identity:** wallet-first (SIWE) login + an *optional* off-chain
  profile (handle / avatar / bio). No email for players.
- **Discovery:** per-event visibility (`public` / `unlisted` / `private`);
  a public directory; hosting configurable (org-gated to start).
- **Social scope:** Luma-lite first (explore, event pages, RSVP/join,
  "my events", basic profile). Defer the heavy social graph. Then wire the
  treasure-hunt gameplay into each event.

## The structural truth
Today the player side assumes a **single active event**
(`currentEventId()` throws with >1). A multi-event app can't. So the
linchpin is **making play event-scoped** — a refactor on the critical
path; almost everything else is additive.

We already have **half** the product:
- ✅ **Host/build side** — the `/app` console configures an event's routes,
  checkpoints, sponsors, rewards, staff ("create the hunt").
- 🆕 **Player/discover/play side** — browse events, join, profile, and play
  *a chosen* event (not "the" event).

## Data model deltas
- `player_profiles` (global, wallet-keyed): `wallet` PK, `handle` unique,
  `display_name`, `avatar_url`, `bio`, `created_at`. Distinct from the
  per-event `players` participation/progress row.
- `events` gains: `visibility` enum, `summary`, `cover_image_url`.
- `event_rsvps` (`event_id`, `wallet`, `status` = `going|interested`) — the
  lightweight "attending" signal, separate from "started playing".
- Profile **collection** derives from existing `badge_mints` + scans.

## Information architecture
- `/` marketing landing (keep).
- `/explore` public event directory (`visibility=public` only).
- `/home` signed-in player home: **My events** + **Explore**.
- `/e/[slug]` public event page: cover, summary, host, who's going,
  Join/RSVP, Play entry when live.
- `/e/[slug]/play[/scan|progress|claim|pair]` — event-scoped gameplay
  (replaces today's global `/play/*`).
- `/u/[handle]` public player profile (events attended, badge collection).
- `/app/**` operator/host console, unchanged (Clerk).

Three surfaces: marketing, player social app (SIWE), host console (Clerk).

## Phased roadmap
- **Phase 0 — Event-scoping foundation.** Replace `currentEventId()` with
  event-from-request; thread `eventId` through `/api/play/*`, the play
  session, and `player-store`. Add `events.visibility` + public metadata.
  Invisible to users; unblocks everything; highest risk → first.
- **Phase 1 — Player shell & discovery (Luma-lite).** Wallet profiles +
  setup; player home (My events / Explore); public event pages with
  RSVP/join; the Explore directory; a player app shell.
- **Phase 2 — The real treasure hunt, per event.** Wire scan / pair /
  clue / mint into event-scoped play; deepen into clue-chain UX, live
  progress, per-event leaderboard, badge collection on the profile.
- **Phase 3 — Hosting + social + polish (later).** Self-serve wallet
  hosting; social graph (following, feeds, comments, friend leaderboards);
  the responsive/desktop pass (fix the "too mobilish on desktop" feel).

## Open decisions (resolve while building)
1. Self-serve wallet hosting vs keep hosting org-gated (default: org-gated
   for Phase 1–2, self-serve in Phase 3).
2. Image storage for avatars/covers (Vercel Blob / S3 — new infra).
3. Notifications are in-app only (wallet-first → no email).
4. Discovery dimensions: location/map filters vs date + search to start.
5. RSVP vs Join: wallet required at join, or RSVP first + wallet at play.

## Risks
- The event-scoping refactor touches the entire play surface + session +
  every play API. Tractable (218 tests) but it's the real work → sequence
  first, verify continuously.
- Two identity systems (Clerk hosts / SIWE players) create seams; the plan
  keeps them separate by surface to contain the cost.
- A public directory is a moderation surface once hosting opens up.
