---
title: What a billed scan is
description: "One cent per document, and the rule that decides whether a call is charged at all: what makes a recognition billable, and what does not."
type: explanation
keyword: what a billed scan is
nav: What a billed scan is
section: Concepts
---

# What a billed scan is

**1¢ per document. Same price for everyone, at any volume – the first document and the ten-millionth cost the same.**

One credit is one US cent, and one credit buys the recognition of one
document. That is the whole price list. No seats, no minimums, no negotiated
rate.

The interesting question is not what a document costs. It is which calls count
as a document, and that is a rule rather than a judgement.

## The predicate

A call is charged when **the document type was determined** and **at least one
of three kinds of evidence came out of it**.

The evidence is any one of three things. A machine-readable zone whose check
digits pass, five or more fields read from the visual zone, or a correctly
decoded barcode. One of the three is enough, and a document that yields all
three is still one credit.

Both halves are required. A page the engine could not identify is not a
document, however much text came off it. A correctly identified document that
yielded nothing is a recognition that produced no value.

The five-field floor is the least obvious of the three, and it is a threshold
rather than a principle. A visual zone that gave up a surname and nothing else
is not a recognized document. One that gave up a name, a number, two dates and
a nationality is. Five is where those two cases separate on real documents.

Every response carries `meta.billed`, so your own records match ours without a
reconciliation step. The figure it sums to is the one `GET /v1/usage` reports
for the period.

## Why `billed` and `recognized` are not the same word

The response carries two independent facts, and conflating them is the mistake
this section exists to prevent.

`meta.status` says how far recognition got. `meta.billed` says whether the
predicate above was satisfied. They usually agree, and the cases where they do
not are real.

A scan can be **recognized and not billed**. The type was determined, one zone
was read, and the engine called it a success. What came out was two visual
fields, no zone and no barcode. The predicate is not met, and nothing is
charged.

A scan can be **billed and not recognized**. The type was determined and a
zone with valid check digits came out, and the engine declined to call the
overall result a success. The caller has the document's contents; the credit
is drawn.

Neither case is a defect. One word is about the process and the other is about
what the process produced. A caller reconciling a bill reads the second one.

## The five outcomes

Recognition ends in one of five states, and four of them are free.

A scan is **recognized** when the type was determined and the data came out.
That is the state a charge normally goes with.

It is **no document found** when nothing document-shaped was located in the
frame. A photograph of a desk, a finger over the lens, an empty page.

It is **unreadable** when a document was there and its type was determined,
and no zone could be read off it. Glare, motion, a resolution too low for the
print.

It is **unsupported document** when something was located whose type is not in
the catalogue. Nothing about retrying helps; the document is not one the
engine reads.

It is **rejected** when recognition ran to the end and the engine did not call
the result a success.

A retry after a free outcome is a new call, and it is free again unless it
produces the evidence. Nothing accumulates: a document photographed four times
badly and once well costs one credit.

## Reserved before, settled after

The charge is not applied at the end of a successful scan. It is held at the
beginning and resolved at the end.

A credit is **reserved** before the engine is called. The hold is a real
movement in the ledger, so the balance reflects it while the scan is running.
Two requests cannot both spend the last credit.

When the result comes back, the hold is **committed** if the predicate is met
and **released** if it is not. A commit that settles a hold moves no further
money; the credit left the balance when the hold was placed.

If the engine fails or times out, the hold is released and the balance is
untouched. The caller gets an error, and the failure costs nothing.

The order matters for the case that would otherwise be worst: an account with
no credits. Because the reservation comes first, such a call is refused with
402 `insufficient_credits` **before** the image is sent for recognition.
Nobody is charged for a call that could not run, and no recognition capacity
is spent on a caller who could not have been served.

The same order is why a balance cannot go negative. The floor is not a check
in the application that could be forgotten on some path. A database constraint
refuses the entry that would take a balance below zero, so the overdraft has
no code path at all.

## What is never charged

**Anything refused before the engine.**

A bad key, a body over the ceiling, a rate limit, an unsupported media type,
an exhausted allowance. All of them are decided in front of recognition, and
none of them costs a credit.

**Anything a sandbox key does.**

Neither kind of sandbox key draws on a balance. The public one runs real
recognition free within its allowance. An account's own sandbox key is
answered from a fixed specimen and never reaches the Engine.

**A replayed request.**

A retry carrying an `Idempotency-Key` that has already been used returns the
first result and charges nothing the second time, while that result is stored.
That is the whole reason the header exists. How long a key is remembered is on
[idempotency](/reference/idempotency).

**A failure on our side.**

An engine that could not be reached, a store that was away, an internal error.
The hold is released, the balance is whole, and the error body says which it
was.

## Why the price is one number

A per-document price with no tiers is unusual enough to be worth explaining.

Volume pricing exists where volume changes a supplier's costs. Recognition does
not work that way here: the hundred-thousandth document costs what the first one
did, because each is one pass over one image.

A published single number also does something a negotiated one cannot. It can be
compared, planned against and put in a spreadsheet before anybody talks to us.
A developer costing an integration at two in the morning gets an exact answer.

The corollary is that there is nothing to ask for. No rate is available that is
not on this page, and no volume unlocks one.

## Where the free documents come from

A caller with no account has 10 free recognitions on the public sandbox key,
counted per client. Past them the API answers `registration_required`, which
is an invitation rather than a wall.

An account gets 100 free documents every month. On the first of each month, at
00:00 UTC, its free credits are set back to 100. What was left of the last month
does not carry over. They can be drawn once the account's email address is
confirmed, and a billable document draws on them first.

Paid credits are a second balance, bought by a top-up. They never reset, and
only scans and purchases change them. A billable document draws one paid credit
once the month's 100 free credits are used up, and when both are gone the API
answers [`insufficient_credits`](/errors/insufficient_credits). A credit is a
cent and a document is a credit, so the two balances together are also the
number of documents left. That is the only arithmetic a caller has to do.
