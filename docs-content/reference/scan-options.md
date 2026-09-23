---
title: Scan options
description: "Every option on a scan request: what it changes, its default, its allowed values, and the options that interact with each other."
type: reference
keyword: scan request options reference
nav: Scan options
section: Reference
verified: 0.66.0
---

# Scan options

`POST /v1/scans` carries an optional `options` object beside the image. Five
options exist, and every one of them has a default. A request that sends no
`options` at all is a valid request.

```json
{
  "image": "<base64>",
  "reference": "order-1042",
  "options": {
    "mode": "full",
    "expect_country": null,
    "date_format": "iso",
    "return_portrait": true,
    "retain_hours": 0
  }
}
```

## The five options

| Option | Type | Default | Allowed values |
|---|---|---|---|
| `mode` | string | `"full"` | `"full"` |
| `expect_country` | string or null | `null` | ISO 3166-1 alpha-3, three upper-case letters |
| `date_format` | string | `"iso"` | `"iso"` |
| `return_portrait` | boolean | `true` | `true`, `false` |
| `retain_hours` | integer or null | `null` | `0`–`8760` |

`options` is a strict object. A key that is not one of these five is refused with
[`validation_failed`](/errors/validation_failed) and a 422, and the message
names the offending path. A misspelled option is never ignored.

### mode

Selects the recognition mode. `"full"` is the only value the contract declares,
and it is the default.

### expect_country

The country the caller expects the document to have been issued by, as an
ISO 3166-1 alpha-3 code such as `GRC`. It is a hint carried into recognition,
not an assertion. A document from another country is still recognized, and
`document.country` reports what was read rather than what was expected.

`null`, the default, expects nothing.

### date_format

The format of every date in the response. `"iso"` is the only value the
contract declares. Dates are `YYYY-MM-DD` and timestamps are
`YYYY-MM-DDTHH:MM:SSZ`, in UTC.

### return_portrait

Whether the holder's photograph is returned with the result. With `false` the
crop is absent from the response and `images.main_photo` is `null`.

The setting does not change what is stored, because no crop is ever stored. It
changes what one response carries.

### retain_hours

How many hours the result stays readable through
`GET /v1/scans/{id}`. The range is `0` to `8760`, one year.

| Value | Effect |
|---|---|
| `0` | Nothing is written down. No history row, no thumbnail, and no later read |
| `1`–`8760` | The result is readable for that many hours from the scan |
| `null` (default) | The account's own history-retention setting decides |

`0` is not a short window. It writes no row at all, rather than a row that
expires at once. Nothing exists in the interval that a read could find.

An explicit value always wins over the account's setting, `0` included. The
setting applies only when the request names no value. An upload made from the
dashboard is the case that names none.

The dashboard offers four windows for that setting: 24 hours, 7 days, 1 month
and 1 year. A new account carries 1 year. The API accepts any integer in the
range, so a value the dashboard does not offer is still a valid `retain_hours`.

## reference is not an option

`reference` is a sibling of `options`, not a member of it. It is the caller's
own correlation string, at most 128 characters, echoed back unchanged on the
result and on every history row. Its default is `null`.

```json
{ "image": "<base64>", "reference": "order-1042", "options": { "retain_hours": 0 } }
```

Putting `reference` inside `options` is refused with
[`validation_failed`](/errors/validation_failed), because `options` rejects a
key it does not declare.

## What an invalid value answers

Every refusal below is a 422 carrying
[`validation_failed`](/errors/validation_failed), with the offending path in
the message. Nothing reaches the recognition engine, and nothing is charged.

| Sent | Refused because |
|---|---|
| `"mode": "fast"` | Not one of the declared values |
| `"expect_country": "de"` | Not three upper-case letters |
| `"retain_hours": 9000` | Above the maximum of 8760 |
| `"retain_hours": -1` | Below the minimum of 0 |
| `"retain_hours": 1.5` | Not an integer |
| `"retain_days": 7` | Not a key `options` declares |

## Which options interact

| Options | What happens |
|---|---|
| `retain_hours: 0` and an `Idempotency-Key` | The first result is returned once and not stored. A later retry under the same key answers [`idempotency_replay_unavailable`](/errors/idempotency_replay_unavailable) |
| `retain_hours` and the account setting | The explicit value wins, `0` included; the setting applies only when the request sends `null` or nothing |
| `return_portrait: false` and the rest | `images.main_photo` is null; the other six image slots are unaffected |

Nothing an option sets changes what a scan costs. Billing is decided by the
outcome alone, which is [what a billed scan is](/concepts/what-a-billed-scan-is).
