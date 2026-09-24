---
title: Versioning
description: One response shape, one version, and what a consumer can rely on.
type: reference
keyword: api versioning policy
nav: Versioning
section: Reference
verified: 1.0.2
---

# Versioning

Two numbers are published, and they say different things.

| Number | Where | What it names |
|---|---|---|
| `v1` | The path, `https://api.doc.cheap/v1/…` | The API: its endpoints, its authentication, its error shape |
| `1.0` | `meta.schema_version` in every result | The version of the response body |

Every scan answers in one response shape. No header or option selects the
shape, and a request that sends one is refused with 422
[`validation_failed`](/errors/validation_failed) naming what it sent.

## `meta.schema_version`

Every result carries it, and its value is `"1.0"`.

It is a string, not a number. Compare it as a string; arithmetic on it is wrong.

A consumer that pins the value checks that the body is the one it was written
against, which is the point of publishing it.

## What counts as breaking

A breaking change is one that can turn a working consumer into a broken one
without the consumer changing.

| Change | Breaking |
|---|---|
| Removing a key from a response | Yes |
| Renaming a key | Yes |
| Narrowing a type – a nullable key that stops being nullable is not breaking; one that starts being nullable is | Yes, when it widens |
| Adding a value to an enum a consumer branches on | Yes |
| Removing a request field | Yes |
| Making an optional request field required | Yes |
| Changing what an existing key means, at the same type | Yes |
| Adding a key to a response | No |
| Adding an optional request field | No |
| Adding a new endpoint | No |
| Adding an error code to an endpoint that already answers errors | No |
| Widening an accepted range | No |

Nothing in the non-breaking column changes `meta.schema_version`: a key added
to the body arrives under `"1.0"`.

## What a consumer should assume

- **Keys may be added.** Ignore what you do not recognize rather than refusing
  the body.
- **`fields` is an open set.** A key the
  [field catalogue](/reference/fields) does not list is still published; render
  it from `label` and `category` rather than dropping it.
- **A string enum may gain a value.** Branch on the values you know and have a
  default; `meta.status` is the one to be careful with.
- **Null is a value.** Every key is present, and a key whose value is unknown is
  `null` rather than absent.

A consumer built on those four assumptions survives every change in the
non-breaking column without a release.

## How a breaking change would be announced

A breaking change would be announced on the [changelog](/changelog), which
carries an Atom feed at [`/changelog/feed.xml`](/changelog/feed.xml), before the
change lands rather than with it.

An address, once published, keeps working. The per-code error pages are the
clearest case. `docs_url` in an error body is `/errors/<code>`, and a body
already sent cannot be rewritten, so those addresses do not move.

## What is not versioned

- **`request_id` and `event_id`.** Both are opaque strings. Their shape is not
  part of the contract, and code that parses either is reading something that
  was never promised.
- **The scan id.** A UUID version 7 in canonical form, and opaque past that.
- **A `message` string.** It is for a person. The `code` beside it is the stable
  half.
- **The recognition engine's own behaviour.** A document that reads better next
  month reads better without a version moving; recognition quality is not a
  contract.
