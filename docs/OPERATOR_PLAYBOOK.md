# TreasureLoop Operator Playbook

The event organizer's manual for running a live TreasureLoop hunt from
the console at `/app`. Read this before your first event, and keep it
open on event day.

---

## What TreasureLoop is

TreasureLoop turns a conference venue into a playable map: attendees
move between staffed sponsor checkpoints, prove they were physically
there by entering a rotating code, and mint an on-chain "finisher"
badge when they complete the loop. The badge is the gate for physical
prizes, which are handed out at a staffed prize desk. You run the whole
thing from the operator console at `/app`; attendees play on their
phones with no app install.

---

## Roles

Roles are set when you invite someone on the **Team** page. A person's
role decides what they can see and do in the console.

| Role | What they can do |
|---|---|
| **Organizer** | Full access. Configure the event, build routes and checkpoints, add sponsors, set rewards, invite the whole team, run Preflight, and use every other surface (prize desk, booth, sponsor reports). |
| **Prize desk** | Use the Prize Desk page: verify a wallet's badge and hand out / redeem rewards. |
| **Booth staff** | Use the Booth kiosk for the checkpoint(s) they're assigned to: show the rotating code, and rotate the checkpoint secret if needed. |
| **Sponsor** | Read-only access to their own booth's traffic report on the Sponsors page. |

Notes:
- Only **organizers** can reach Route builder, Team, and Preflight.
- Booth staff only see the checkpoints they are assigned to; an
  organizer sees every checkpoint in the booth list.
- The prize desk and sponsor reports are available to organizers too.

---

## Pre-event setup walkthrough

Do this with a laptop, in order. Everything below happens in the
console at `/app`.

### 1. Create the event

The event is **auto-provisioned from your Clerk organization** — you do
not fill in a "create event" form. When your organization is created in
Clerk, a webhook creates the matching event row; the `/app` layout also
re-runs the same provisioning defensively, so signing in is enough to
get an event. If you land on the overview and see "No active event,"
re-authenticate to trigger provisioning.

Once the event exists, confirm its name and venue on the overview. (The
event settings form is planned; today the name/venue come from the seed
or provisioning.)

### 2. Build a route

A **route** is the ordered loop of checkpoints players walk.

1. Go to **Route builder** (`/app/routes`).
2. If there is no route yet, you'll get a single "Create route" form —
   name it (e.g. "Main Loop 01") and create it.
3. The route starts as a **Draft**. Leave it draft while you build.

### 3. Add checkpoints

1. In Route builder, click **Add checkpoint**, type a name, and add it.
   Repeat for each stop. Aim for at least 3 (Preflight warns below 3).
2. Click a checkpoint to open its detail panel and set:
   - **Area** — where it physically is (e.g. "Sponsor row A").
   - **Clue shown to the player** — the text the attendee reads.
   - **Clue type** — QR scan, Staff code, Paired fragment, or NFC tag.
     (Paired-fragment matchmaking is **planned**; today the type is a
     label, and presence is proven with the rotating code regardless.)
   - **Status** — Healthy / Busy / Needs staff / Offline.
3. Use **Move up / Move down** in the row menu to set player order.
4. Each checkpoint needs a **verification secret** (the seed for its
   rotating code). Use **Rotate secret** in the checkpoint's
   Verification section to generate one if it's missing.

### 4. Assign sponsors

1. Add sponsors on the **Sponsors** area / route builder first (a
   sponsor is an account today — Clerk invitation-on-add is planned).
2. In each checkpoint's detail panel, pick the **Sponsor** from the
   dropdown. Checkpoints without a sponsor still work, but show "—" in
   reports.

### 5. Assign staff

1. Go to **Team** (`/app/team`).
2. **Invite someone**: enter their email, pick a role (Booth staff for
   checkpoint operators, Prize desk for the reward table, Sponsor for
   read-only reports). They get an email with a join link.
3. Back in **Route builder**, each checkpoint's **Staff** section shows
   who is assigned (Primary vs Backup). Use **Invite staff** there if a
   checkpoint has none. Every checkpoint should have at least one staff
   member.

### 6. Set rewards

Rewards are what the prize desk hands out. Define at least one reward
tier with a name and stock count (or unlimited). They appear on the
Prize Desk page and in the reward-stock table.

### 7. Publish the route

When the loop is complete, flip the route's **Draft → Published** toggle
in the Route builder header. Players have nothing to play until a route
is published.

### 8. Run Preflight until green

Go to **Preflight** (`/app/preflight`). It re-runs fresh on every load.
It checks:

- **Event row exists** (fail if missing — re-authenticate).
- **Event has a name and venue** (warn if venue missing).
- **At least one route is published** (fail if none).
- **Has at least 3 checkpoints** (warn at 1–2, fail at 0).
- **Every checkpoint has a verification secret** (fail if any missing —
  Rotate to generate).
- **Every checkpoint has a sponsor assigned** (warn — unassigned still
  works, shows "—" in reports).
- **Every checkpoint has at least one staff member** (warn — use Team →
  Invite).
- **At least one sponsor configured** (warn).
- **At least one reward defined** (fail — otherwise finishers get
  nothing).
- **Badge contract address configured** (warn if
  `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` is unset; mints won't work).
- **Mint permit signer key configured** (warn if
  `BADGE_SIGNER_PRIVATE_KEY` is unset; the mint API returns 503).
- **Play session cookie encryption key** (production only; fail if
  `PLAY_SESSION_SECRET` is unset).

"Ready to run" means **no blocking failures**. Warnings are fine to
open with, but read each one — an unassigned sponsor or an unset
contract changes how the event behaves. Each failing/warning check has
a **Fix →** link that takes you to the page that resolves it.

---

## Day-of checklist

- [ ] **Run Preflight** one more time. It should say "Ready to run." Clear
      any blocking failures.
- [ ] **Open a booth kiosk at every checkpoint.** On each booth tablet,
      sign in as that checkpoint's booth staff, go to **Booth kiosk**
      (`/app/booth`), tap the checkpoint, and leave the rotating-code
      screen visible to attendees. (See the booth-staff one-pager.)
- [ ] **Verify the rotating codes are live.** Each kiosk shows a 6-digit
      code with a countdown bar that rotates every 30 seconds. Confirm
      it's counting down and changing.
- [ ] **Open the Prize Desk** (`/app/prize-desk`) on the prize-desk
      device and run one test verification.
- [ ] **Watch the Overview** (`/app`). The header chip shows Preflight
      status. The page shows live players, route completion, sponsor
      visits, and badge mints, plus **Needs attention** (any checkpoint
      not "healthy"), checkpoint health, sponsor traffic, and a live
      activity feed from the audit log. Glance at it through the day.

---

## Common failure modes

### An NFC tag fails (won't scan)

The rotating code is the fallback for every checkpoint. Have the
attendee read the **6-digit code off the booth kiosk** and enter it
manually as the staff code — the server accepts it the same way. No NFC
tag is required to prove presence.

### A sponsor's booth staff didn't show

- Reassign: in **Route builder**, open that checkpoint and check its
  **Staff** section. Use **Invite staff** (Team) to add whoever is
  covering, or have an organizer open the kiosk directly — organizers
  can open any checkpoint's booth.
- If no one can cover, set the checkpoint **Status → Offline** (see
  below) so it stops being a required stop, and note it in Preflight /
  Overview "Needs attention."

### Mint contract paused or unconfigured (mint returns 503)

If `NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS` or `BADGE_SIGNER_PRIVATE_KEY`
is unset, the mint-permit API returns **503** and players can't mint a
badge. Preflight flags both as warnings.

- This does **not** stop gameplay — players can still scan and complete.
- The **prize desk falls back to the database**: when the contract
  isn't configured, the verifier trusts the player's DB completion
  record so you can still hand out prizes (the verdict panel says
  "Contract not configured; DB only").
- To fix for real: set the contract address and signer key in the
  environment, then re-run Preflight.

### A checkpoint needs to go offline

Open the checkpoint in **Route builder**, set **Status → Offline**, and
Save. It will surface in Overview "Needs attention" and read as offline
in reports. (Note: a player-facing scan block tied to the offline
status is **planned**; today "offline" is primarily an operator signal,
so also close or pause the booth kiosk at that station.) Set it back to
**Healthy** when it's running again.

---

## Glossary

- **Attendee / player** — person at the event playing the hunt.
- **Organizer** — runs the event, configures everything.
- **Booth staff** — operates one checkpoint.
- **Prize desk staff** — verifies badges, hands out rewards.
- **Sponsor** — pays to host a checkpoint, sees their own report.
- **Loop / route** — the ordered set of checkpoints a player traverses.
- **Checkpoint / stop** — one staffed location on the route.
- **Fragment / pair fragment** — half of a clue, given to one player at
  a "pair" checkpoint; combining two fragments solves it. *(Planned.)*
- **Badge** — ERC-721 token minted at completion; gates the prize desk.
- **Permit** — server-issued EIP-712 signed message authorizing one
  badge mint.
- **Redemption** — handing a physical reward to a verified badge holder.
</content>
</invoke>
