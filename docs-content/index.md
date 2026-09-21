---
title: Document recognition API documentation
description: Turn a photo of a passport or ID card into structured JSON with one HTTP call. Run the example here, then pick a guide or the reference.
type: hub
keyword: document recognition api
nav: Overview
section: Home
---

# Document recognition API

Turn a photo of a passport or ID into structured data with one HTTP call. The
API is synchronous: you send an image and the extracted fields come back in the
same response. Each answer carries a confidence score and the checks the engine
ran.

You can call it right now, without an account, using the public sandbox key
`sk_sandbox_public`. It recognizes the document you send, free of charge, for a
limited number of documents and up to 10 requests per hour per IP.

## Try it in one call

This runs as written. The image in it is a one-pixel placeholder, so the answer
is a `200` reporting `no_document_found`. Put a base64-encoded photograph of a
document in its place and the fields come back:

```bash runnable
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d '{"image":"/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q=="}'
```

The base URL `https://api.doc.cheap` is the host the OpenAPI `servers` block
names. [Your first recognition](/start/first-recognition) does the same call
with your own document, in curl, JavaScript or Python, and reads every field
that comes back.

## The four sections

- [Get started](/start) — your first call, then a key of your own.
- [Guides](/guides) — one page per task, from recognizing a passport to
  tracking what you spend.
- [Reference](/reference) — the exact contract: endpoints, response shapes,
  fields, options, errors and limits.
- [Concepts](/concepts) — why the API behaves the way it does.

## Start here

- [Your first recognition](/start/first-recognition) — one call, and what comes
  back.
- [What a billed scan is](/concepts/what-a-billed-scan-is) — the rule that
  decides whether a call is charged at all.
- [Recognize a passport](/guides/recognize-a-passport) — the full request,
  every option, and how to read the result.
- [Errors](/reference/errors) — one page per error code, with the cause and the
  fix.
- [Changelog](/changelog) — dated list of changes, with a feed.

## For AI coding agents

Machine-readable copies of this site live at [/llms.txt](/llms.txt) (a short
index) and [/llms-full.txt](/llms-full.txt) (every page as one markdown file).
Any page is also available as bare markdown at its `.md` address, for example
[/start/first-recognition.md](/start/first-recognition.md).
