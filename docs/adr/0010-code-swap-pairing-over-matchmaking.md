# 0010 — Code-swap pairing UX over hosted real-time matchmaking

## Context

A "pair" checkpoint (`clue_type = 'pair'`) issues two complementary
fragments — A or B — alternating between players. To clear the
checkpoint, a player holding fragment A must combine it with someone
else's fragment B (`ROADMAP.md` Phase 7).

`ROADMAP.md` ("Open questions" #5) frames the UX choice: **hosted
real-time matchmaking** (the server pairs two waiting players live, e.g.
over websockets / presence) versus a **code-swap UX** (each player sees a
short code; they meet in person, read each other's code, and type it in).

Forces:

- Event-day reliability beats cleverness. A pair checkpoint that fails
  under flaky conference wifi or a presence-service hiccup is a broken
  game mechanic in front of attendees.
- The mechanic is inherently *in-person* — the two players are physically
  at the same checkpoint — so a code read aloud or shown on a phone is a
  natural, low-tech exchange.
- Real-time matchmaking adds a stateful service (presence, sockets,
  queueing, edge cases like one player leaving mid-match) with more
  moving parts and more failure modes.

## Decision

Use a **code-swap pairing UX**; do not build hosted real-time
matchmaking.

- A pair checkpoint issues a fragment with a short code; the player sees
  e.g. "Your fragment is **A: 4QPM**. Find someone with **B** and pair,"
  with a text input for the other player's code (`ROADMAP.md` Phase 7).
- `/api/play/pair` validates that the two submitted fragments are
  complementary (one A, one B) and records the pairing in
  `pair_completions`, granting both players credit.
- A "this person is cheating" report flow flags suspicious pairs for
  organizer review.

## Consequences

**Positive**
- Bulletproof on event day — no live socket/presence service to keep up
  under venue network conditions; pairing is a single validated POST.
- Matches the in-person nature of the mechanic; the code exchange happens
  exactly where the players already are.
- Far smaller surface to build, test, and operate than real-time
  matchmaking.

**Negative / trade-offs**
- Slightly more manual for players (read/type a code) than an automatic
  "you've been matched" pop-up.
- Codes can be shared out-of-band to game the system; the cheating-report
  flow plus organizer review is the mitigation, not a hard block.
- No "looking for a partner" discovery — players self-organize on the
  floor.

## Status

Accepted — 2026-06. **Already implemented** this way: fragments schema,
A/B issuance with balancing, the `/play/pair` combine screen,
`/api/play/pair`, and the cheating-report flag all shipped (ROADMAP
Phase 7, marked ✅).
