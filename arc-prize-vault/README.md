# Proof of Prize

**Hackathon prize pools escrowed in USDC on Arc. You can check the prize money is real before you build.**

Hackathon listings often look better than they pay. A "$100k pool" can turn out to be mostly credits, one winner can take everything, or the money only shows up after judging. Proof of Prize makes organizers lock every prize slot in USDC before anyone builds:

1. **Lock.** The organizer calls `createPool` with fixed slot amounts (for example `1000, 500, 250, 250`) and an award deadline. The full total is transferred into the contract in that same transaction.
2. **Award.** The organizer pays each slot to one winner, once. The USDC goes straight from escrow to the winner, and it is recorded onchain.
3. **Refund.** Only after the deadline can the organizer reclaim the slots they never awarded. Anyone can see that a refund happened.

Builders can see how much is locked, how many slots there are, what has been paid and who was paid. They don't have to rely on the announcement post.

## Why Arc

USDC is Arc's native gas token, so organizers and winners only need one asset: no ETH for gas, no bridging. Arc's sub-second finality means a prize payout settles straight away.

## Layout

| Path | What |
| --- | --- |
| `contracts/PrizeVault.sol` | The escrow contract (~125 lines, no dependencies) |
| `test/PrizeVault.test.js` | Hardhat tests: escrow, awards, guards, refunds, pool isolation |
| `web/` | Static dapp (no build server; viem is bundled in `web/vendor/viem.js`) |
| `scripts/deploy.js` | Deploys to Arc and writes the address into `web/config.js` |
| `scripts/seed-local.js` | Local demo chain with sample pools |

## Network

| | |
| --- | --- |
| Chain | Arc mainnet, chain ID `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| USDC (ERC-20 interface, 6 decimals) | `0x3600000000000000000000000000000000000000` |
| Explorer | `https://explorer.arc.io` |

The contract uses USDC's 6-decimal ERC-20 interface for all accounting, as Arc's docs recommend. It does not use the 18-decimal native balance.

## Run it

```bash
npm install
npm test

# local demo
npx hardhat node
npx hardhat run scripts/seed-local.js --network localhost   # prints a ?rpc=... query string
cd web && python3 -m http.server 8080                         # open http://localhost:8080/<query string>
```

## Deploy to Arc mainnet

**From your wallet (no private key needed):** open the hosted app while `web/config.js` has no vault address, connect MetaMask or Rabby on Arc, and click **Deploy vault**. Then copy the new address into `web/config.js`.

**From the command line:**

```bash
PRIVATE_KEY=0x... npm run deploy          # needs a little USDC on Arc for gas
```

After changing the contract, run `npm run build:web` to regenerate `web/vault-bytecode.js`.

Then host `web/` on any static host (GitHub Pages, Vercel, Netlify).

## Contract notes

- Up to 100 slots per pool. The deadline must be in the future and at most 365 days away.
- The organizer can't award a slot to their own address. That's only a basic signal, not sybil resistance.
- Each slot is paid once. After the deadline, `award` reverts and `refundUnawarded` can run once.
- State changes are written before any token transfer happens, and every USDC transfer's return value is checked.
- Not audited. Keep pools small until it is.

MIT licensed.
