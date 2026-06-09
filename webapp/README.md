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
  app/                          operator console
    layout.tsx                  requireMember + AppShell
    page.tsx                    overview (any member)
    routes/                     route builder (organizer only)
    prize-desk/                 verification (prize_desk, organizer)
    sponsors/                   sponsor report (sponsor, organizer)
    _components/                AppShell, CommandPalette
proxy.ts                        Clerk middleware + authz at the edge
lib/authz.ts                    policy module
lib/auth-server.ts              server helpers (getSubject, requireRoles)
tests/                          Vitest unit + config tests
```
