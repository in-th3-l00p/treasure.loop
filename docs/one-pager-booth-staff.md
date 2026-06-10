# Booth Staff — One Pager

Print this and keep it at your booth.

You run **one checkpoint**. Your job: keep the verification code on
screen so attendees can prove they were here.

---

## Your screen

Open **Booth kiosk** (`/app/booth`), then tap your checkpoint. You land
on `/app/booth/[checkpointId]`. The screen shows:

- A big **6-digit code**, split as 3 · 3 for readability from a step
  away (e.g. `482 · 917`).
- A **countdown bar** under it. The code **rotates every 30 seconds**;
  the bar shows how long the current code is good for ("Rotates in Ns").
- The clue the attendee sees, if one is set.

Keep this screen visible to attendees the whole event. The code is
computed live on the tablet — you don't need to refresh it.

**To use it:** read the current 6 digits to the attendee (or let them
read the screen). They type it into their phone. Codes stay valid
across about ±30 seconds of clock drift, so a code that just changed
still works for a moment.

---

## If an attendee can't scan or can't enter the code

1. **NFC tag won't scan?** Ignore the tag. Just read them the **6-digit
   code on your screen** — it works the same way.
2. **They typed it and it failed?** The code probably rotated. Read them
   the **current** code and have them try again right away.
3. **Their phone won't load the play page at all?** That's a network/
   their-device issue, not the code. Ask them to reconnect to wifi and
   reload; flag an organizer if several people hit it.

The 6-digit code is always the fallback. As long as your screen is
showing a live, counting-down code, attendees can complete your stop.

---

## Rotating the checkpoint secret

There's a **Rotate secret** button on the kiosk screen.

- **What it does:** generates a brand-new secret. **All previous codes
  become invalid immediately.** You'll be asked to confirm.
- **When to use it:** only if a code may have leaked (e.g. someone
  posted a screenshot, or codes are being shared by people who aren't at
  your booth). Normal rotation every 30 seconds already prevents replay,
  so you rarely need this.
- **After rotating:** the screen reloads with the new code. Keep
  showing it as usual.

Don't rotate just because it's quiet — it doesn't help and only risks
confusing an attendee mid-entry.

---

## If something's wrong

- Code screen is blank or says **"no TOTP secret configured"** → tell
  your organizer. They fix it in Route builder → your checkpoint →
  Rotate code.
- You need to step away / close the booth → tell your organizer so they
  can set the checkpoint to **Offline** or arrange cover.
- **Who to call:** your event organizer. They're watching the Overview
  and can reassign staff, take a checkpoint offline, or troubleshoot.
</content>
