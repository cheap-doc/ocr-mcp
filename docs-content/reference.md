---
title: Reference
description: "The exact contract: endpoints, response shapes, the field catalogue, scan options, errors, limits, idempotency and versioning."
type: hub
keyword: document recognition api contract
nav: Overview
section: Reference
verified: 0.66.0
---

# Reference

This section states what the API does, exactly. It describes and does not
instruct: the task-shaped pages are the [guides](/guides), and the reasons
behind a behaviour are in [concepts](/concepts).

Every page here is either generated from the contract or checked against the
release named in its footer. The base URL is `https://api.doc.cheap`, the one
host the contract's `servers` block declares.

## The contract itself

| Page | What it states |
|---|---|
| [API reference](/reference/api) | The whole of `openapi.yaml`, rendered in the browser |
| [POST /v1/scans](/reference/endpoints/create-a-scan) | Request fields, headers, every response status and the codes it can answer with |
| [GET /v1/scans/{id}](/reference/endpoints/retrieve-a-scan) | The path parameter, the stored result and when it is gone |
| [GET /v1/usage](/reference/endpoints/get-usage) | The balance and the counters for the current period |

These four are rendered from `openapi.yaml` at build time. The contract is the
source. The schemas and the routes produce it, and the pages are produced from
it, so neither can drift from the running service.

## The result

| Page | What it states |
|---|---|
| [The response](/reference/response) | The eight groups, every key, its type, and when it is null |
| [Field catalogue](/reference/fields) | Every field key the result publishes, with its label and category |
| [Field languages and scripts](/reference/fields/languages) | The 418 assigned language identifiers a reading can carry |
| [MRZ reference](/reference/mrz) | The zone as it is published, and how its check digits are reported |
| [Result images](/reference/images) | The seven crops, their height caps and what the re-encode does |

## The rules of the interface

| Page | What it states |
|---|---|
| [Scan options](/reference/scan-options) | The six options, their defaults and their ranges |
| [Errors](/reference/errors) | All 21 codes, including the three no public call can raise |
| [Limits](/reference/limits) | Every ceiling a caller meets, and the code each one answers with |
| [HTTP status codes](/reference/http-status-codes) | Which codes share a status, and what separates them |
| [Idempotency](/reference/idempotency) | What makes two requests the same request |
| [Versioning](/reference/versioning) | What counts as a breaking change, and what does not |
| [Service levels](/reference/service-levels) | What the published indicators measure |
| [Glossary](/reference/glossary) | The words this documentation uses with a precise meaning |

## What is generated and what is written

The error pages are the clearest case. Their set comes from the `ErrorCode`
enum in the contract, not from a list beside it. A code with no page fails the
build, and a page whose name is not a code fails it too. All 21 codes therefore have a
page, including the three raised only on internal surfaces. A `docs_url` that
answers 404 is worse than a short page.

The language table is generated the same way, from the 418 identifiers the
recognition engine can report. Both are rebuilt on every commit, so a number on
a page here is the number in the code.
