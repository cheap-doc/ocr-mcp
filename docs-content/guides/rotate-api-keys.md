---
title: Rotate API keys
description: Issue a second key, move traffic onto it and revoke the old one, without a window in which calls fail.
type: how-to
keyword: rotate api key without downtime
nav: Rotate API keys
section: Guides
---

# Rotate API keys

A key that has leaked, or that has been in one deployment for a long time,
should be replaced. This guide covers the replacement that leaves no window in
which calls fail.

Rotate on a schedule you choose, and rotate at once when a key reaches a log, a
ticket, a screenshot or a repository.

## Understand what identifies a key

A key is shown in full once, at the moment it is created. Copy it then; it
cannot be read again from anywhere.

What identifies it afterwards is its **prefix**: the kind marker plus the first
8 characters of the secret body, as in `sk_live_9c41ba2e`. The dashboard, the
listing and your own records all work from that.

The prefix also carries the kind. A key whose prefix begins `sk_sandbox_` is
never charged, and the kind is read from those characters rather than looked up
anywhere. A key that starts `sk_live_` bills.

An account holds up to 10 active keys, which is what makes the overlap below
possible.

## Overlap, then revoke

Do the three steps in this order. The old key keeps working throughout.

1. **Issue the new key.** Open <https://doc.cheap/app/keys>, create a key of
   the same kind, and give it a name that says where it is going. Copy the
   secret.
2. **Deploy it.** Put the new secret into the configuration of every service
   that calls the API, and roll them. Both keys authenticate during this
   window, so a half-rolled fleet is a fleet that still works.
3. **Revoke the old key.** Come back to the key list and revoke the one you
   replaced. Do it only once nothing sends it any more.

The list shows a **Last used** column for every key. It is stamped at most once
a minute, so a key that has been quiet for an hour has genuinely been quiet.
Wait for the old key to go quiet before step 3, and the rotation costs no
failed call.

> **Warning.** The **Rotate** action in the dashboard is not this procedure. It
> withdraws the old secret at once and issues the replacement in the same step,
> so every caller still holding the old one starts failing. Use it when a key
> has leaked and the leak matters more than the gap.

## Verify the new key before you revoke anything

Make one call with the new secret and check that it answers 200. Read the key
out of the environment rather than pasting it into the code you deploy.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer ${DOC_CHEAP_API_KEY:-sk_sandbox_public}" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const key = process.env.DOC_CHEAP_API_KEY ?? "sk_sandbox_public";
const image = readFileSync("document.jpg").toString("base64");

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image }),
});

console.log(response.status, key.slice(0, 16));
```

```python runnable tab=python
import base64
import json
import os
import urllib.request

key = os.environ.get("DOC_CHEAP_API_KEY", "sk_sandbox_public")

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image}).encode(),
    headers={
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status

print(status, key[:16])
```

## What a revoked key answers

A revoked key stops authenticating immediately, and it is refused the way an
invented key is: 401 [`unauthorized`](/errors/unauthorized). A caller cannot
tell a revoked key from one that never existed, which is deliberate.

```bash runnable expect=401 tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_live_revoked_example" \
  -H "Content-Type: application/json" \
  -d '{"image": "aGVsbG8="}'
```

```javascript runnable expect=401 tab=javascript
const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_live_revoked_example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image: "aGVsbG8=" }),
});

const body = await response.json();
console.log(body.error.code, body.error.docs_url);
```

```python runnable expect=401 tab=python
import json
import urllib.error
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": "aGVsbG8="}).encode(),
    headers={
        "Authorization": "Bearer sk_live_revoked_example",
        "Content-Type": "application/json",
    },
)

try:
    with urllib.request.urlopen(request) as response:
        status = response.status
        body = json.load(response)
except urllib.error.HTTPError as error:
    status = error.code
    body = json.load(error)

print(status, body["error"]["code"])
```

A revoked key also drops out of the key list. Withdrawal is permanent, so keep
your own note of which prefix served which deployment.

## Keep an inventory you can act on

A rotation is fast when you already know which key is where. Keep three things
for every live key you issue.

| Record | Why it is needed |
|---|---|
| The prefix | The only identifier that survives after the secret is shown |
| Where the secret is configured | What has to be rolled before the old key goes |
| Who issued it, and when | What tells a stale key from a current one |

Name the key for its destination when you create it. A list of keys named for
their services is an inventory; a list of keys named "key 3" is not.

Rotate one destination at a time. A rotation that touches two services at once
turns a failure into a question about which one it came from.

## Set an expiry when the key is temporary

A key can be created with an end of validity. Past it the key is refused like
an unknown one, with no action needed from you.

Use it for a contractor, a migration or a trial integration. A key that expires
on a date you chose is one you cannot forget to withdraw.

## Next

- [API keys and sessions](/concepts/api-keys-and-sessions) – the three kinds of
  key and why they are kept apart.
- [Handle errors](/guides/handle-errors) – what to branch on when a call is
  refused.
- [Limits](/reference/limits) – the rate a registered key is allowed.
