---
title: Use the MCP server
description: Install the MCP server with npx so a coding assistant can recognize a passport or ID, check the balance and search these docs from your editor.
type: how-to
keyword: mcp server document recognition
nav: Use the MCP server
section: Guides
---

# Use the MCP server

The MCP server gives an assistant three tools against this API: recognize a
document, read the balance, search the documentation. This guide covers
installing it in each client, what each tool does, and the two image sources
that are fenced in.

The server is a thin client of the public HTTP API. It holds no data of its
own, speaks Model Context Protocol over stdio, and is launched by your client
as a command. One recognized document costs one credit, $0.01.

## Connect to the hosted server

The same three tools are hosted at `https://mcp.doc.cheap/mcp` over Streamable
HTTP, for a client that connects to a URL rather than launching a command. No
login is needed. Send your key as `X-Doc-Cheap-Api-Key: sk_live_your_key` or
`Authorization: Bearer sk_live_your_key`. The named header wins when both are
sent. That suits a client or proxy that uses `Authorization` for its own login.
An `Authorization` that does not carry a doc.cheap key is ignored, never passed
on. Without a key, the public sandbox key is used. It gives 10 free recognised documents per address in all, and at most 10 requests per address an hour, whatever their answer. Registering gives 20 free credits.

The hosted server cannot read files on your machine, so `scan_document` takes
the image as `image_base64` or `image_url` there.

```bash
claude mcp add --transport http doc-cheap https://mcp.doc.cheap/mcp --header "Authorization: Bearer sk_live_your_key"
```

In Cursor the entry names a `url` and its `headers` instead of a command:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "url": "https://mcp.doc.cheap/mcp",
      "headers": { "Authorization": "Bearer sk_live_your_key" }
    }
  }
}
```

In VS Code, `.vscode/mcp.json` gives the entry `"type": "http"` and the same
`url` and `headers`. In Claude Desktop and claude.ai, add it under Settings,
Connectors, as a custom connector with that URL.

## Install it

The package is `@doc-cheap/mcp`, and every client below starts it with `npx`.
Set `DOC_CHEAP_API_KEY` to your key. Without a key, the public sandbox key is used. It gives 10 free recognised documents per address in all, and at most 10 requests per address an hour, whatever their answer. Registering gives 20 free credits. The sandbox key has no
balance.

### Claude Desktop, Cursor and Windsurf

These three read the same `mcpServers` block, in
`claude_desktop_config.json`, `~/.cursor/mcp.json` and
`~/.codeium/windsurf/mcp_config.json`.

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "sk_live_your_key" }
    }
  }
}
```

### Claude Code

```bash
claude mcp add-json doc-cheap '{"command":"npx","args":["-y","@doc-cheap/mcp"],"env":{"DOC_CHEAP_API_KEY":"sk_live_your_key"}}'
```

### VS Code

```bash
code --add-mcp '{"name":"doc-cheap","command":"npx","args":["-y","@doc-cheap/mcp"]}'
```

A `.vscode/mcp.json` file works too. It nests servers under `servers` rather
than `mcpServers`, and each one names its `type`.

### Gemini CLI

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "sk_live_your_key" }
    }
  }
}
```

The public repository also carries a `gemini-extension.json`, so
`gemini extensions install https://gitlab.com/doccheap/ocr-mcp` installs it
without editing settings at all.

### Kiro

`.kiro/settings/mcp.json` in the workspace, or `~/.kiro/settings/mcp.json` for
every workspace:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "sk_live_your_key" },
      "disabled": false,
      "autoApprove": ["check_balance", "search_docs"]
    }
  }
}
```

`autoApprove` is listed with the two read-only tools and not with
`scan_document`: that one spends credit, so it is worth a prompt.

Restart the client after editing the configuration. The server is started by
the client, so it picks up a changed environment only on a fresh launch.

## Configure it

Everything is optional, and every default is a working setting.

| Variable | Default | What it decides |
|---|---|---|
| `DOC_CHEAP_API_KEY` | `sk_sandbox_public` | Which key the calls carry |
| `DOC_CHEAP_API_BASE` | `https://api.doc.cheap` | Which API the tools call |
| `DOC_CHEAP_DOCS_BASE` | `https://doc.cheap/docs` | The base the search results link to |
| `DOC_CHEAP_DOCS_DIR` | The copy inside the package | Where `search_docs` reads from |
| `DOC_CHEAP_IMAGE_ROOT` | Unset, which disables `image_path` | The one directory local images may be read from |
| `DOC_CHEAP_SENTRY_DSN` | Unset, which reports nothing | Where failures are reported, if you want them reported |

With no key set, the server uses the public sandbox key. Without a key, the public sandbox key is used. It gives 10 free recognised documents per address in all, and at most 10 requests per address an hour, whatever their answer. Registering gives 20 free credits. It has no
balance to report, so `check_balance` answers without calling the API.

## Use the three tools

Each tool carries a title and the behaviour hints an MCP client reads before
it decides whether to ask you first.

| Tool | Title | `readOnlyHint` | `openWorldHint` | Calls |
|---|---|---|---|---|
| `scan_document` | Recognise a passport or ID document | `false` | `true` | `POST /v1/scans` |
| `check_balance` | Check remaining credits | `true` | `true` | `GET /v1/usage` |
| `search_docs` | Search the doc.cheap API documentation | `true` | `false` | Nothing; reads the bundled docs |

`scan_document` also declares `destructiveHint: false` and
`idempotentHint: true`. The second is true because of `idempotency_key`: a
repeat carrying the same key returns the first result instead of charging
again. A retry without a key is a second scan.

`scan_document` takes the image as `image_base64`, `image_path` or
`image_url`, and the same options a direct call takes: `expect_country`,
`return_portrait`, `retain_hours`, `reference` and `idempotency_key`. It
answers with the whole result as structured JSON, plus a one-line summary.

Its summary line names the scan id, the status, the document kind and country,
the holder, whether the call was billed, and the recognition time.

```text
Scan 01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 · recognized · passport (GRC) · PARADEIGMA ELENI SOFIA · billed · 684 ms
```

A recognized document draws one credit, $0.01. A scan that recognized nothing
is counted and never charged, and `meta.billed` says which happened.

`check_balance` needs a key with an account behind it. Under the public sandbox
key the balance comes back as `null`. Its first line says there is no balance,
rather than showing zeros that look like a reading.

`search_docs` takes a `query` and an optional `limit` between 1 and 20,
defaulting to 5. It reads a copy of this documentation shipped beside the
server, so it works with no network.

Every tool declares an output schema. A successful call returns structured
content that matches it: the `Scan` for `scan_document`, the `Usage` for
`check_balance`, and a `results` list for `search_docs`. A failed call returns
an error block and no structured content.

## Read the docs as resources

Every page of these docs is also a read-only MCP resource in markdown. Its
address is its path, such as `doccheap://docs/reference/fields` or
`doccheap://docs/errors/rate_limited`. The template `doccheap://docs/{+slug}`
looks up any page by path. Reading one makes no network call.

## Start from a prompt

The server offers four prompts. Each one drives the tools above.

| Prompt | Argument | What it asks for |
|---|---|---|
| `scan_document_to_json` | `image_url` | Scan one image and present its printed fields |
| `check_document_expiry` | `image_url` | Report the expiry date, whether it has expired, and the days left |
| `batch_scan` | `image_urls` | Check the balance, scan each address, then list the failures |
| `explain_error` | `error_code` | Explain an error code from its documentation page |

## For AI agents

The server introduces itself with instructions the model reads before any
call. They say what it recognizes, when to reach for `scan_document`, and what
a call costs. Each tool description then carries its inputs, the shape of the
answer and the price. A model can choose between them without a round trip.

If you are an agent reading this page: call `scan_document` with
`image_base64` when a user shares an identity document and wants it read,
transcribed or checked. Call `check_balance` before a batch. Call
`search_docs` for field names, error codes and MRZ rules rather than guessing
them.

## Enable local files deliberately

`image_path` is **off until you set `DOC_CHEAP_IMAGE_ROOT`** to one directory.
With the variable unset, the tool answers with an error telling the assistant
to send `image_base64` instead.

The server runs on your machine with your privileges, and the argument is
chosen by a model. Unfenced, a path argument would read any file on the disk
and send it out in an API call.

With the variable set, the containment is decided on real paths. Both the
directory and the requested file are resolved through symlinks first. A `..`
segment and a link pointing out of the directory are both refused.

A relative `image_path` is taken from that directory rather than from wherever
the client happened to start the process.

> **Note.** A path outside the directory and a path that does not exist give
> the same message. A different one for each would answer "does this file
> exist?" for any path on your machine.

## Understand the URL guard

`image_url` is fetched by the server, so it is fenced the same way.

- The scheme must be `https:`. Any other scheme would let a tool call reach
  local files or services.
- The host must resolve only to public internet addresses. Loopback, private,
  link-local, carrier-grade NAT, multicast and reserved ranges are refused,
  including their IPv6-mapped spellings.
- One non-public answer refuses the whole URL. A name that resolves to both a
  public and a private address gets no second chance.
- Redirects are followed by hand, at most three hops, and every hop is checked
  again. A public URL cannot hand off to a private one.
- The body is capped at 25 MB, counted as it arrives rather than trusted from
  the `content-length` header.

`image_base64` carries none of these constraints, because the caller already
holds the bytes. Every refusal above points at it.

## Read a failure

Every failure comes back as one readable line in an error block, never as a
silent empty result. The assistant can act on it and can show it to you.

A refusal by the API keeps the API's own wording, with the error code and the
link to its page. A guard refusal names what to change.

Nothing is reported anywhere by default. Failure reporting is off unless you
set a reporting endpoint yourself, and without one the tracker library is never
even loaded.

## Fix a server that does not answer

Work through these in order when the client reports no tools.

1. **The command.** The client launches `npx` as a process, so `npx` must be
   on the path the client uses, which is not always your shell's.
2. **The key.** A `check_balance` that says there is no balance means the
   public sandbox key is in use, so `DOC_CHEAP_API_KEY` did not reach the
   process.
3. **The base URL.** A tool that cannot reach anything is usually pointed at
   something other than `https://api.doc.cheap` by an inherited
   `DOC_CHEAP_API_BASE`.
4. **The restart.** An edited configuration takes effect when the client next
   starts the server.

Read the client's own MCP log for the process output. The server writes every
diagnostic to standard error, because standard output belongs to the protocol.

## Next

- [Recognize a passport](/guides/recognize-a-passport) — what the tool's result
  carries.
- [Track usage and spend](/guides/track-usage-and-spend) — the figures
  `check_balance` reads.
- [API keys and sessions](/concepts/api-keys-and-sessions) — which key to give
  it.
