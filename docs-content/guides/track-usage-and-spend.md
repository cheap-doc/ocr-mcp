---
title: Track usage and spend
description: Read the balance and the period counters from the API, and reconcile them against what the dashboard shows for the same period.
type: how-to
keyword: api usage and balance endpoint
nav: Track usage and spend
section: Guides
---

# Track usage and spend

`GET /v1/usage` answers with the balance and the counters for the current
period. This guide covers reading it, what each figure counts, and reconciling
it against your own records.

One credit is one US cent and buys the recognition of one document. Every
figure below is in those units.

## Read the counters

The call takes the same `Authorization` header a scan does and returns 200.

```bash runnable tab=curl
curl https://api.doc.cheap/v1/usage \
  -H "Authorization: Bearer sk_sandbox_public"
```

```javascript runnable tab=javascript
const response = await fetch("https://api.doc.cheap/v1/usage", {
  headers: { Authorization: "Bearer sk_sandbox_public" },
});

const usage = await response.json();
console.log(usage.balance_credits, usage.credits_spent, usage.scans.total);
```

```python runnable tab=python
import json
import urllib.request

request = urllib.request.Request(
    "https://api.doc.cheap/v1/usage",
    headers={"Authorization": "Bearer sk_sandbox_public"},
)

with urllib.request.urlopen(request) as response:
    status = response.status
    usage = json.load(response)

print(usage["balance_credits"], usage["credits_spent"], usage["scans"]["total"])
```

The body has four parts.

| Key | Carries |
|---|---|
| `balance_credits` | Credits available to the account right now, or null for a key with no account |
| `period` | The bounds of the current period, as a UTC calendar month |
| `scans` | `total`, `billed`, and `by_status` with one count per recognition status |
| `credits_spent` | Credits charged within the period |

`balance_credits` is a **current** figure and does not belong to the period.
Everything else in the body does.

## Read the status breakdown

`scans.by_status` carries one count for each of the five recognition
statuses.

| Status | Means |
|---|---|
| `recognized` | The document type was determined and a zone or the printed page was read |
| `no_document_found` | Nothing in the frame was located as a document |
| `unsupported_document` | A document was located, and its type is not one the engine reads |
| `unreadable` | The type was determined and no source could be read |
| `rejected` | Recognition ran and the result was not usable |

`scans.total` is every scan the period saw. `scans.billed` is the subset that
drew a credit, and it is the figure to compare against `credits_spent`.

The two are not the same question. A scan can be billed without being
recognized, which is why both counts are published: see
[what a billed scan is](/concepts/what-a-billed-scan-is).

## Reconcile against your own records

Keep `meta.billed` from every scan response and sum it over the same period.
Your sum and `scans.billed` are the two sides to compare.

Three properties make the comparison work.

1. **Every settled scan is counted**, whether or not its result was stored. The
   figures do not decay as retention windows pass, so a month-old total does not
   shrink.
2. **A zero-retention scan still counts.** `retain_hours: 0` leaves no row to
   read back, and the counter was incremented at settlement.
3. **A replayed request is counted once.** An `Idempotency-Key` that returns
   the first result charges nothing the second time and adds nothing here.

If your sum is higher than ours, look for a retry without an idempotency key
that you counted twice. If ours is higher, look for a response your own code
dropped before recording it.

## Know which key reads what

A sandbox key of your own account reads that account's **real** balance and
counters. Usage is an account-level question, and the answer does not change
with the key that asked it.

The public sandbox key belongs to no account. It answers with a well-formed
body carrying a null balance and zero counters, rather than an invented
example.

Neither sandbox key ever adds to `credits_spent`. A registered sandbox key is
answered from a fixed synthetic specimen and is never charged.

## Handle the period rollover

The period is a UTC calendar month, and `period.start` and `period.end` name
its bounds.

At the rollover the counters return to zero and `balance_credits` does not.
Credits carry over; the counters describe the month.

Read `period.start` before you store a reading. A job that runs near midnight
UTC can take two readings belonging to different months. The bounds in the body
are what tells them apart.

Nothing expires at the rollover. A balance is spent when it is spent, and no
figure here is a monthly allowance.

## Watch the balance from a deployment

Poll `GET /v1/usage` on a schedule and alert on `balance_credits` below a
threshold you choose. Size the threshold on your own daily volume.

A balance that reaches zero does not go negative. The next scan is refused with
402 [`insufficient_credits`](/errors/insufficient_credits), before the engine
is called and before anything is charged.

The dashboard shows the same figures with the operations log beside them, at
<https://doc.cheap/app>. The log lists the individual scans; this endpoint is
the aggregate.

## Next

- [Top up with crypto](/guides/top-up-with-crypto) – putting credits on the
  balance.
- [What a billed scan is](/concepts/what-a-billed-scan-is) – the predicate
  behind `billed`.
- [Limits](/reference/limits) – the rate this endpoint shares with the rest.
