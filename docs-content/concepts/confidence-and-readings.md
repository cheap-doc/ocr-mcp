---
title: Confidence and readings
description: Why confidence is a band rather than a number, why one field can be read more than once, and what a verdict of not_checked is saying.
type: explanation
keyword: ocr confidence score meaning
nav: Confidence and readings
section: Concepts
---

# Confidence and readings

Every value in a recognition result arrived with some amount of doubt attached
to it. How that doubt is reported is a decision, and this page is the argument
for the decision that was taken.

Two things follow from it. Confidence is published as a band and never as a
number. A field read more than once is published once per reading, rather than
collapsed into a winner.

## Why a band and not a number

The engine produces a probability for each value it reads. Publishing that
number would be the obvious thing to do, and it would be worse than what the
service does instead.

A recognition probability is not a calibrated percentage. It is a score a
model produced about its own output. It does not mean that 97 out of 100
values scored at 97 are correct. Nothing in the pipeline makes that true, and
nothing measures whether it is.

A caller who sees `0.97` builds a threshold on it anyway. That is what a
number invites: somebody writes `if (confidence > 0.95)` and ships it, and the
threshold now carries a claim nobody ever supported. When the model changes,
the distribution behind the number moves and the threshold silently starts
meaning something else.

The result therefore publishes `high`, `medium` or `low`, and the boundaries
are fixed: `high` from 90, `medium` from 60, and `low` below that. A value
whose probability the engine did not report reads `low` rather than being
absent. Absence is the one answer that would let a consumer treat unknown as
fine.

Three bands are about as much as the underlying number honestly supports. They
are enough to sort a queue, to route a document for review, or to color a cell
in a report. That is what a caller actually does with confidence.

## What a band is about

A band describes **the reading**, not the document and not the holder.

A `low` band on a surname says the characters were hard to make out. It does
not say the surname is wrong, and it does not say the document is forged. It
is not an authenticity signal of any kind.

The reverse matters as much. A well-made counterfeit produces a `high` band on
every field. Its print is clean, so it reads cleanly. Confidence measures
legibility.

The document's own type match carries its own band,
`document.type_confidence`. It answers a different question again: how sure
the engine is that this page is the kind of document it says it is.

## Why one field has several readings

A document prints the same fact in more than one place, and sometimes in more
than one script. The engine reads each of them.

The response keeps them apart. `fields` carries one entry per reading, and
each entry names the language it was read under. A Greek passport prints the
holder's surname in Greek and again transliterated into Latin, and both
entries are published, each with its own band.

Collapsing them would throw away the only thing that makes a disagreement
visible. Two readings of one name that differ are a signal; one value chosen
by us for reasons the caller cannot inspect is not.

This is why an entry's `id` and not its `name` is the unique value. `name`
repeats across the readings of one field, on purpose, and a consumer keying on
it keeps whichever arrived last.

The curated blocks beside the list — `holder` and `document` — carry one value
each, in Latin. A great many consumers want exactly that, and should not have
to walk a list to get it. The list is there when the choice matters.

## Why the picture gets one verdict

`quality.overall` is a single word about the uploaded picture, and there is no
breakdown beside it.

An earlier shape published the engine's own list of checks. Each check was
named by an integer, and those integers have no verified map to anything a
person can read. A caller was handed `check_7: fail` and could act on none of
it. Not on which check it was, not on what would satisfy it, not on whether it
mattered.

One verdict a caller can act on is worth more than a list they cannot. A scan
whose quality reads `fail` is a scan to re-photograph, and that is the whole
of what the breakdown would have told them.

The same reasoning governs the machine-readable zone. Its verdict is a status
and one sentence naming what did not check out, rather than a table of
per-digit results. What the sentence names is enough to act on. The zone
itself is published verbatim for anyone who wants to re-run the arithmetic.

## Why `not_checked` is not `pass`

Both `quality.overall` and `authenticity.overall` can read `not_checked`, and
that value exists to avoid a lie.

A scan read back from storage carries no engine output. The result is rebuilt
from what was written down when the scan ran. The engine's assessment of the
picture was not part of it. The picture itself was never kept, so nothing is
left to assess.

Reporting that as `pass` would vouch for a photograph this process never saw.
A consumer reading a stored scan would be told the picture was good enough, on
the authority of nobody.

`not_checked` says the honest thing: nothing measured this. It is a third
answer, distinct from both `pass` and `fail`, and code that branches on
quality has to handle it. That is the cost of the honesty, and it is small.

`authenticity.overall` reads `not_checked` for a different reason. This
service performs recognition, and recognition is not authentication. Nothing
here inspects security features, and a field that would report on them says so
rather than staying silent.

## What to do with a low band

A band is an input to your own policy, and the policy is yours because the
consequences are.

A document that decides a small refund and a document that opens an account do
not deserve the same threshold. No default we could choose would be right for
both. What the service can do is report legibility honestly and leave the
decision where the risk is.

Two things are worth pairing with the band. The machine-readable zone's
verdict is an independent check on the same values, and it is arithmetic
rather than opinion. And a second reading of the same field, where one exists,
is a second opinion the engine already gave you.
