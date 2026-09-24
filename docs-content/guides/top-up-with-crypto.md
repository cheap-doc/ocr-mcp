---
title: Top up with crypto
description: Send USDT to the permanent deposit address of your account and watch the credits arrive, including what to do if they do not.
type: how-to
keyword: top up api credits with usdt
nav: Top up with crypto
section: Guides
---

# Top up with crypto

Credits are bought with cryptocurrency. This guide covers taking a quote,
sending the transfer, and reading what happened when the amount does not match
the quote.

One credit is one US cent and buys the recognition of one document. A top-up
converts an amount of coin into a whole number of credits.

## Take a quote

Open <https://doc.cheap/app/top-ups> and choose an asset and a number of
credits.

| Asset | Sent on |
|---|---|
| `btc` | Bitcoin |
| `eth` | Ethereum |
| `trx` | Tron |
| `usdt_erc20` | USDT on Ethereum |
| `usdt_trc20` | USDT on Tron |

The two USDT entries are different assets, not one asset on two chains. A
transfer of one is not a transfer of the other, so pick the chain you will
actually send from.

The quote answers with three things. The amount of coin to send, the deposit
address to send it to, and the price it was computed at. The minimum quote is
$1, because below that the chain fee is most of the deposit.

## Send the transfer

Send the quoted amount to the quoted address, from a wallet you control.

The address is **permanent and belongs to your account**. It does not change
between top-ups, so a wallet that has it saved can keep using it. Sending to it
without a quote still works; the deposit is credited at the price when it is
credited.

Send the asset the quote named, on the chain the quote named. USDT sent on
Tron to an Ethereum address is not a deposit we can see.

> **Warning.** Do not send from an exchange account that deducts its withdrawal
> fee from the amount. What arrives is what is credited, and a fee taken out of
> the transfer makes the arrival smaller than the quote.

## Watch it arrive

The top-up page follows the deposit through three states.

1. **Quoted.** The amount and the address are fixed and the price is locked.
   The quote stays live for 2 hours.
2. **Seen.** The transfer has been found on the chain and is waiting to be
   buried under enough confirmations. A larger deposit waits for a deeper
   burial than a small one.
3. **Credited.** The credits are on the balance, and the operations log carries
   the entry.

A deposit is never credited before it is deep enough. That wait is the price of
making a reversal cost more than the credit it would claw back.

## Know what the locked price covers

The quote locks a price, and the lock has bounds in both time and amount.

| Bound | Rule |
|---|---|
| Time | The lock holds for the 2 hour quote window plus a **6 hour grace** past it |
| Amount | The lock funds the quoted amount plus **2 %**, counted across every transfer the quote ever attracts |
| Order | A transfer whose block is dated before the quote gets no lock at all |

Inside all three, the coin converts at the price you were shown. Outside any of
them, what falls outside converts at the **corroborated current price**. The
deposit is then flagged as an anomaly for an operator to look at.

The 2 % tolerance exists for the wallet that rounds the amount up, or takes its
network fee out of it. It is not a window to send more coin through at an old
price.

The grace exists because a payment sent inside the window still has to confirm.
Six hours is longer than any of these chains needs, and short enough that
holding a quote open is not worth anything.

A late payment is still credited. What it loses is the old price, not the
money.

## Read what a mismatch does

Three outcomes account for every amount that is not the quoted one.

- **Less than quoted.** The deposit is credited for exactly what arrived,
  converted at the locked price. Send the difference to the same address to
  make it up.
- **Up to 2 % more.** The whole amount converts at the locked price.
- **More than that.** The quoted portion converts at the locked price and the
  excess at the current one, in the same ledger entry and the same commit.

The conversion always rounds **down** to a whole credit. A fraction of a cent
is not credited, and a transfer worth less than one credit is too small to
credit at all.

## Understand when there is no price

A price is used only when independent sources corroborate it.

Three or more sources are reduced to their median. When exactly two answered,
the pair is used only if the two agree within 2 %. Two readings always sit the
same distance from their own midpoint, so no tolerance can separate them. With
no agreement, no price is used.

A quote that cannot be priced answers
[`rate_unavailable`](/errors/rate_unavailable). Retry shortly. A deposit that
arrives while no price is available waits for the next pass rather than being
credited at a number nobody corroborated.

USDT is priced like every other asset rather than assumed to be one dollar. A
reading outside 0.95 to 1.05 is refused rather than clamped into the band.

## If credits do not arrive

Work through this in order.

1. **Check the chain.** Find the transaction in a block explorer and confirm it
   reached the address the quote gave you, on the chain the quote named.
2. **Wait for the depth.** A confirmed transfer is not yet a buried one.
   Bitcoin takes the longest.
3. **Check the amount.** A transfer worth less than one credit after conversion
   is not credited.
4. **Give it a day.** Past the live window, the addresses are re-read by a
   daily pass for 30 days.
5. **Ask for help.** Past those 30 days the automation stops, but the address
   stays valid and the funds are not lost. Send us the transaction hash.

A second quote while one is still open answers
[`topup_in_progress`](/errors/topup_in_progress). Finish or abandon the first
one.

## Remember the balance cannot go negative

A scan is refused with 402
[`insufficient_credits`](/errors/insufficient_credits) before the engine is
called, rather than running the scan and leaving a debt.

The floor is not a check in the application. A database constraint refuses the
entry that would take a balance below zero, so there is no code path that
overdraws an account.

## Next

- [Crypto deposits](/concepts/crypto-deposits) – the reasoning behind the
  locks, the depths and the price rules.
- [Track usage and spend](/guides/track-usage-and-spend) – reading the balance
  the credits landed on.
- [What a billed scan is](/concepts/what-a-billed-scan-is) – what a credit buys.
