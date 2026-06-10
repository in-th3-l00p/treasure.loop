# Prize Desk — One Pager

Print this and keep it at the prize desk.

Your job: check a wallet, read the verdict, and hand out the reward the
player earned. Open **Prize desk** (`/app/prize-desk`).

---

## How to verify

1. **Scan or enter the wallet.** Paste the wallet address (`0x…`) from a
   QR scan into the box and press **Verify**.
2. Read the big **verdict panel** that appears. It's color-coded so you
   can read it from arm's length with a queue watching.

---

## What each status means

| Status | Color | Meaning | What you do |
|---|---|---|---|
| **Eligible** | Green | The wallet holds a finisher badge (or the contract isn't configured and the database confirms they finished). | Hand out the reward and redeem it below. |
| **No badge on chain** | Amber | The wallet **played** but doesn't hold a finisher badge yet. | Ask them to mint at `/play/claim` first, then re-verify. Do **not** hand out the reward. |
| **Hasn't played** | Red | No player record for this wallet at this event. | This wallet isn't in the game. Do **not** hand out anything. |

There's also a malformed-input message: **"That doesn't look like a
wallet address"** — re-scan or re-type; you didn't enter a valid `0x…`
address.

The verdict panel's small print tells you how it was checked:
- **"Checked on chain"** — verified against the live badge contract.
- **"Contract not configured; DB only"** — no contract is set, so the
  desk trusts the database completion record. This is expected in
  rehearsal/dev; if you see it at a real event, tell your organizer.

---

## Redeeming a reward (and the stock guard)

When the verdict is **Eligible**, the reward tiers appear below.

1. Pick the tier the player earned and press **Hand out & redeem**
   (or **Redeem**).
2. The reward's stock **decrements by exactly one**, atomically. Two
   prize-desk people redeeming the **last unit** of the same reward at
   the same time will **not** both succeed — one gets it, the other
   sees "depleted."
3. A reward can show:
   - **"X of Y claimed"** — how many are gone vs total stock.
   - **"Unlimited"** — no cap.
   - **"Out of stock"** — depleted; the button is disabled.
   - **"Already claimed by this wallet"** — this wallet already took
     this reward; the button is disabled. A wallet can't claim the same
     reward twice.

Only redeem **after** the verdict is Eligible. The Redeem buttons are
disabled for any other verdict. Every redemption is logged.

---

## When a player insists they earned a tier they didn't

Stay calm and let the screen be the authority — you don't have to argue.

- **Verdict is "No badge on chain":** they finished but haven't minted.
  Send them to `/play/claim` to mint, then re-verify. Once the badge
  exists, they flip to Eligible.
- **Verdict is "Hasn't played":** this wallet has no record at this
  event. They may be on a **different wallet** than the one they played
  with — ask them to connect the wallet they actually used and scan
  that one.
- **Reward says "Already claimed":** they (this wallet) already took
  this reward. The system blocks a second claim by design.
- **Reward says "Out of stock":** that tier is gone. Offer another tier
  they're eligible for, or refer them to the organizer.
- **They still dispute it:** escalate to the organizer. Do not override
  the verdict or hand out a reward the screen blocks — the on-chain
  badge / database record is the source of truth.
</content>
