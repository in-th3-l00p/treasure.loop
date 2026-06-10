# Product

## Register

product

(The marketing landing at `/` is a brand surface and is design-approved: preserve it. Every other route — `/app/**`, `/play/**`, `/login`, `/sign-up` — is product register.)

## Users

- **Organizers** run a live conference treasure hunt from the console (`/app`). Context: a noisy venue, a laptop at an ops table, repeated glances during a three-day event. Job: know the event is healthy, find the checkpoint that needs action, configure routes/staff/rewards before doors open.
- **Booth staff** stand at a sponsor station with a tablet (`/app/booth`). Job: read the rotating verification code to attendees, see scans arriving, raise a hand when something breaks.
- **Prize-desk staff** verify wallets and hand out physical rewards (`/app/prize-desk`). Job: sub-minute wallet lookup → eligibility verdict → redeem, with a queue of people watching.
- **Sponsors** check traffic and conversation metrics (`/app/sponsors`). Job: prove booth ROI.
- **Attendees** play on their phones, outdoors-bright venue lighting, one thumb, mid-conversation (`/play`). Job: see the next clue, enter a code, mint a badge. No app install, minimal wallet friction, always a clear next step.

## Product Purpose

TreasureLoop turns a conference venue into a playable map: attendees route between staffed sponsor checkpoints, completion mints an on-chain badge (Base), and the badge gates physical prize redemption. The console is the operations tool that makes a live event runnable without panic; the play surface is the attendee's entire game interface. Success: an organizer can answer "is the event ready / what needs action / are players moving" from the first viewport, and an attendee never wonders what to do next.

## Brand Personality

Operational, calm, trustworthy. The product surfaces should feel like a precise operations tool built by people who have run live events: dense enough for repeated use, predictable, quiet. Purple is the identity accent (primary action, selected nav, progress, status), never the wallpaper. The attendee surface may carry slightly more warmth and event energy than the console, but stays lightweight and legible on a phone in a bright hall.

## Anti-references

- The rejected first `/app` mock: visually heavy, borrowed landing-page drama, prioritized looking dramatic over workflow clarity.
- Huge editorial serif display headings inside app chrome (tables, nav, controls, cards, labels).
- Decorative cards wrapping every data point; dashboard-as-poster.
- Purple-saturated everything; "crypto neon on black" clichés.
- Landing CSS leaking into product routes (broad `h1/h2/h3` selectors).
- Generic SaaS hero-metric templates and identical icon-card grids.

## Design Principles

1. **First viewport answers the operator's question.** Every console screen leads with the state that decides the next action: is it ready, what's broken, what's moving.
2. **Calm under load.** Staff use these screens dozens of times a day during a live event; restrained color, stable layout, no decoration that competes with data.
3. **Purple is a signal, not a skin.** Reserve the accent for primary actions, selection, progress, and live status.
4. **The attendee path is one clear next step.** Each play screen has exactly one primary action, thumb-reachable, readable in bright light.
5. **Real-world presence over digital spectacle.** The UI serves staffed booths, physical desks, and foot traffic; it should read as event operations, not a token dashboard.

## Accessibility & Inclusion

- Target WCAG 2.1 AA (roadmap Phase 10: axe-core in CI, VoiceOver/Safari iOS testing).
- Attendee surface: mobile-first, large touch targets, works one-handed, legible under bright venue light.
- Booth kiosk: codes readable from a distance (large type, high contrast).
- `prefers-reduced-motion` respected globally (already wired in globals.css; keep it).
