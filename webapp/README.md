# TreasureLoop webapp

Operator console for TreasureLoop events. Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Clerk.

## Local setup

```bash
cd webapp
npm install
npm run dev
```

Open http://localhost:3000.

### Authentication

The app uses [Clerk](https://clerk.com) for operator authentication and
organization management. Each event maps to a Clerk **Organization**;
members get one of four roles.

#### Keyless dev mode (zero-config)

On first `npm run dev` Clerk boots in **keyless mode**: it spins up an
ephemeral dev instance, writes the keys to `.clerk/.tmp/keyless.json`,
and the app works immediately. No Clerk account required to play with
the auth flow locally.

Copy those keys to `.env.local` so server-side `auth()` calls pick them
up (Clerk does not auto-load them into env):

```bash
node -e "const d = require('./.clerk/.tmp/keyless.json'); console.log('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=' + d.publishableKey + '\nCLERK_SECRET_KEY=' + d.secretKey)" > .env.local
echo 'NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login' >> .env.local
echo 'NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up' >> .env.local
echo 'NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL=/app' >> .env.local
echo 'NEXT_PUBLIC_CLERK_SIGN_UP_FORCE_REDIRECT_URL=/app' >> .env.local
```

#### Production: claim your Clerk instance

1. Visit the **claim URL** printed in the dev server log (one-click to
   move the keyless instance into your Clerk account), or create a
   fresh instance at https://dashboard.clerk.com.
2. In the Clerk dashboard, enable **Organizations** under *Configure →
   Organization settings*. TreasureLoop scopes everything per event so
   org support is required.
3. Add four roles to the org: `organizer`, `prize_desk`, `booth_staff`,
   `sponsor`. The keys must match what `lib/authz.ts` declares.
4. Copy the publishable + secret key from *API keys* into your
   environment (`.env.local` locally, the Vercel project env in prod).

### Roles & policy

The single source of truth for authorization is `lib/authz.ts`. It
exports `can*` predicates and an `APP_ROUTES` declaration:

```ts
canViewOverview        // any member
canConfigureEvent      // organizer only
canIssueScan           // organizer, booth_staff
canVerifyRedemption    // organizer, prize_desk
canViewPlayers         // organizer only (PII)
canViewSponsorReports  // organizer, sponsor
canInviteStaff         // organizer only
```

- **Proxy** (`proxy.ts`) enforces the policy at the edge — anonymous
  users get sent to `/login`, members with the wrong role get
  `/forbidden`, signed-in users with no org get `/no-organization`.
- **Pages** (`requireRoles`, `requireMember` in `lib/auth-server.ts`)
  re-check inside server components as defense in depth.
- **AppShell** hides nav items the active role can't reach, computed
  from `APP_ROUTES` at request time.

Add a new role-gated route by:

1. Adding the predicate to `lib/authz.ts`.
2. Adding the route to `APP_ROUTES`.
3. Calling `requireRoles([...])` inside the page.
4. Writing a test against the predicate.

## Scripts

| Command | Effect |
| --- | --- |
| `npm run dev` | Start the dev server (port 3000 by default) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest unit tests once |
| `npm run test:watch` | Run Vitest in watch mode |

## Layout

```
app/
  page.tsx                      landing
  login/[[...sign-in]]/         Clerk SignIn (custom shell)
  sign-up/[[...sign-up]]/       Clerk SignUp (custom shell)
  no-organization/              prompt to create or join an org
  forbidden/                    role-denied page
  api/
    webhooks/clerk/             organization.* → events row provisioning
    health/                     uptime probe (public)
    play/                       attendee API (SIWE-protected)
  app/                          operator console
    layout.tsx                  requireMember + AppShell + auto-provision
    page.tsx                    overview (any member)
    routes/                     route builder (organizer only)
    sponsors/                   sponsor report (sponsor, organizer)
    prize-desk/                 verification + redemption (prize_desk, organizer)
    booth/                      booth-staff kiosk (booth_staff, organizer)
    team/                       Clerk invitations + member list
    preflight/                  go/no-go checks
    _components/                AppShell, CommandPalette
  play/                         attendee surface (wallet auth, no Clerk)
proxy.ts                        Clerk middleware + authz at the edge
db/
  schema.ts                     11-table Drizzle schema
  client.ts                     Neon-HTTP / postgres-js dual driver
  migrate.ts + seed.ts          npm run db:migrate / db:seed
  migrations/                   committed SQL
lib/
  authz.ts                      policy module
  auth-server.ts                Clerk → AuthSubject + requireRoles
  event-provisioning.ts         Clerk org → events row
  event-queries.ts              read-only operator queries
  event-actions.ts              Server Actions: CRUD for routes/checkpoints/sponsors/rewards
  staff-actions.ts              invite + assign team
  checkpoint-codes.ts           TOTP helpers (otpauth)
  badge-contract.ts             ABI + addresses
  badge-onchain.ts              viem readContract for prize-desk
  mint-permits.ts               EIP-712 sign on the server
  player-store.ts               attendee progress (Drizzle-backed)
  play-session.ts               iron-session for SIWE
  preflight.ts                  go/no-go check generator
  rate-limit.ts                 in-process sliding-window limiter
tests/                          Vitest — 105 tests across 9 files
```

## Testing posture

| Layer | Tool | How |
|---|---|---|
| Policy / authz | Vitest | pure-function checks per role × per route |
| SIWE | Vitest | real signatures via viem, replays + tampers |
| DB models | Vitest + PGlite | full schema applied in-memory, real SQL exercised |
| Server Actions | Vitest + PGlite | atomic decrement, tenant isolation, rollback |
| Rate limiter | Vitest | window resets, scoping, key extraction |
| Contract | Foundry | 15 tests + 256-run fuzz |
