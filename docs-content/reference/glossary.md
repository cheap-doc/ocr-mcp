---
title: Glossary
description: The words this documentation uses with a precise meaning, and what each one means here.
type: reference
keyword: document recognition api glossary
nav: Glossary
section: Reference
verified: 1.0.2
---

# Glossary

Every term below is used with one meaning across this documentation, the API and
the dashboard. Where a word is commonly used loosely, the entry says what it is
**not**.

## The call and its result

**Scan.** One call to `POST /v1/scans` and the result it returns. Not a job, not
a transaction, not a document check. A scan is one image; a two-sided card is two
scans.

**Result.** The body a scan returns: eight groups, described key by key on
[the response](/reference/response). One shape, whatever the outcome.

**Reading.** One source's value for one field — the machine-readable zone's
spelling of a surname, or the printed page's. A document printed in two scripts
produces two readings of the same field, and they may differ.

**Field.** One entry of `fields`. Not an attribute, not a property, not a key.
Every field carries a `name`, a `label`, a `category`, a `value`, a `language`
and a confidence band; the whole catalogue is on
[the field catalogue](/reference/fields).

**Status.** `meta.status`, one of `recognized`, `no_document_found`,
`unreadable`, `unsupported_document` and `rejected`. A judgement of how far
recognition got, never of whether the document itself is genuine.

**Recognized.** The `meta.status` value meaning the document type was determined
and data came out of it. Not a synonym for successful, valid, verified or
accepted, and not a synonym for **billed**.

**Confidence band.** `high`, `medium` or `low`. The engine's probability
expressed as one of three words, cut at 90 and 60 out of 100. Never a number in
the response.

**Verdict.** A single conclusion drawn from several checks — `mrz.status` and
`quality.overall` are the two. A verdict names what failed where it can.

## The document

**MRZ.** The machine-readable zone: the block of upper-case letters, digits and
`<` fillers a travel document prints for a machine to read. The formats and the
check digits are on [the MRZ reference](/reference/mrz).

**Visual zone.** The printed face of the document, as a person reads it. The
same facts a travel document also encodes in its MRZ.

**Check digit.** A digit the zone carries over one of the fields it protects,
computed by ICAO 9303's arithmetic. Its outcome reaches a caller as part of
`mrz.status`, not as a digit of its own.

**TD1, TD2, TD3.** The three machine-readable-zone layouts: three lines of 30,
two of 36, and two of 44. A passport booklet is TD3; an identity card is usually
TD1.

**Crop.** One of the seven pictures a recognition cuts out of the uploaded
image. Capped by height, re-encoded without its metadata, and never stored.

**Specimen.** An invented document used in an example or a fixture. Every
example in this documentation uses one invented holder. The word `SPECIMEN`
printed across a sheet says that the sheet is not a document.

## Money

**Credit.** The unit of the balance. One credit is one US cent, and one
recognized document draws one. Not a token, a unit or a point.

**Billed.** Whether a scan drew a credit. `meta.billed` is the answer, and it is
a separate question from **recognized**. A scan can be billed without being
recognized; the rule that decides is on
[what a billed scan is](/concepts/what-a-billed-scan-is).

**Balance.** The credits an account holds. It is also the number of documents
left, because one document is one credit. It never goes negative.

**Reservation.** A credit held before the engine is called and settled after.
A scan that never reached the engine releases it, so nothing is charged.

**Top-up.** Adding credits to a balance. A crypto top-up quotes an amount at a
price that is locked for the life of the quote.

## Keys and identity

**Live key.** `sk_live_…`. A key that bills. Not a production key, a real key or
a secret key.

**Sandbox key.** An account's own `sk_sandbox_…` key. Never billed, and answered
from a fixed synthetic specimen so a client can build against a stable result.
Not a test key or a dev key.

**Public sandbox key.** `sk_sandbox_public`, the one printed in every example.
No account, never billed, and it **runs real recognition on the image it is
sent**. A lifetime free allowance and a rate limit per address bound it. Not a
demo key, a trial key or an anonymous key.

**Session.** How the dashboard identifies a person, as against how an API key
identifies an integration. The two surfaces are kept apart on purpose.

**Account.** What owns a balance, a set of keys, a history and a retention
setting.

## Time and storage

**Retention window.** The hours a result stays readable through
`GET /v1/scans/{id}`. Set per request with `retain_hours`, or by the account's
own setting when the request names none. Not a TTL, a storage period or an
expiry.

**Zero retention.** `retain_hours: 0`. No history row is written at all, so
nothing exists that a later read could find — as against a row that expires
immediately.

**Thumbnail.** A picture of at most 96 px that a retained scan keeps, readable
in the dashboard rather than through this API. It is made from the uploaded
bytes, not from a crop.

**Idempotency key.** The `Idempotency-Key` header that makes a retried scan
return the first result instead of running and charging again. The rules are on
[idempotency](/reference/idempotency).

## The interface

**The dashboard.** The web application at `doc.cheap` where a person signs in.
Not the cabinet, the portal, the console or the panel.

**Error code.** The stable string in `error.code`. Twenty-one exist, and
branching on the code is what an integration does; the HTTP status groups them.

**`request_id`.** `req_` and a UUID, on every error body. It identifies that one
request in the service's logs. Opaque.

**`event_id`.** Present only when the service recorded the failure as something
to look at. `null` on every error a caller is meant to handle. Opaque.

**`reference`.** The caller's own correlation string, up to 128 characters,
echoed back on the result and on every history row. The service never reads it.

**Engine.** The recognition engine behind the API. It is always "the Engine"
here — never a vendor's name, a library or a model.
