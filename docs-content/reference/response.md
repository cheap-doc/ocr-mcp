---
title: The response
description: The recognition result, group by group — every key, its type, when it is null, and what each value is derived from.
type: reference
keyword: document recognition api response
nav: The response
section: Reference
verified: 1.0.0
---

# The response

The body `POST /v1/scans` returns, and the body `GET /v1/scans/{id}` returns
for a stored scan. One response shape, with no way to ask for another.

The body answers the question a caller has: what does this document say, and can
it be trusted. It does not hand over the recognition engine's working notes.
Every value is a conclusion — one value per reading, a confidence band, and a
single verdict on the machine-readable zone.

**Every key is present.** A value that is not known is `null`, never a missing
key, and a collection that is empty is `[]`. A consumer can read
`scan.holder.surname` after one null check on `holder`, never a chain of them.

## The eight groups

| Group | Type | What it carries |
|---|---|---|
| `meta` | object | The scan itself: its id, outcome, billing, timing and revision |
| `document` | object or null | What the document is, and whether it is still valid |
| `holder` | object or null | The person the document is about |
| `fields` | array | Every field read off the printed document, re-keyed |
| `mrz` | object | The machine-readable zone as a verdict, with its lines |
| `images` | object | Seven image slots |
| `quality` | object | Whether the picture was good enough to recognize from |
| `authenticity` | object | Authenticity verification, when it runs |

Every example on this page is one holder: Eleni Sofia Paradeigma, an invented
Greek national whose documents are invented with her. The values below are hers
throughout the documentation.

```json
{
  "meta": {
    "schema_version": "1.0",
    "id": "01a0af18-cd8d-7a61-9f2d-4c7b8e105da3",
    "status": "recognized",
    "billed": true,
    "confidence": "high",
    "timing": { "upload_ms": 198, "processing_ms": 812, "total_ms": 1024 },
    "created_at": "2026-09-17T10:15:00Z",
    "reference": "order-1042"
  },
  "document": {
    "kind": "passport",
    "country": "GRC",
    "country_name": "Greece",
    "issuing_state": "GRC",
    "type_name": "Greece - Passport",
    "type_confidence": "high",
    "is_expired": false,
    "days_remaining": 2001
  },
  "holder": {
    "given_names": "ELENI SOFIA",
    "surname": "PARADEIGMA",
    "full_name": "PARADEIGMA ELENI SOFIA",
    "birth_date": "1994-03-08",
    "sex": "F",
    "nationality": "GRC"
  },
  "fields": [
    { "id": "surname@0", "name": "surname", "label": "Surname", "category": "identity", "value": "PARADEIGMA", "language": null, "confidence": "high" },
    { "id": "surname@1032", "name": "surname", "label": "Surname", "category": "identity", "value": "ΠΑΡΑΔΕΙΓΜΑ", "language": "Greek", "confidence": "high" }
  ],
  "mrz": {
    "status": "passed",
    "reason": null,
    "lines": [
      "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<",
      "AM73045184GRC9403084F3203101PN48291630<<<<72"
    ],
    "text": "P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<AM73045184GRC9403084F3203101PN48291630<<<<72"
  },
  "images": {
    "document_crop": "data:image/jpeg;base64,…",
    "rear": null,
    "main_photo": "data:image/jpeg;base64,…",
    "signature": "data:image/jpeg;base64,…",
    "watermark_face": null,
    "barcode": null,
    "chip": null
  },
  "quality": { "overall": "pass" },
  "authenticity": { "overall": "not_checked", "checks": [] }
}
```

`fields` is truncated above to two entries; a real passport produces about
twenty.

## meta

| Key | Type | Meaning |
|---|---|---|
| `schema_version` | string | Always `"1.0"` |
| `id` | string | The scan id |
| `status` | string | How far recognition got |
| `billed` | boolean | Whether the scan drew a credit |
| `confidence` | band | How strongly the recognition as a whole is backed |
| `timing` | object or null | The split of the request's time |
| `created_at` | string | ISO 8601 timestamp in UTC |
| `reference` | string or null | The request's own correlation string |

### schema_version

The revision of this body. A removal or a rename moves its major segment. A
consumer that pins the value therefore fails loudly, rather than quietly reading
a key that changed meaning.

It is not the `/v1` in the path. The path names the API; this names the shape of
the body under it.

### id

A UUID version 7 in canonical lower-case `8-4-4-4-12` form, as defined by
RFC 9562. Its leading 48 bits are the millisecond the scan was made, so ids sort
as strings in the order the scans happened.

Treat the value as opaque. Nothing else about it is part of the contract.

### status

Exactly these five strings; no numeric codes.

| Value | Meaning |
|---|---|
| `recognized` | The document type was determined and data came out of it |
| `no_document_found` | Nothing document-shaped was in the frame |
| `unreadable` | A document was there, but no usable text was read off it |
| `unsupported_document` | A document was found, but its type is not a known one |
| `rejected` | Recognition failed on the service's side |

All five arrive under HTTP 200. A failure to recognize is an outcome, not an
error.

### billed

Whether this scan drew a credit. `recognized` and `billed` are separate facts: a
scan can be billed without being recognized, and the rule that decides is on
[what a billed scan is](/concepts/what-a-billed-scan-is).

### timing

| Key | Measures |
|---|---|
| `upload_ms` | From the request's headers arriving to its body being received and validated. The key is resolved and its rate limit checked inside this number; the allowance, idempotency and credit gates are not |
| `processing_ms` | The recognition itself, the engine call |
| `total_ms` | From the request arriving to the result being complete |

`total_ms` is at least `upload_ms + processing_ms`. The remainder is the gates
that run once `upload_ms` is taken: the allowance, the idempotency check and
the credit hold. Preparing the result images and mapping the engine's output
into this body are in it too.

It stops there. Writing the history row and serializing the response happen
after the number is fixed, so the stored figure and the returned figure are the
same.

The split separates the caller's own network from the service's engine. `timing`
is `null` on a scan stored before the split was measured and read back later.

## document

| Key | Type | Meaning |
|---|---|---|
| `kind` | string | Document type, for example `passport` |
| `country` | alpha-3 or null | Country of the document |
| `country_name` | string or null | That country's name |
| `issuing_state` | alpha-3 or null | Issuing state |
| `type_name` | string or null | The full type name, for example `Greece - Passport` |
| `type_confidence` | band | How strongly the type match is backed |
| `is_expired` | boolean or null | Whether the document had expired at the time of the scan |
| `days_remaining` | integer or null | Days until expiry; negative once expired |

`type_name` carries no catalogue ordinal. The recognition engine appends a
number to distinguish two catalogue entries that print the same name, and a
trailing `" #2"` is stripped before publication. That number says nothing about
the document in front of the camera.

`type_name` is `null` on a scan read back from storage. Only the live engine
result carries it, and no engine result is kept.

`document` as a whole is `null` when no document was identified.

## holder

| Key | Type |
|---|---|
| `given_names` | string or null |
| `surname` | string or null |
| `full_name` | string or null |
| `birth_date` | date or null |
| `sex` | `M`, `F`, `X` or null |
| `nationality` | alpha-3 code or null |

A name never contains a line break. A document that prints the holder's names
across two lines yields one value with a single space between them, in every
script. A scan stored before that rule existed is repaired when it is read back.

`holder` carries the merged Latin reading. The national-script spelling is an
entry of `fields`, not a second set of keys here.

## fields

Every field read off the printed document, re-keyed to this API's own
vocabulary. The set is **open**: a field the vocabulary does not name is still
published, with a slugged key and the category `other`.

| Key | Type | Meaning |
|---|---|---|
| `id` | string | Identity of this entry, unique across the array |
| `name` | string | The stable snake_case key |
| `label` | string | The human label |
| `category` | string | `identity`, `document`, `dates`, `address`, `visa` or `other` |
| `value` | string or null | The value of this reading |
| `language` | string or null | The language this reading was made in |
| `confidence` | band | How strongly this reading is backed |

**`name` repeats; `id` does not.** A document that prints a field in two scripts
yields one entry per script, all under the same `name`. `id` is `name@lcid` —
the key, an `@`, and the numeric language identifier — with `#2`, `#3` appended
when the same pair appears twice.

The whole catalogue, the open-set rule and the two field types withheld on
purpose are on [the field catalogue](/reference/fields). The language
identifiers are on
[field languages and scripts](/reference/fields/languages).

### The same value in two places

A value can appear twice in one body: once in `holder` or `document`, and once
in `fields`. They are not duplicates of one another.

| Where | What it carries |
|---|---|
| `holder`, `document` | The merged best reading, in a fixed set of keys |
| `fields` | One entry per reading, including the national-script one |

A consumer that wants a name reads `holder`. A consumer that wants the Greek
spelling reads the `fields` entry whose `language` is `Greek`.

## Confidence is a band

Every confidence in this body is one of three words, never a number.

| Band | The engine reported |
|---|---|
| `high` | 90 or above, out of 100 |
| `medium` | 60 up to 90 |
| `low` | Below 60, or no probability at all |

A missing probability reads as `low` rather than being absent, so the key is
always answerable. `meta.confidence` and `document.type_confidence` are scored
from 0 to 1. They are cut at the same two points, 0.9 and 0.6, so `high` means
the same thing wherever it appears.

Bands rather than numbers, because a recognition probability is not a calibrated
percentage. A consumer that saw `97` would build a threshold on it that means
nothing.

## mrz

| Key | Type | Meaning |
|---|---|---|
| `status` | `passed`, `failed` or `absent` | The verdict |
| `reason` | string or null | One sentence naming what did not check out; null unless `failed` |
| `lines` | array of strings or null | The zone's lines in order, exactly as read |
| `text` | string or null | The same lines run together, one unbroken string |

`passed` means the zone is present, every check digit validated, and nothing in
it contradicts the printed page. `failed` means the zone is present and
something did not check out. `absent` means the document carries none.

`reason` names a subject whenever it can. When the aggregate fails with no field
to blame, the sentence is exactly `MRZ check digits did not validate`.

`lines` and `text` travel with the verdict rather than instead of it. They are
the only part of the response that can be independently re-verified. The formats
and the per-digit detail are on [the MRZ reference](/reference/mrz).

## images

Seven slots, each a `data:` URL or `null`.

| Key | What it is |
|---|---|
| `document_crop` | The document cropped out of the uploaded picture and deskewed |
| `rear` | The rear side, when one is in the frame |
| `main_photo` | The holder's photograph as printed |
| `signature` | The signature strip |
| `watermark_face` | The faint second copy of the holder's face printed into the page as a security feature |
| `barcode` | The barcode region |
| `chip` | The chip symbol |

`main_photo` is `null` when the request sent `return_portrait: false`. The other
six are unaffected by that option.

Crops are never stored, so a scan read back from storage carries all seven as
`null`. The height caps and the re-encode are on
[result images](/reference/images).

## quality

| Key | Type |
|---|---|
| `overall` | `not_checked`, `pass`, `warn` or `fail` |

One verdict on whether the uploaded picture was good enough to recognize from.
The value is the worst thing any check said about it. A single failed check is a
failed picture, whatever the engine's own aggregate read.

**`not_checked` is a distinct answer from `pass`.** It is what a result read back
from storage carries, because a stored result keeps no engine output. Reporting
that as a pass would vouch for a picture the process never saw.

No per-check breakdown is published. The engine's own check types are integers
with no verified name map, so a breakdown handed a reader `check_7: fail` and
nothing to act on.

## authenticity

| Key | Type |
|---|---|
| `overall` | `not_checked`, `pass`, `warn` or `fail` |
| `checks` | array of check objects |

Under the recognition-only scenario `overall` is `not_checked` and `checks` is
empty. The group is present so a consumer's parsing does not change when
authenticity verification is populated.

A member of `checks` carries `name`, `label`, `result` (`pass`, `warn` or
`fail`) and `detail`, which is a string or null.

## What changes when a scan is read back

`GET /v1/scans/{id}` returns the stored result. It differs from the recognition
response in exactly four places, and all four have the same cause: no engine
output is kept.

| Key | On a read-back |
|---|---|
| `images` | All seven slots `null` |
| `quality.overall` | `not_checked` |
| `document.type_name` | `null` |
| `meta.timing` | The stored figures, or `null` on a scan stored before they were measured |

Everything else is the body that was returned at the time. The read is never
billed, and it never re-runs recognition.

## Reading it safely

Four rules cover the shapes a consumer meets.

1. Check the group, not the key. `document`, `holder` and the scalar values
   inside them can each be `null`; the groups themselves are the null checks
   worth writing.
2. Key `fields` by `id`, never by `name`.
3. Branch on `status` before reading data. Four of the five outcomes carry
   little or nothing.
4. Pin `meta.schema_version`. A consumer that asserts `"1.0"` learns about a
   change from its own tests rather than from a wrong value in production.

## Related

- [Scan options](/reference/scan-options) — what a request can set.
- [POST /v1/scans](/reference/endpoints/create-a-scan) — the endpoint, its
  headers and every status it answers with.
- [Versioning](/reference/versioning) — what a breaking change would be.
