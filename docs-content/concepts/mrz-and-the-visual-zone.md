---
title: The MRZ and the visual zone
description: Why a document says the same thing twice, when the two zones disagree, and which one to believe in each of those cases.
type: explanation
keyword: mrz versus visual zone
nav: MRZ and visual zone
section: Concepts
---

# The MRZ and the visual zone

An identity document prints the holder's name twice, the date of birth twice
and the document number twice. That looks like redundancy and is not. The two
printings are for two different readers, and the difference between them
explains several things about the response that otherwise look arbitrary.

## Two readers, two zones

The **visual zone** is the document as a person reads it. It is laid out for
the eye: labels beside values, a photograph, a signature, whatever typeface
and language the issuer chose. It carries everything the issuer wanted on the
page.

The **machine-readable zone** is a block of upper-case letters, digits and `<`
fillers. It sits at the bottom of a data page, or on the back of a card. Its
alphabet has 27 characters and nothing else, its lines are a fixed length, and
every value sits at a fixed offset. It exists so that a border desk can read a
passport in a second. No language, font or layout gets in the way.

Its most useful property is arithmetic. The zone carries check digits. One
covers the document number, one covers each date, and a final one covers the
composite of the protected fields. Each is a weighted sum modulo 10 over
characters that are already in the zone.

That makes the zone the one part of a recognition result a caller can verify
without trusting the service that produced it. It is published verbatim for
that reason, lines and all, rather than being reassembled from the parsed
values.

## What each zone can hold

The zone is small, so it holds only what its format has room for. That is the
document type, the issuing state, the name and the number. It is also the date
of birth, the sex, the nationality, the date of expiry, and one optional-data
field.

Everything else is visual only. An address, a place of birth, an issuing
authority, a licence category, an eye color: none of them has a slot. None of
them can be checked by a check digit.

**No format encodes a date of issue.**

A date of issue in a result is therefore always a reading of the printed page.
It can be absent on a document whose zone passed every digit. The zone was
read perfectly and never carried it.

The optional-data field is where a personal number travels, when the issuer
puts one there. The TD2 layout has no room for it, so a TD2 travel document
reports no personal number even when the page prints one.

## How the two are merged

The engine reads a field from each zone that carries it. It reports a merged
value for the field, alongside the per-zone readings it merged from.

The response publishes the merged value, one entry per language. It does not
publish the per-zone readings as separate entries. A caller arbitrating
between them would need the issuer's own transliteration rules, which is
exactly the knowledge the engine already applied.

What the response does publish is the **outcome** of the comparison. When a
field the two zones both carry disagrees, the zone's verdict becomes `failed`.
The sentence names the field: `MRZ does not match the visual zone for:
surname`. A caller who never looks at an individual reading still learns that
the document contradicted itself.

Fields that exist only inside the zone are left out of the field list
altogether. Take the zone's own type code, its filler and its structural
values. Their content is either the zone's plumbing or a duplicate of the
printed page. The verdict on all of it is the `mrz` block.

## Per-field consequences

The design above produces a handful of behaviors that surprise people once
each.

A field can be present and unverifiable. An address read from a licence has no
check digit behind it and never will, and its only backing is its confidence
band.

A field can be verified and still contradicted. A document number whose check
digit passes was correctly transcribed into the zone. If the page prints a
different one, both facts are true at once and the verdict is `failed`.

The zone can be perfect and the page unreadable. A photograph that cut off the
top half of a passport can still yield a passed zone, a name and a number. It
yields no issue date, no place of birth and no authority.

The page can be complete and the zone absent. Most driving licences carry no
zone at all, and `mrz.status` reads `absent` with its `reason`, `lines` and
`text` all null. Nothing failed.

## Where the formats come from

The zone is not our invention, and neither is its arithmetic. Both come from a
published international standard for travel documents.

That standard defines three layouts. A passport booklet uses two lines of 44
characters. An identity card uses three lines of 30, and an older card or
travel document uses two lines of 36.

The layouts differ because the documents differ in size, and each one packs
the same values into the room it has. A shorter format drops what it cannot
fit, which is why one of them carries no optional-data field at all.

Two things follow for a caller. The zone on any of the three yields the same
set of values once it is read. Code that handles a passport handles a card.
And a library that implements the standard can verify our published zone
without knowing anything about this service.

## Which one to believe

When the two agree, the question does not arise, and that is the ordinary
case.

When they disagree, the zone is the better-evidenced half. It was printed by
the issuer in a fixed format, and it carries its own arithmetic. A
transcription error inside it is caught by that arithmetic rather than by
anybody's judgement.

The page is the richer half. It carries the fields the zone has no room for,
and it carries them in the script the issuer actually printed.

Neither of those makes the other wrong. A disagreement between two zones of
one document is a document to look at, not a value to pick. The two were
produced together by one issuer at one moment, and something has to explain
why they no longer match. The ordinary explanation is a poor photograph, and a
second scan settles it. The interesting explanation is that one of the two was
altered.

## Why this is not an authenticity check

A zone whose every digit passes says the zone is internally consistent. It
says nothing about whether the document is genuine.

Check digits are a published algorithm over published data. Anybody making a
counterfeit computes them correctly, because getting them wrong is the one
mistake that any reader catches for free.

What the zone's verdict is good for is catching damage, glare, wear and
transcription. Those are the accidents that make a reading wrong without
anybody intending it. That is a large share of the bad data an integration
meets, and the zone catches it cheaply.

Recognition is not verification, and this service reports the first. The
`authenticity` block says `not_checked` rather than pretending otherwise, for
the reasons on [confidence and readings](/concepts/confidence-and-readings).
