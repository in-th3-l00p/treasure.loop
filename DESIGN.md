# Design

Visual system captured from `webapp/app/globals.css`, `webapp/app/layout.tsx`, and the shadcn base-nova setup. Two scoped systems share one file: the **landing system** (route `/`, design-approved, do not restyle) and the **product system** (`.product-shell`, used by `/app/**`, `/play/**`, `/login`, `/sign-up`).

## Theme

Dark, single theme (no light mode). Scene: event staff at dim ops tables and attendees on phones in mixed venue lighting; a dark surface with high-contrast text reads well in both. Product background is near-black neutral (`oklch(10% 0.003 286)`) with almost no chroma; the landing background is a purple-tinted dark with radial aurora washes — that atmosphere must not leak into product routes (`.product-shell::before { display: none }`).

## Color

Strategy: **Restrained** on product surfaces. Tinted dark neutrals plus one violet accent used well under 10% of the surface.

| Role | Value | Notes |
|---|---|---|
| Brand accent / primary | `oklch(73% 0.17 296)` | violet; primary buttons, selected nav, progress, rings |
| Background (product) | `oklch(10% 0.003 286)` | near-black, hue-tinted neutral |
| Card (product) | transparent + 1px `--border` | cards are outlines, not slabs |
| Border (product) | `oklch(96% 0.002 286 / 0.06)` | hairline |
| Muted text (product) | `oklch(62% 0.004 286)` | labels, secondary copy |
| Destructive | `oklch(64% 0.18 25)` | |
| Chart / status hues | violet 296, indigo 274, orchid 320, mint 160, amber 82 | `--chart-1..5`; mint = healthy/ok, amber = warn |

Landing tokens are richer (chroma ~0.03 neutrals, aurora gradients); they live in `:root` and are overridden inside `.product-shell`. Never use `#000`/`#fff`; every neutral carries hue 286.

## Typography

| Use | Font | Notes |
|---|---|---|
| Product UI (all of it) | Geist Sans (`--font-body`) | headings forced sans inside `.product-shell`; tight tracking (-0.005em) |
| Landing display | Newsreader (`--font-display`) | serif, weights 520/560, landing-only; never in app chrome |
| Code, IDs, timestamps, metric digits | Geist Mono (`--font-mono`) | uppercase micro-labels with 0.1–0.18em tracking are a house signature |

Product type scale is compact and operational: 11px mono labels, 13–14px body, restrained heading sizes; hierarchy from weight + mono/sans contrast more than raw size. Body copy max measure 62ch (`--measure-copy`).

## Shape & Elevation

- Radius: product `--radius: 0.5rem`; landing `0.75rem` with pill (999px) chrome.
- Product cards: flat, transparent background, 1px hairline border, no shadow, no ring (`[data-slot="card"]` override). Elevation is expressed by border + background step (`--surface`, `--surface-soft`), not shadows.
- Landing uses glows and layered radial gradients; product does not.

## Components

- shadcn/ui, style `base-nova`, Base UI primitives, lucide icons. Installed: button, card, input, label, badge, tabs, separator, progress, avatar, table, dropdown-menu, field, select, switch, textarea, tooltip, dialog, command, input-group.
- Use semantic tokens (`bg-card`, `text-muted-foreground`, `border-border`, `bg-primary`); no one-off decorative overrides.
- Status pattern: `.status-dot` — 6px dot in `currentColor` with a soft 3px halo via `color-mix`; pair with mono uppercase label.
- Clerk widgets are flattened to read as inline forms (extensive `.cl-*` overrides in globals.css); keep them aligned with input/button tokens.

## Motion

- Transitions 150–220ms, ease-out. Landing has slow ambient drift/ping loops; product chrome stays still.
- `prefers-reduced-motion` collapses all animation globally; preserve this block.

## Layout

- Landing: 1180px max width, generous clamp() rhythm.
- Product: dense operational layout; hairline-divided regions over card grids; tables and definition rows preferred to stat-card walls; mono micro-labels as section eyebrows.
- Attendee `/play`: single-column, phone-first, one primary action per screen, min 44px touch targets.
