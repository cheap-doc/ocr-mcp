---
title: Guides
description: "Task-shaped instructions: recognizing each kind of document, handling errors and retries, controlling retention, managing keys, and tracking spend."
type: hub
keyword: document recognition api guides
nav: Overview
section: Guides
---

# Guides

Each guide answers one task, end to end. They are grouped by the job you have,
not by the endpoint you would call. One endpoint does the recognition, and
almost every question is about what to send it and what to do with the answer.

Every fenced example on these pages is executed against the API on every
commit, with the public sandbox key that is printed in it. An example that
stopped working would fail the build before it reached you.

## Read a document

- [Recognize a passport](/guides/recognize-a-passport) – the request, the
  options, the holder and document blocks, and the machine-readable zone. The
  ID-card layouts are here too.
- [Recognize an ID card](/guides/recognize-an-id-card) – the two-sided case
  against an endpoint that takes one image per call.
- [Recognize a driver licence](/guides/recognize-a-driver-licence) – the
  barcode and the visual zone, for the issuers that print no machine-readable
  zone at all.

## Read the answer

- [Check an MRZ](/guides/check-an-mrz) – re-run the check digits yourself from
  the zone as published.
- [Work with result images](/guides/work-with-result-images) – the crops, their
  sizes and what they are not.
- [Handle non-Latin scripts](/guides/handle-non-latin-scripts) – which values
  are transliterated, and how to ask for both spellings.

## Keep an integration up

- [Handle errors](/guides/handle-errors) – branch on the code, and the table of
  what to do with each of the 21 of them.
- [Retry safely with idempotency](/guides/retry-safely-with-idempotency) – a
  retry that cannot charge twice.
- [Get results without webhooks](/guides/get-results-without-webhooks) – the
  call is synchronous, so there is nothing to register.

## Run the account

- [Control history retention](/guides/control-history-retention) – how long a
  result stays readable, and how to keep nothing at all.
- [Rotate API keys](/guides/rotate-api-keys) – issue, swap and revoke without a
  gap in service.
- [Top up with crypto](/guides/top-up-with-crypto) – fund the balance.
- [Track usage and spend](/guides/track-usage-and-spend) – what the counters
  cover and when they reset.
- [Use the MCP server](/guides/use-the-mcp-server) – give an assistant the
  recognition tools.

If you are here before your first call, start with
[your first recognition](/start/first-recognition) instead. If you want the
exact contract rather than a task, go to the [reference](/reference).
