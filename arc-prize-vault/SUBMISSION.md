# Arc Microgrants submission: Proof of Prize

Copy-paste text for the DoraHacks BUIDL form, plus a 2-minute demo script.
Fill the `<…>` placeholders after deploying.

---

## BUIDL name
Proof of Prize

## Tagline (one line)
Hackathon prize pools escrowed in USDC on Arc, so builders can check the money is real before they build.

## Links
- Live app: `<hosted URL>`
- Repo: https://github.com/Eminentpluz/xeminentx/tree/main/arc-prize-vault
- Vault contract on Arc mainnet: `<explorer.arc.io/address/0x…>`
- First live pool (create tx): `<explorer.arc.io/tx/0x…>`

## Description

**The problem.** Hackathon prize pools are often weaker than they look. A "$100k prize pool" turns out to be mostly SaaS credits, one team takes most of it, part of the headline is "follow-on grants" rather than prizes, or payouts arrive months late, if they arrive at all. Builders spend weekends on these events with no way to check what they will actually be paid.

**The fix.** Proof of Prize is a USDC escrow on Arc for hackathon prizes:

1. **Lock.** The organizer locks every prize slot in USDC before the event (for example 1000 / 500 / 250 / 250). The full total moves into the contract in the same transaction, and the pool does not exist until it is funded.
2. **Award.** The organizer pays each slot to one winner, once, straight from escrow. Every payout has an onchain receipt.
3. **Refund.** Only after the award deadline can the organizer take back slots they never awarded, and anyone can see that this happened.

Anyone can open the app and see how much money is really locked, how many winners it pays, what has been paid and to whom, without trusting the announcement post.

**Why Arc.** USDC is Arc's native gas token, so organizers and winners only ever need one asset: no ETH for gas, no bridging, no explaining wrapped tokens to a first-time hackathon winner. Sub-second finality means prize payouts settle immediately. The contract uses Arc's USDC ERC-20 interface (`0x3600…0000`, 6 decimals) as Arc's docs recommend.

**What's built (working on mainnet).**
- `PrizeVault.sol`: about 125 lines with no dependencies. Up to 100 slots per pool, each slot paid once, refunds only after the deadline, state written before transfers, every transfer's return value checked.
- Hardhat test suite (escrow, awards, guards, refunds, pool isolation), plus browser end-to-end tests of the full flow.
- A static web app that works on phones. Organizers can deploy the vault, lock pools, pay winners and refund straight from MetaMask or Rabby. No backend and no private keys on a server.

**Next steps with the grant.**
- Pay prizes to several winners in one transaction, plus a CSV import.
- An optional judge co-signature (organizer plus judge must both approve each payout).
- A "Verified prize pool" badge that hackathon listing sites can embed.
- Run my own monthly builder hackathon list through it, starting with a small USDC pool.

**Team.** Eminent (`<@your X handle>`): Web3 growth marketer. I publish a monthly list of hackathons with prize pools checked by hand, and kept running into the problem this app fixes.

---

## Demo video script (about 2 minutes)

**0:00–0:15. Hook.** Screen: a hackathon listing with a big "$100k prize pool" headline.
> "Every hackathon list looks impressive until you open the links. Credits, one team taking most of the prize, grants counted as prizes. Proof of Prize fixes that on Arc."

**0:15–0:35. The app.** Screen: the live app home page.
> "This is Proof of Prize. Organizers lock every prize slot in USDC before anyone builds. These numbers at the top are read live from Arc mainnet: USDC in escrow, paid to winners, number of pools."

**0:35–1:05. Lock a pool.** Connect the wallet, fill in name, URL, slots `10, 5`, and the deadline. Click *Approve & lock USDC* and confirm both wallet prompts.
> "As an organizer I enter my prize slots. The contract pulls the full total into escrow in one transaction. There's no listing without locked money. And because gas on Arc is USDC, this is the only token I need."

**1:05–1:30. Pay a winner.** Paste a winner address into slot #1 and click *Pay*. Then open the transaction on explorer.arc.io.
> "When judging is done I pay slot one. The USDC goes straight from escrow to the winner, with a public receipt. Each slot can only be paid once."

**1:30–1:45. The guarantee.**
> "Anything I don't award stays locked until the deadline, and only then can it come back to me. Builders can see the whole time how much is locked, paid or refunded."

**1:45–2:00. Close.** Screen: repo README.
> "It's open source with about 125 lines of contract code and tests, live on Arc. Next: payouts to several winners in one transaction, judge co-signing, and an embeddable 'verified prize pool' badge for hackathon lists. Thanks!"

---

## Pre-submit checklist
- [ ] Vault deployed on Arc mainnet and the address committed to `web/config.js`
- [ ] App hosted, and the live link opens on a phone
- [ ] At least one real pool locked (even $10–15), with one slot paid to a second wallet
- [ ] Links above filled in
- [ ] Video recorded and uploaded (YouTube unlisted or Loom)
- [ ] Submitted on DoraHacks before **Oct 14**
