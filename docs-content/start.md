---
title: Get started
description: "Three ways in: your first call with the public sandbox key, moving to a live key of your own, and recognizing a document without writing code."
type: hub
keyword: document recognition api getting started
nav: Overview
section: Get started
---

# Get started

This section takes you from nothing to a working integration. Two of the three
lessons need no account and no key of your own.

The key they use, `sk_sandbox_public`, is published on purpose. It is not a
demo that replays a canned answer. It runs the same recognition engine a paying
call runs, on the image you send it, and gives the fields back. It allows 10
requests per hour per client address, and a lifetime allowance of free
recognitions per client on top of that.

## The three lessons

1. [Your first recognition](/start/first-recognition) – send one document, read
   every field that comes back, and see what the call took. No account.
2. [From the sandbox to a live key](/start/from-sandbox-to-live) – spend the
   free allowance, register, and point the same code at a key that bills. An
   account, and no money: every account gets 100 free documents every month.
3. [Recognize a document without code](/start/recognize-without-code) – upload
   in the dashboard and read the result on screen. An account. No code at all.

Start with the first if you are integrating, and with the third if you are
deciding whether to.

## What a recognition costs

Nothing on either sandbox key. On a live key, one credit per billable scan, and
one credit is one US cent. A scan is billable when the engine determined the
document type and read something from it. A refusal that happened before the
engine ran is never charged. Every account gets 100 free documents every month,
and those credits are spent before any paid ones. The rule, and the cases
around it, are on
[what a billed scan is](/concepts/what-a-billed-scan-is).

## Where to go next

- [Guides](/guides) – one page per task, from a passport to a driver licence to
  retries.
- [Reference](/reference) – the exact contract: endpoints, response shapes,
  fields, options, errors and limits.
- [Concepts](/concepts) – why the API behaves the way it does.
- [Errors](/reference/errors) – one page per error code, with the cause and the
  fix.
