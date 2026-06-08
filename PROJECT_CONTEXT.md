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
webapp/app/layout.tsx        # Root metadata, fonts, TooltipProvider
webapp/app/globals.css       # Tailwind v4 imports, shadcn tokens, landing styles
webapp/app/page.tsx          # Marketing landing page
webapp/app/login/page.tsx    # Mock organizer login
webapp/app/app/page.tsx      # Mock event operations dashboard
webapp/components/ui/        # shadcn generated components
webapp/lib/mock-data.ts      # Mock event model
webapp/components.json       # shadcn configuration
```

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

Mock organizer login.

Current intent:

- Show how an organizer might enter the console.
- Communicate that auth is mocked.
- Route into `/app`.

Current status:

- Implemented with shadcn components.
- Not final or design-approved.
- Can be redesigned freely if improving product feel.

### `/app`

Mock event operations dashboard.

Current intent:

- Show the organizer-facing event console for one configured event.
- Mock checkpoint health, player progress, sponsor traffic, rewards, activity, and prize desk operations.

Current status:

- Implemented, but the user rejected the current design direction.
- Do not treat the current `/app` UI as approved.
- Use it as a data/content reference only.

## Current Mock Event

Source: `webapp/lib/mock-data.ts`.

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

## Known Problems To Fix Next

### 1. Product UI Direction

The current `/app` mock was rejected by the user. Likely issues:

- It is visually heavy.
- It borrows too much from the landing page.
- It does not yet feel like a trustworthy operations tool.
- It prioritizes looking dramatic over making the event workflow clear.

Recommended next direction:

- Redesign `/app` as a quiet event operations console.
- Use a restrained sans typography system.
- Reserve purple for primary action, selected nav, progress, and status accents.
- Keep data hierarchy compact and scannable.
- Make the first viewport answer:
  - Is the event ready?
  - Which checkpoint needs action?
  - How many players are moving?
  - Are sponsor visits happening?
  - Are rewards/badge mints flowing?

### 2. Product Surface Decomposition

The real app should probably split into focused surfaces:

- Organizer dashboard.
- Route/checkpoint builder.
- Booth staff checkpoint screen.
- Prize desk verification screen.
- Attendee mobile web experience.
- Sponsor report view.

Do not try to design all of these in one giant dashboard without a plan.

### 3. Data Model

Current mock data is plain arrays. A future real model will need entities such as:

- Event
- Route
- Checkpoint
- Sponsor
- Player
- Scan
- Clue
- Completion
- Badge mint
- Reward tier
- Redemption claim
- Staff assignment

## Suggested Next Implementation Plan

If asked to continue product work, a good sequence is:

1. Redesign `/app` first as an organizer overview.
2. Keep `/login` simple and task-focused.
3. Add an attendee mobile route only after organizer overview feels right.
4. Add a prize desk route.
5. Add route builder/checkpoint setup.
6. Only then think about real auth/backend/on-chain integration.

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
