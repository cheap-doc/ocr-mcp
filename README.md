# doc.cheap MCP server — passport, ID card and MRZ OCR for AI agents

Give your assistant a passport, national ID card or driver's licence and get the
printed fields back as structured JSON — **$0.01 per recognised document**, with
10 free recognitions before you register.

An [MCP](https://modelcontextprotocol.io) server over stdio, for Claude Desktop,
Claude Code, Cursor, VS Code, Gemini CLI, Windsurf, Kiro and any other MCP
client — and the same server hosted at `https://mcp.doc.cheap/mcp` for clients
that connect to a URL instead. It is a thin client of the public doc.cheap HTTP
API and a copy of the documentation: it holds no data of its own.

```
npx -y @doc-cheap/mcp
```

## Hosted — nothing to install

`https://mcp.doc.cheap/mcp` serves the same three tools over Streamable HTTP. No
login: send your key as `Authorization: Bearer sk_live_your_key`, or send no key
and the public sandbox key is used, 10 free recognitions from your address. The
hosted server cannot read files on your machine, so `scan_document` takes the
image as `image_base64` or `image_url`; `image_path` is for the local server
only.

Claude Code:

```bash
claude mcp add --transport http doc-cheap https://mcp.doc.cheap/mcp --header "Authorization: Bearer sk_live_your_key"
```

Claude Desktop and claude.ai: *Settings → Connectors → Add custom connector*,
URL `https://mcp.doc.cheap/mcp` (no key: the sandbox key is used).

Cursor, `~/.cursor/mcp.json`:

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

VS Code, `.vscode/mcp.json` (the key is asked for once and stored by VS Code):

```json
{
  "servers": {
    "doc-cheap": {
      "type": "http",
      "url": "https://mcp.doc.cheap/mcp",
      "headers": { "Authorization": "Bearer ${input:doc-cheap-key}" }
    }
  },
  "inputs": [
    {
      "type": "promptString",
      "id": "doc-cheap-key",
      "description": "doc.cheap API key",
      "password": true
    }
  ]
}
```

## Install locally

Set `DOC_CHEAP_API_KEY` to your key. Leave it out and the server uses the public
sandbox key, which runs 10 free recognitions and has no balance.

### Claude Desktop — one-click extension

Download `doc-cheap-<version>.mcpb` from the
[latest release](https://gitlab.com/doccheap/ocr-mcp/-/releases) and open it, or
drag it into the Claude Desktop window. The install screen asks for two optional
settings: your API key (stored as a secret; leave it empty for the sandbox key)
and the one folder `image_path` may read images from (leave it empty and no
local file is read). Node.js ships with Claude Desktop, so nothing else needs
installing.

### Claude Desktop — by hand

`claude_desktop_config.json`:

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

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project):

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

### VS Code

```bash
code --add-mcp '{"name":"doc-cheap","command":"npx","args":["-y","@doc-cheap/mcp"]}'
```

Or `.vscode/mcp.json`, which nests servers under `servers` rather than
`mcpServers`:

```json
{
  "servers": {
    "doc-cheap": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "sk_live_your_key" }
    }
  }
}
```

### Gemini CLI

`~/.gemini/settings.json`:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "$DOC_CHEAP_API_KEY" }
    }
  }
}
```

The repository also carries `gemini-extension.json`, so it installs as a Gemini
CLI extension without writing settings by hand.

### Windsurf

`~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "${DOC_CHEAP_API_KEY}" }
    }
  }
}
```

### Kiro

`.kiro/settings/mcp.json` in the workspace, or `~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "npx",
      "args": ["-y", "@doc-cheap/mcp"],
      "env": { "DOC_CHEAP_API_KEY": "${DOC_CHEAP_API_KEY}" },
      "disabled": false,
      "autoApprove": ["check_balance", "search_docs"]
    }
  }
}
```

Kiro also installs from a one-click link, which writes that block for you —
it asks for confirmation first and shows the command and argument list it is
about to add:

```
https://kiro.dev/launch/mcp/add?name=doc-cheap&config=%7B%22command%22%3A%22npx%22%2C%22args%22%3A%5B%22-y%22%2C%22%40doc-cheap%2Fmcp%22%5D%2C%22disabled%22%3Afalse%7D
```

(`config` is the URL-encoded JSON of
`{"command":"npx","args":["-y","@doc-cheap/mcp"],"disabled":false}`.)

### Claude Code plugin

The repository carries `.claude-plugin/plugin.json`, so it installs as a Claude
Code plugin rather than as a hand-written server entry.

Every client starts the server as a process, so an edited configuration takes
effect on the client's next launch.

## Tools

| Tool | Title | Read-only | Reaches the network |
|---|---|---|---|
| `scan_document` | Recognise a passport or ID document | no | yes |
| `check_balance` | Check remaining credits | yes | yes |
| `search_docs` | Search the doc.cheap API documentation | yes | no |

### `scan_document`

Recognise a passport, national ID card or driver's licence and return what is
printed on it. Give it the image as `image_base64`, `image_path` or `image_url`,
plus the optional `expect_country`, `return_portrait`, `retain_hours`,
`reference` and `idempotency_key`.

```json
{
  "image_base64": "/9j/4AAQSkZJRgABAQ…",
  "expect_country": "GRC",
  "idempotency_key": "order-4711-front"
}
```

It answers with the whole `Scan` as structured JSON — `meta` (id, status,
`billed`, confidence, timing), `document` (kind, issuing country, number,
series, date of issue, date of expiry, whether it has expired and how many days
are left), `holder` (given names, surname, date of
birth, sex, nationality), `fields` (every field read off the printed page, each
with its own confidence), `mrz` (whether the machine-readable zone checks out,
why not when it does not, and its lines exactly as read), `images`, `quality`
and `authenticity` — and a one-line summary of the same result:

```text
Scan 01a0af18-cd8d-7a61-9f2d-4c7b8e105da3 · recognized · passport (GRC) · PARADEIGMA ELENI SOFIA · billed · 684 ms
```

One recognised document costs one credit, $0.01. An unreadable image, an empty
frame or an unsupported type costs nothing, and `meta.billed` says which
happened. Sending the same `idempotency_key` again returns the first result
rather than recognising and charging a second time.

### `check_balance`

No arguments. Returns the balance, the credits spent and this period's scan
counters by status. With the public sandbox key there is no account behind the
call: the balance comes back as `null`, and the first line says so and how to
get a key, instead of reporting zeros that read like a balance.

```text
Balance: 1840 credits · 63 scans this period (58 billed, 58 credits spent).
```

### `search_docs`

```json
{ "query": "mrz check digit", "limit": 5 }
```

Full-text search over the documentation — endpoints, response fields, error
codes, MRZ rules, retention, pricing — returning the matching sections with
titles, snippets and links. It reads a copy shipped inside this package, so it
makes no network call.

Every tool declares an output schema, and every successful call returns
`structuredContent` that matches it, beside the text blocks: the API's `Scan`
for `scan_document`, its `Usage` for `check_balance`, and `{ "results": [...] }`
for `search_docs`. A failed call is an error block with no structured content.

## Resources

Every page of the documentation this package ships is a read-only resource,
`text/markdown`, with its title and description:

```text
doccheap://docs/reference/fields
doccheap://docs/reference/errors
doccheap://docs/errors/insufficient_credits
```

`resources/list` lists them all, and the template `doccheap://docs/{+slug}`
looks one up by its path. Reading one makes no network call.

## Prompts

| Prompt | Argument | What it asks for |
|---|---|---|
| `scan_document_to_json` | `image_url` | Scan one image and present its printed fields, with the JSON underneath |
| `check_document_expiry` | `image_url` | Scan one image and report the expiry date, whether it has expired and the days left |
| `batch_scan` | `image_urls` | Check the balance, scan each address in turn, then tabulate the results and the failures |
| `explain_error` | `error_code` | Explain an API error code from its documentation page, which is attached |

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `DOC_CHEAP_API_KEY` | `sk_sandbox_public` | Your API key. Unset uses the public sandbox: 10 free recognitions, no balance. |
| `DOC_CHEAP_API_BASE` | `https://api.doc.cheap` | Base URL of the API. Only set this to reach another deployment. |
| `DOC_CHEAP_DOCS_BASE` | `https://doc.cheap/docs` | Base URL used to build documentation links. |
| `DOC_CHEAP_DOCS_DIR` | the copy inside the package | Override the directory `search_docs` reads. |
| `DOC_CHEAP_IMAGE_ROOT` | unset (`image_path` disabled) | The one directory `image_path` may read images from. |
| `DOC_CHEAP_SENTRY_DSN` | unset (nothing is reported) | Opt in to failure reporting. Without it the tracker library is never loaded. |
| `DO_NOT_TRACK` | unset | Set it to `1` and the calls this server makes stop naming which application is driving it. See *What this server sends about itself* below. |

## Image sources

The server runs on your machine, with your files and your network, and the
arguments to `scan_document` are chosen by a model. So the two sources that are
not the image itself are fenced in:

- **`image_path`** is **disabled until you set `DOC_CHEAP_IMAGE_ROOT`** to a
  directory of your choosing. With it set, only files inside that directory can
  be read: both the directory and the requested file are resolved to their real
  locations first, so `..` segments and symlinks pointing out of the directory
  are refused rather than followed. A relative `image_path` is taken from that
  directory. Without the variable the tool answers with an error telling the
  agent to set it or to send `image_base64`.
- **`image_url`** must be `https:` and must resolve to a public internet
  address. Loopback, private, link-local (including the cloud metadata
  address), carrier-grade NAT, multicast, reserved and IPv6 unique-local and
  link-local addresses are refused, as are the IPv4-mapped IPv6 spellings of
  them. Redirects are followed by hand, at most three hops, and every hop is
  re-checked, so a public URL cannot hand off to a private one. The body is
  capped at 25 MB — the API refuses more anyway.
- **`image_base64`** has no such constraints: the caller already holds the
  bytes. It is the fallback every refusal above points at.

A guard refusal is a normal tool error with a readable message, so the agent can
tell you what to change.

## What this server sends about itself

When it calls the doc.cheap API it identifies itself in the request's
`User-Agent`, the way any HTTP client does:

```
doc-cheap-mcp/0.3.1 (claude-code/1.4.2)
```

The first half is this package and its version. The second half is **the name
and version your MCP client reports over the protocol** — the editor or
assistant you launched it from — normalised to a short label, plus the same
label on a `baggage` header. It is used for one thing: counting how much this
server is used and from which applications, so that the work goes where people
actually are. It is never used to change what the server does, and nothing else
about you, your prompts, your files or your images travels with it.

**Switching it off:** set `DO_NOT_TRACK=1` in the server's environment. The
request then carries `doc-cheap-mcp/0.3.1` and nothing more — no client name, no
client version, no `baggage` header — and everything else works identically.

Your API key already identifies your account to the API; that is what a key is
for, and it is unaffected by the setting above.

## Privacy Policy

The full policy is <https://doc.cheap/privacy>. What it says about this server:

- **What is collected.** The image you ask it to read, sent to the doc.cheap API
  (`https://api.doc.cheap`) — nowhere else. Its calls also name this package and
  version, and the client you run it in (see the section above; `DO_NOT_TRACK=1`
  removes the client). Your key identifies your account to the API.
- **How it is used and stored.** The image is read and never stored: it lives
  in memory for the length of the request. The **result** — the fields read off
  the document — is kept for the window the call asked for in `retain_hours`
  (`0` stores nothing) or, when it asked for none, for the account's
  history-retention setting, which defaults to one year; expiry deletes it.
- **Who else sees it.** Nobody the policy does not name: the hosting provider
  and the network provider that carry the traffic. Nothing is sold or shared
  for advertising. Nothing this server does is reported anywhere unless you set
  `DOC_CHEAP_SENTRY_DSN` yourself.
- **On your machine.** The server reads no file unless you name a folder for
  `image_path`, and then only images inside it.
- **Contact.** admin@doc.cheap.

The hosted server keeps nothing either. Its log records which method and which
tool a request called, how long it took and whether a key of your own was
used — never the image, the result, the key or your address.

## Run it from source

```json
{
  "mcpServers": {
    "doc-cheap": {
      "command": "node",
      "args": ["/absolute/path/to/the/checkout/apps/mcp/src/index.ts"],
      "env": { "DOC_CHEAP_API_BASE": "http://127.0.0.1:3000" }
    }
  }
}
```

`pnpm --filter @doc-cheap/mcp build` bundles the server to `build/index.js` with
a shebang and copies the documentation content next to it, so the `bin`
(`doc-cheap-mcp`) runs standalone.

## Licence

MIT — see [LICENSE](https://gitlab.com/doccheap/ocr-mcp/-/blob/main/LICENSE). The monorepo this server is developed in is
UNLICENSED; this package alone is published, and it is published under MIT.

## Links

- Guide: <https://doc.cheap/docs/guides/use-the-mcp-server>
- Documentation: <https://doc.cheap/docs>
- Get an API key: <https://doc.cheap/register>
- Package: <https://www.npmjs.com/package/@doc-cheap/mcp>
- Source and issues: <https://gitlab.com/doccheap/ocr-mcp>
- doc.cheap: <https://doc.cheap>

In the MCP registry this server is `cheap.doc/mcp`.
