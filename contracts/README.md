# TreasureLoop contracts

`TreasureLoopBadge.sol` — the ERC-721 finisher badge minted at the end
of a successful TreasureLoop event. One contract instance per event.

## Mint flow

```
┌────────┐  finishes the loop  ┌──────────────┐
│ player │ ──────────────────▶│ server (API)│
└────────┘                     └─────┬────────┘
   ▲                                 │
   │ tx                              │ EIP-712 sign MintPermit
   │                                 ▼
   │                          ┌──────────────┐
   └──────── permit + sig ────│ server signer│
                              └──────────────┘
                                     ▲
                                     │ (trusted signer key)
                                     │
                              ┌──────────────┐
                              │  contract    │  recovers signer from
                              │              │  digest, checks nonce
                              └──────────────┘  + deadline, mints
```

- The server holds a single signing key whose address is set as
  `signer` on the deployed contract.
- When a player finishes the loop, the server issues an EIP-712 signed
  `MintPermit` for that specific player address, with a unique
  `bytes32 nonce` and a `deadline` so permits can't sit forever.
- The player calls `mint(permit, signature)` from their own wallet,
  pays gas, and receives token #N. The contract enforces:
  - `msg.sender == permit.player` (no relayer hijack)
  - `block.chainid == permit.chainId`
  - `block.timestamp <= permit.deadline`
  - `!hasMinted[player]` and `!usedNonces[nonce]`
  - `ECDSA.recover(digest, signature) == signer`

## Why these invariants matter

| Invariant | Attack it stops |
|---|---|
| `msg.sender == player` | Relayer mints on the player's behalf to a different recipient |
| `chainId` in the typed data | Replay across an L2 fork or testnet/mainnet pair |
| `deadline` | Permit issued during the event used months later |
| `usedNonces` | Replay the same legitimate permit twice |
| `hasMinted` | Two distinct permits for the same player both mint |

## Deployment

The project uses Foundry. Install via https://book.getfoundry.sh.

```bash
forge install OpenZeppelin/openzeppelin-contracts@v5.1.0
forge build
forge test
```

Deploy to Base Sepolia:

```bash
forge create src/TreasureLoopBadge.sol:TreasureLoopBadge \
  --rpc-url $BASE_SEPOLIA_RPC \
  --private-key $DEPLOYER_KEY \
  --constructor-args $OWNER_ADDR $SIGNER_ADDR "https://treasure.loop/api/badge-metadata/"
```

The `SIGNER_ADDR` MUST be the address derived from the private key
configured as `BADGE_SIGNER_PRIVATE_KEY` in the webapp env. The webapp
signs `MintPermit` payloads with that key and the contract recovers
that same address from the signature.

After deploy, set in webapp `.env.local`:

```
NEXT_PUBLIC_BADGE_CONTRACT_ADDRESS=0x…
BADGE_SIGNER_PRIVATE_KEY=0x…
```
