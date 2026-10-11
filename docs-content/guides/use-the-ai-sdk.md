---
title: Use the AI SDK
description: Give a model built with the AI SDK five tools that recognize a passport, ID card or driver licence and work with stored scans and the balance.
type: how-to
keyword: ai sdk document recognition tool
nav: Use the AI SDK
section: Guides
---

# Use the AI SDK

The package `@doc-cheap/ai-sdk` turns this API into five tools for the
[AI SDK](https://ai-sdk.dev). A model that has them can recognize a passport,
national ID card or driver licence and read the balance. It can also list,
read back and delete the scans an account has stored. This guide covers installing it,
passing a key, what each tool sends, and what the model sees of the answer.

The tools are a thin client of the public HTTP API. They hold no data of their
own. One recognized document costs one credit, $0.01. An unreadable image, an
empty frame or an unsupported document costs nothing, and `meta.billed` says
which happened.

## Install it

```bash
npm install @doc-cheap/ai-sdk ai zod
```

`ai` (version 6 or 7) and `zod` (3.25.76 or later, or 4) are peer
dependencies, so the package uses the copies your project already has. It
needs Node.js 20 or later.

## Give the tools to a model

```ts
import { generateText, isStepCount } from "ai";
import { docCheapTools } from "@doc-cheap/ai-sdk";

const { text } = await generateText({
  model: "openai/gpt-5-mini",
  tools: docCheapTools(),
  stopWhen: isStepCount(3),
  prompt:
    "Read the passport at https://example.com/passport.jpg and tell me " +
    "the holder's name and when the passport expires.",
});
```

`docCheapTools()` returns all five tools under the names below. To give a
model only some of them, build each one on its own:

```ts
import { getUsage, scanDocument } from "@doc-cheap/ai-sdk";

const tools = { scanDocument: scanDocument(), getUsage: getUsage() };
```

## Pass a key

Set `DOC_CHEAP_API_KEY` to a live key, or pass `apiKey` to the builder. The
environment is read when a tool runs, not when it is built. Every builder takes
the same three options:

| Option | Default | Meaning |
| --- | --- | --- |
| `apiKey` | `DOC_CHEAP_API_KEY`, then `sk_sandbox_public` | The key sent as a Bearer token. |
| `baseUrl` | `DOC_CHEAP_API_BASE`, then `https://api.doc.cheap` | The API's address. |
| `fetch` | the runtime's own | The fetch the API calls go through. |

Without a key, the public sandbox key is used. It gives 10 free recognized
documents per address in all, and at most 10 requests per address an hour,
whatever their answer. Registering gives 100 free documents every month. See
[from sandbox to live](/start/from-sandbox-to-live) for the switch.

## The tools

| Tool | Request | What it does |
| --- | --- | --- |
| `scanDocument` | `POST /v1/scans` | Recognizes a passport, ID card or driver licence. |
| `getScan` | `GET /v1/scans/{id}` | Reads back a stored result. Never charges. |
| `deleteScan` | `DELETE /v1/scans/{id}` | Deletes a stored result for good. |
| `listScans` | `GET /v1/scans` | Lists stored results, newest first, 1 to 100 a page. |
| `getUsage` | `GET /v1/usage` | The balance and this period's counters. |

`scanDocument` takes the image as exactly one of `imageUrl` and `imageBase64`.
The other inputs map onto the request. `expectCountry`, `returnPortrait` and
`retainHours` become the [scan options](/reference/scan-options), and
`reference` is echoed back. `idempotencyKey` is sent as the `Idempotency-Key`
header, so a retried call [cannot charge twice](/guides/retry-safely-with-idempotency).

The package checks the image before it uploads anything. Only JPEG and PNG are
sent, and 25 MiB at most. An `imageUrl` is downloaded by the package itself,
over `https:` only. A URL that points at a private, loopback or link-local
address is refused, and so is a redirect to one.

A result is stored only when the scan was made with a live key under a
non-zero [retention window](/guides/control-history-retention). Under a sandbox
key nothing is stored, so `getScan` and `deleteScan` answer `not_found` and
`listScans` is empty.

## What the model sees

Your code gets the whole result of every tool, exactly as the API returned it.
The copy of a `scanDocument` or `getScan` result that goes back to the model
has each image crop replaced by a short note of its size. A model cannot look
at base64 text, and the [crops](/guides/work-with-result-images) would fill its
context window.

## When a call fails

A failed call throws a `DocCheapError` with the HTTP `status` (or `null` when
no answer came back) and the API's own `code`. The AI SDK hands its message to
the model as the tool's error result, so the model can react to it. The codes
and what to do with each are in [handle errors](/guides/handle-errors). Two
more come from the package itself: `invalid_input` for arguments it refused
before sending, and `image_refused` for an `imageUrl` it could not or would not
fetch.

Every request carries `User-Agent: doc-cheap-ai-sdk/<version>`. Nothing else
about your application is sent.
