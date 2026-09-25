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

The body has seven parts.

| Key | Carries |
|---|---|
| `balance_credits` | Credits available to the account right now – this month's free credits plus the paid credits – or null for a key with no account |
| `free_allowance` | This month's free credits: `monthly_credits` (100), `remaining_credits` and `resets_at`; null when the account may not draw free credits |
| `paid_balance_credits` | Paid credits, which never reset; null for a key with no account |
| `period` | The bounds of the current period, as a UTC calendar month |
| `scans` | `total`, `billed`, and `by_status` with one count per recognition status |
| `credits_spent` | Credits charged within the period |
| `credits_spent_by_kind` | `credits_spent` split into `free` and `paid`, by the balance each credit came from |

`balance_credits`, `free_allowance` and `paid_balance_credits` are **current**
figures and do not belong to the period. Everything else in the body does.

## Read the two balances

Every account holds two balances, and a billable scan draws one credit from the
first that has any.

1. **This month's free credits.** An account gets 100 free documents every
   month. `free_allowance.remaining_credits` is what is left of them.
   `free_allowance.resets_at` is when they are next set back to 100: 00:00 UTC
   on the first of the next month. What is left at that moment does not carry
   over.
2. **Paid credits.** `paid_balance_credits` is what top-ups bought and scans
   have not yet used. It never resets; only scans and purchases change it.

`free_allowance` is null when the account may not draw free credits: while its
email address is not confirmed, or when its free credits have been withdrawn. The
paid credits still work then, and `balance_credits` is the paid credits alone.

```json
{
  "balance_credits": 540,
  "free_allowance": {
    "monthly_credits": 100,
    "remaining_credits": 40,
    "resets_at": "2026-10-01T00:00:00.000Z"
  },
  "paid_balance_credits": 500,
  "credits_spent": 60,
  "credits_spent_by_kind": { "free": 60, "paid": 0 }
}
```

The example shows only the balance fields; the full body also carries `period`
and `scans`.

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
body carrying a null balance, a null `free_allowance`, a null
`paid_balance_credits` and zero counters, rather than an invented example.

Neither sandbox key ever adds to `credits_spent`. A registered sandbox key is
answered from a fixed synthetic specimen and is never charged.

## Handle the period rollover

The period is a UTC calendar month, and `period.start` and `period.end` name
its bounds.

At the rollover the counters return to zero and the free credits are set back:
`free_allowance.remaining_credits` becomes 100 again. `paid_balance_credits` is
unchanged. Paid credits carry over; the free credits and the counters describe
the month.

Read `period.start` before you store a reading. A job that runs near midnight
UTC can take two readings belonging to different months. The bounds in the body
are what tells them apart.

No paid credit expires at the rollover. The only monthly figure is the free
credits, which are set back to 100 rather than added to.

## Watch the balance from a deployment

Poll `GET /v1/usage` on a schedule and alert on `balance_credits` below a
threshold you choose. Size the threshold on your own daily volume.

A balance that reaches zero does not go negative. When the month's free credits
and the paid credits are both used up, the next scan is refused with 402
[`insufficient_credits`](/errors/insufficient_credits). That happens before the
engine is called and before anything is charged. To alert only on money you have to add,
watch `paid_balance_credits` instead: the free credits come back on the first of
the month by themselves.

The dashboard shows the same figures with the operations log beside them, at
<https://doc.cheap/app>. The log lists the individual scans; this endpoint is
the aggregate.

## Next

- [Top up with crypto](/guides/top-up-with-crypto) – putting credits on the
  balance.
- [What a billed scan is](/concepts/what-a-billed-scan-is) – the predicate
  behind `billed`.
- [Limits](/reference/limits) – the rate this endpoint shares with the rest.
