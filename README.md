# treasure.loop

treasure hunt protocol for web3 conferences.

treasure.loop turns a conference venue into a playable map. attendees scan a starting code, receive a clue, and route between physical checkpoints staffed at sponsor booths — solving each one to unlock the next. complete the loop to claim an on-chain badge and enter the prize layer.

the protocol is hybrid by design. gameplay runs off-chain for speed and zero gas friction; only completion settles on-chain, as a collectible badge minted to the player's wallet. valuable rewards (merch, hardware wallets) are gated behind the badge and a physical prize desk — a chokepoint that makes the hunt resistant to sybil farming without imposing kyc.
each checkpoint is a staffed sponsor station that reveals a per-interaction code, so progress requires real foot traffic and real conversations. selected clues can require two players to combine fragments, forcing strangers to find each other. the result serves three goals at once: sponsors get qualified booth visits, attendees get a reason to talk to people they wouldn't have met, and the conference gets a shared story.
treasure.loop is event-agnostic. organizers configure the clue graph, checkpoint locations, and reward tiers; the protocol handles scan verification, progress tracking, badge minting, and redemption. built by intheloop.
