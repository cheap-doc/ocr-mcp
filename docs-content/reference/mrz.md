---
title: MRZ reference
description: The machine-readable zone as this API publishes it — the lines, the unbroken text, the three formats, and how the check digits are reported.
type: reference
keyword: mrz machine readable zone api
nav: MRZ reference
section: Reference
verified: 0.67.0
---

# MRZ reference

The machine-readable zone (MRZ) is the block of upper-case letters, digits and
`<` fillers printed at the bottom of a passport data page. An identity card
carries it on the back. It is the one part of a document a caller can re-verify
without trusting this service, and it is published verbatim for that reason.

## Where it appears

| Key | Carries |
|---|---|
| `mrz.status` | `passed`, `failed` or `absent` |
| `mrz.reason` | One sentence naming what did not check out |
| `mrz.lines` | The lines in order, or `null` |
| `mrz.text` | The lines run together, one unbroken string, or `null` |
| `fields[]` entry `mrz` | The zone's text as a field of the report |

## lines

The zone's lines in order, exactly as read. Two lines for a TD3 passport, three
for a TD1 card.

Nothing is reconstructed. The lines come from the one field the recognition
engine reports the zone in, never from the parsed values. A caller re-running
the check digits over a reconstructed zone would be checking this service's
arithmetic rather than the document's.

The filler `<` is kept. It carries the padding the check digits are computed
over, so trimming it would make the digits fail.

What is removed is whitespace, which the zone's alphabet does not contain. A
space or a tab inside a line is the reading equipment, not the document.

## text

The same lines run together with **nothing between them**: no newline, no
space, one unbroken string.

```json
{
  "lines": [
    "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<",
    "AM73045184GRC9403084F3203101PN48291630<<<<72"
  ],
  "text": "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<AM73045184GRC9403084F3203101PN48291630<<<<72"
}
```

The zone's alphabet is `A-Z`, `0-9` and `<`, so joining the lines loses
nothing: no separator can be confused with content, and none needs to be
chosen. A checksum routine or a border-control library takes the value
unchanged, and `lines` is there for anything that needs the rows one at a time.

## The three formats

| Format | Lines | Characters per line | Where it is met |
|---|---|---|---|
| TD1 | 3 | 30 | Identity cards, residence permits |
| TD2 | 2 | 36 | Older identity cards and some travel documents |
| TD3 | 2 | 44 | Passport booklets |

Whichever format it is, the zone fills the same values once it is read.

- `holder.surname`, `holder.given_names`, `holder.birth_date`, `holder.sex`
  and `holder.nationality`
- `document.issuing_state`, and `document.days_remaining` through the date of
  expiry
- the `document_number` and `personal_number` entries of `fields`

The personal number comes from the zone's optional-data field, which TD2 does
not carry.

**No format encodes a date of issue.** The `issue_date` field is therefore
always a reading of the printed page. It is absent on a document whose visual
zone was not read, even when every check digit passed.

## How the check digits are reported

A zone carries a check digit over each of the fields it protects, and a final
digit over the composite of them. Every one of them is verified, and the outcome
is published as one verdict with a sentence.

| `status` | Meaning |
|---|---|
| `passed` | A zone is present, every check digit validated, and nothing in it contradicts the printed page |
| `failed` | A zone is present and something did not check out |
| `absent` | The document carries no zone, or none was read |

`reason` is `null` unless the status is `failed`. When it is `failed`, the
sentence names what went wrong, and it is assembled from two clauses.

| Clause | Sentence |
|---|---|
| A digit failed, and the field it protects is known | `Check digit failed for: document number, date of birth` |
| The aggregate failed with no field to blame | `MRZ check digits did not validate` |
| The zone disagrees with the printed page | `MRZ does not match the visual zone for: surname` |

Both clauses can appear at once, joined by `; `. A verdict a caller cannot act
on is worth no more than none, so `failed` always names a subject where one
exists.

The per-digit outcomes are not published. They are the zone's own plumbing. A
caller that wants to see them re-runs the digits over `text`, which is published
verbatim for that purpose.

## The zone as a field

The zone is also one entry of `fields`. A reader looking at the field table
therefore sees the part of the page that can be re-checked by hand.

| Key | Value |
|---|---|
| `id` | `mrz@0` |
| `name` | `mrz` |
| `label` | `MRZ` |
| `category` | `document` |
| `language` | `null` |
| `value` | The same string as `mrz.text` |
| `confidence` | Always `high` |

`language` is `null` because the zone is defined over a restricted Latin
alphabet and has no language of its own.

`confidence` is always `high`, and it is not a measurement. The zone either
read or it did not; the recognition engine reports no probability for the lines
as a whole. What says whether to trust them is the check-digit verdict, not a
band here.

The entry is absent when the document carries no zone.

## Cross-zone comparison

A passport prints the same facts twice: once for a person to read and once for
a machine. The verdict covers both the digits and the agreement between the two
zones. That is why `failed` can name a field whose check digits were fine.

A disagreement is usually a misread character rather than a forged document.
Where the two zones read a field differently, the `reason` names that field
instead of leaving the caller to compare them.

## When there is no zone

A driving licence, most national identity documents outside the travel-document
formats, and any document photographed from the wrong side carry no readable
zone.

`mrz.status` is `absent`, and `reason`, `lines` and `text` are all `null`. The
group itself is always present.

`absent` is an outcome, not a failure. A document that never had a zone is
recognized normally, and `status` on the scan itself stays `recognized`.
