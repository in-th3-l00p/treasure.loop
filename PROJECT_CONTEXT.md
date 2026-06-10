# TreasureLoop Project Context

This document gives future AI agents enough context to work on the repository without rediscovering the product, technical stack, and current design state from scratch.

## Product Summary

TreasureLoop turns a conference venue into a playable map.

Attendees scan a starting code, receive clues, and move between physical checkpoints staffed by sponsors. Each checkpoint requires real-world interaction, such as scanning an NFC tag, receiving a code from booth staff, solving a clue, or pairing with another player to combine fragments.

Completion is hybrid:

- Gameplay and scan verification happen off-chain for speed and zero gas friction.
- Completion settles on-chain as a collectible badge minted to the player wallet.
- Valuable rewards are redeemed at a physical prize desk, using the badge as the gate.

The product should serve three groups:

- Attendees: a reason to explore, talk to people, and complete a memorable event activity.
- Sponsors: qualified booth visits and measurable conversations.
- Organizers: configurable routes, checkpoint health, completion proof, badge minting, and prize redemption control.

## Strategic Product Principles

- Real-world presence matters more than pure digital engagement.
- The prize desk is an intentional anti-farming chokepoint.
- Sponsors are not just logos; they are staffed checkpoint operators.
- The game should create conversations, not only scans.
- Event organizers need operational clarity more than visual spectacle.
- The attendee path should feel lightweight: no app install, minimal wallet friction, clear next step.

## Current Technical Stack

The app lives in `webapp/`.

```text
Next.js       16.2.7
React         19.2.4
TypeScript    strict mode
Tailwind CSS  v4
shadcn/ui     base-nova style, Base UI primitives
Icons         lucide-react
Package mgr   npm
```

Important files:

```text
webapp/app/layout.tsx          # Root metadata, fonts, Clerk appearance
webapp/app/globals.css         # Tailwind v4 imports, shadcn tokens, landing styles, .product-shell
webapp/app/page.tsx            # Marketing landing page
webapp/app/login/...           # Clerk organizer sign-in
webapp/app/app/**              # Operator console (overview, routes, sponsors, team, prize desk, booth, preflight)
webapp/app/play/**             # Attendee surface (wallet, scan, progress, claim)
webapp/components/ui/          # shadcn generated components
webapp/components/product/     # Shared console kit: ProductPage, PageHeader, Section, BarChart, Kpi, status
webapp/lib/format.ts           # shortAddress / timeAgo / clockTime
webapp/lib/event-queries.ts    # Console read queries (all real DB)
webapp/db/seed.ts              # Pilot event seed (replaces the old lib/mock-data.ts)
webapp/components.json         # shadcn configuration
```

There is no mock-data module anymore. Every surface reads the database;
the attendee surface fetches its event sheet from `GET /api/play/event`.

## Current Routes

### `/`

Marketing landing page.

Current intent:

- Present TreasureLoop as a polished Web3 conference treasure-hunt protocol.
- Show the core loop: checkpoint discovery, staffed sponsor station, completion badge, reward layer.
- Use expressive visual design and elegant display typography.

Current status:

- The landing page is the strongest visual surface in the repo.
- Preserve it unless the user explicitly asks to redesign it.
- It links to `/login` and `/app` for mocked product exploration.

### `/login`

Clerk organizer sign-in (split layout: brand panel + inline Clerk form).

Current status:

- Real auth. The Clerk widget is restyled via `appearance` in
  `app/layout.tsx` plus `.cl-*` overrides in `globals.css`.

### `/app`

Operator console, real data.

Current intent:

- Quiet event-operations tool: overview (KPIs, real hourly traffic,
  checkpoint health, audit-log activity), route builder (live CRUD via
  Server Actions), sponsors (honest metrics only), team invitations,
  prize desk (glanceable verdict + atomic redemption), booth kiosk
  (distance-readable rotating TOTP), preflight go/no-go.

Current status:

- Redesigned 2026-06 on the shared kit in `webapp/components/product/`.
  Dense, calm, hairline-divided; purple reserved for primary action,
  selection, progress, and status. No mock data and no dead nav links —
  keep it that way.

## Current Seed Event

Source: `webapp/db/seed.ts` (`npm run db:seed`).

```text
Name:    ETH Cluj 2026: TreasureLoop Pilot
Venue:   Cluj Innovation Hall
Dates:   17-19 July 2026
Network: Base Sepolia
Status:  Live rehearsal
```

Mocked concepts:

- Checkpoints:
  - Opening Gate
  - Builder Alley
  - Hardware Vault
  - Protocol Garden
  - Prize Desk
- Sponsors:
  - Neon Labs
  - Ledger
  - Lisk
  - Base Romania
- Rewards:
  - On-chain finisher badge
  - Ledger Nano raffle
  - Speaker dinner pass
  - Conference merch pack

Keep future mock data internally consistent. If changing event size, update all related numbers and labels together.

## Design System Notes

The repository currently contains two different design needs:

1. Brand/marketing surface for the landing page.
2. Product/operations surface for the authenticated app.

Do not force one visual language onto both.

### Landing Design

The landing page may use:

- Expressive editorial typography.
- Larger visual rhythm.
- Atmospheric purple lighting.
- A more premium Web3 event tone.

Current display font:

- `Newsreader`, loaded in `webapp/app/layout.tsx`.

### Product Design

The product UI should be:

- Operational.
- Dense enough for repeated use.
- Calm and predictable.
- Based on shadcn components and semantic tokens.
- Purple-accented, not purple-saturated everywhere.

Avoid:

- Huge display headings inside app chrome.
- Editorial serif headings in tables, nav, controls, cards, and labels.
- Decorative cards for every data point.
- Overly dark inactive navigation that becomes unreadable.
- Letting landing CSS leak into app routes.

### Current Token Layer

`webapp/app/globals.css` contains shadcn variables and landing-specific CSS in one file. This is workable but fragile.

Future improvement:

- Keep shadcn tokens at the top.
- Scope landing-specific selectors with landing-only classes.
- Add product-specific wrapper classes if needed, such as `.product-shell`, rather than broad global heading rules.

## shadcn Setup

`webapp/components.json`:

```json
{
  "style": "base-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

Installed components include:

- `button`
- `card`
- `input`
- `label`
- `badge`
- `tabs`
- `separator`
- `progress`
- `avatar`
- `table`
- `dropdown-menu`
- `field`
- `select`
- `switch`
- `textarea`
- `tooltip`

Use these before creating custom UI primitives.

## Product UI State (2026-06)

The quiet operations-console direction recommended here has shipped:

- `/app` is a restrained sans console; purple is reserved for primary
  action, selected nav, progress, and status accents. The overview's
  first viewport answers: is the event ready (preflight chip), which
  checkpoint needs action, how many players are moving, are sponsor
  visits and badge mints flowing.
- The surfaces are decomposed: overview, route builder (live CRUD),
  sponsor report, team, prize desk verification, booth kiosk, preflight.
- The data model is real (see `webapp/db/schema.ts`): events, routes,
  checkpoints, sponsors, players, scans, badge mints, rewards,
  redemption claims, staff assignments, audit log.

Read ROADMAP.md for what is still pending (KV rate limits, contract
deployment, sponsor lead consent, observability, hardening).

## Design Conventions To Preserve

- Shared console primitives live in `webapp/components/product/` —
  use them (ProductPage, PageHeader, Section, SectionHeading, Kpi,
  BarChart, CheckpointStatus, PageEmpty) before inventing new ones.
- No fake numbers. If a metric isn't derivable from the database yet,
  show an honest empty state instead of inventing a value.
- No dead links or buttons. If a feature isn't built, don't render
  chrome that pretends it is.

## Verification

Run from `webapp/`:

```bash
npm run lint
npm run build
```

For visual work:

```bash
npm run start -- --port 3010
npx playwright screenshot --viewport-size=1440,1100 http://localhost:3010/ ../treasureloop-route.png
npx playwright screenshot --viewport-size=390,1200 http://localhost:3010/app ../treasureloop-app-mobile.png
```

Always inspect screenshots before claiming the design is ready.

## Git Policy

The user requested a clean history.

- Commit each coherent change.
- Use short single-purpose commit messages.
- Do not add co-author trailers.
- Do not amend or squash unless explicitly asked.
- Do not leave unrelated generated files unstaged if they belong to the change.
- Do not commit `node_modules` or `.next`.

## Current Commit History Shape

Recent commits include:

```text
Add TreasureLoop landing webapp
Initialize shadcn theme
Add shadcn app primitives
Mock organizer login
Mock event operations dashboard
Link landing to mock app
Fix app heading scope and add mock screenshots
```

The working tree should be clean before handing off work.

## Communication Notes For Future Agents

- Be direct about design quality. If the current mock is weak, say so and fix it deliberately.
- Do not ask the user to approve every minor code edit.
- Do ask before changing the product direction, visual language, or route structure.
- Preserve the landing page unless told otherwise.
- Treat screenshots as evidence, not decoration.
