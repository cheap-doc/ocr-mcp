---
title: Crypto deposits
description: How a permanent deposit address is derived for an account, how a transfer becomes credits, and what the chain watcher does and does not promise.
type: explanation
keyword: crypto deposit address credits
nav: Crypto deposits
section: Concepts
---

# Crypto deposits

Credits are bought with cryptocurrency, and crediting money read off a public
chain has no undo. A credit posted from a wrong price is money given away; a
payment silently not credited is money a customer lost. Every rule below
exists because one of those two failures is worth preventing.

The standard the design is held to is that a money error is unacceptable. The
price paid for it is latency: a deposit sometimes waits longer than it
strictly had to.

## The address is permanent, and nothing here can spend from it

Each account has one deposit address per chain, and it does not change between
top-ups. A wallet with it saved can keep sending to it, and a payment that
arrives with no quote behind it is still credited.

The address is derived rather than assigned. A hierarchical deterministic
wallet produces a whole tree of addresses from one key, and this service holds
only the **public** half of that key.

That is the property worth stating carefully. Deriving a customer's address
from a public key needs no private key, because the derivation steps involved
are the unhardened ones. The process that watches the chain and credits
balances therefore has no way to move any of the money it is watching. A
compromise of this service does not reach the funds; it reaches a list of
addresses that are already public on a chain.

The spending key lives outside the service entirely, and nothing in the
request path has ever seen it.

## A quote is a price, not a reservation

A top-up starts with a quote. It names an asset, a number of credits, and the
amount of coin that buys them at the price it was computed at.

The price is **locked**, and the lock has three bounds. Each one closes a
different way of getting value out of the product for free, and none of them
is about the honest payer.

**Time.** The lock holds for the quote's 2 hour live window plus a 6 hour
grace past it. Without a bound, a payer waits and pays only if the asset has
fallen, funding the same credits with less money. A quote whose asset rose is
never paid at all. Six hours is far longer than any of these chains needs to
confirm a payment. It is far too short to be worth holding an option over.

**Amount.** The lock funds the quoted amount plus 2 %, counted across every
transfer that quote ever attracts. The tolerance exists for the wallet that
takes its network fee out of the amount. It exists for the payer who rounds
the figure up while typing it. An unbounded tolerance would be a free option
on the market. Send one quote's worth while the price holds, and a hundred
times that once it has fallen.

**Order.** A transfer whose block is dated before the quote gets no lock at
all. The other direction is a look-back option. Pay first, watch the market,
then mint a quote at the old price once it has moved your way. A small
per-chain tolerance is allowed against it. A block's timestamp is the block
producer's opinion and a quote's is a database's, and the two clocks were
never synchronized.

What falls outside any of the three is still credited, at the corroborated
current price. The deposit is flagged for a person to look at. A late payment
loses the old price and not the money.

## A price needs corroboration

A price is never one source's opinion.

With three or more answers, the median decides and the outliers are discarded.
With exactly two, the median is meaningless. Both sit the same distance from
their own midpoint, so any tolerance keeps both or neither. The pair is used
only if the two agree within 2 %. With no agreement there is no price, and a
quote that cannot be priced is refused rather than guessed.

A deposit that arrives while no price is available waits for the next pass.
Half of it is never credited against a row already marked paid.

Stablecoins are priced like everything else rather than assumed to be worth a
dollar. A stablecoin is a claim, not an identity, and the one moment its price
is worth reading is the moment it is not holding. A reading outside a narrow
band around a dollar is refused rather than clamped to the edge of the band.
Pricing a depegged token at the floor would pay the difference on every top-up
for as long as the depeg ran.

## Depth is proportional to what is at stake

A transfer is not credited the moment it appears on a chain. It has to be
buried under enough later blocks that undoing it would cost more than the
credit it would claw back.

Each chain has two depths, and the deeper one is required once the account's
recent shallow exposure on that chain passes a threshold. A small deposit is
credited quickly; a large one waits.

That is a deliberate trade of latency for safety, sized by value rather than
applied flatly. A flat depth is either too slow for the ordinary payment or
too shallow for the large one.

Settlements for one account are serialised. Without that, two transfers of one
account settle in parallel, each reading the exposure before the other has
written its credit. A payment split in two then walks past the depth it should
have had to reach.

## Arriving amounts, and what happens to each

Three cases cover every amount that is not exactly the quoted one.

Less than quoted is credited for what arrived, at the locked price. The
difference sent later to the same address is credited the same way.

Up to the tolerance more converts wholly at the locked price.

More than that splits. The quoted portion converts at the locked price and the
excess at the current one, in the same ledger entry and the same commit. One
deposit is one movement, whatever it was funded by.

Every conversion rounds **down** to a whole credit. A fraction of a cent is
not credited. A transfer worth less than one credit after conversion is too
small to credit at all. The arithmetic produces nothing, and a credit of zero
would be a row saying money arrived and nothing happened.

A single transfer worth more than the ledger can hold is recorded as refused
with a flag rather than thrown away. A throw would roll back the row that says
money arrived, which is the one record that must survive whatever else does
not.

## What the watcher does not promise

Two limits are worth knowing because no amount of care removes them.

**Value moved by a contract call is invisible to these scans.**

A native-coin transfer made by a contract during a call does not appear the
way an ordinary transfer does. Crediting it is a manual step, and tokens are
not affected.

**An endpoint that lies consistently is eventually believed.**

The watcher refuses a chain reading that outruns wall-clock time or falls too
far behind what it last saw. It re-anchors when a run of consistent readings
agrees. That bounds a mistaken or transient answer. It is deliberately not a
defense against a sustained hostile one. A check that can never change its
mind wedges the watch on a chain whose anchor is wrong.

## Where a deposit goes when automation stops

A quote's live window is 2 hours, and the addresses keep being re-read by a
daily pass for 30 days after it.

Past those 30 days the automation stops, and that is all that stops. The
address stays valid, the funds are not lost, and a deposit that arrives
afterwards is a support conversation rather than a loss. Knowing that boundary
is the point of publishing it.
