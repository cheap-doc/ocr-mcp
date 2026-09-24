---
title: Changelog
description: Every change to the recognition API and to this documentation, dated, newest first, with an Atom feed and a page per month.
type: reference
keyword: doc.cheap changelog
nav: Changelog
section: Changelog
---
# Changelog

Dated, public record of changes to the API and its documentation. The most
recent change is first.

## 2026-09-24 – 1.29.2, a damaged image is refused, not a failure

An image that starts like a JPEG or PNG and cannot be decoded, such as a file
cut off after its header, is refused with 415
[`unsupported_media_type`](/errors/unsupported_media_type) instead of 500
`internal_error`. Nothing is charged, and the sandbox key's free attempt is
handed back.

## 2026-09-24 – 1.29.0, the list endpoint documented, links that resolve

`GET /v1/scans` now has its own reference page, like the other three
endpoints, and is listed in `llms.txt`. The markdown copies of the pages and
`llms-full.txt` carry their links as full addresses, so a link followed from
one of them lands on its page. When the public sandbox key runs out of
requests for the hour, the refusal now says so: `Sandbox limit of 10 requests
per hour per IP reached.`

## 2026-09-24 – 1.28.0, an image that is not one is refused

`POST /v1/scans` reads JPEG and PNG. An `image` whose bytes are neither – a
PDF, a HEIC photo, a text file, a file cut off after its first bytes – is now
refused with 415 [`unsupported_media_type`](/errors/unsupported_media_type)
before recognition runs. It used to reach recognition and come back as 500
`internal_error`. Nothing is charged, and no free attempt of the sandbox key is
spent.

## 2026-09-17 – 1.0.0, the first production release

The document-recognition API, at version 1.

**Recognition.** `POST /v1/scans` takes one image as base64 and returns the
extracted data in the same response. The call is synchronous: no job to poll,
no callback to register. Passports, identity cards, travel documents and
driving licences are read off the printed page, the machine-readable zone and a
barcode where one is printed.

**One response shape.** Eight groups – `meta`, `document`, `holder`, `fields`,
`mrz`, `images`, `quality` and `authenticity` – described key by key on
[the response](/reference/response). `document` carries the document's kind,
issuing state, number, series, date of issue and date of expiry, and whether it
has expired. Every key is present; an absent value is `null` and an absent
collection is empty. `meta.schema_version` is `"1.0"`.

**Fields in every script.** Every field the engine reads is re-keyed to a
stable vocabulary and published once per language, resolved from 418 assigned
language identifiers. A document printed in two scripts carries both spellings,
neither chosen for you.

**The machine-readable zone, verbatim.** `mrz` is a verdict with the zone
beside it: the lines exactly as read, and one unbroken `text` a check-digit
routine takes unchanged.

**Result images.** Seven crops, each capped by height – 250 px for the document
crop, 100 px for the rest – returned by the call that produced them and never
stored.

**Billing.** One credit is one US cent, charged only for a recognition that
produced data. A credit is reserved before the engine runs and settled after.
`GET /v1/usage` reports the balance and the period's counters.

**Retention is the caller's choice.** `retain_hours` decides how long a result
stays readable through `GET /v1/scans/{id}`; `0` writes nothing down at all.

**Safe retries.** An `Idempotency-Key` on a scan request returns the first
result instead of running and charging again.

**Errors.** One error shape everywhere, 21 stable codes, each with a page of
its own at `/errors/<code>` that every error body links to.

**Three ways in.** The public sandbox key `sk_sandbox_public` recognizes real
documents without an account; a registered account's own sandbox key answers
from a fixed specimen; a live key bills.
