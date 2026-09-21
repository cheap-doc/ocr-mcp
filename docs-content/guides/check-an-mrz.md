---
title: Check an MRZ
description: Verify the check digits of a machine-readable zone, read what a failed digit means, and decide what to do with the document.
type: how-to
keyword: verify mrz check digits
nav: Check an MRZ
section: Guides
---

# Check an MRZ

The machine-readable zone (MRZ) carries its own check digits, and this service
publishes the zone verbatim so that you can re-run them. This guide covers
reading our verdict, re-checking it yourself, and deciding what a failure
means.

Re-checking is worth doing when the document decides money or access. It is the
one part of the answer you can verify without trusting us.

## Read the verdict

Every result carries `mrz.status`, which is `passed`, `failed` or `absent`. On
`failed`, `mrz.reason` is one sentence naming what did not check out.

Branch on `status` first. Most integrations need nothing else, and the digits
below are for the cases where they do.

```bash runnable tab=curl
curl -X POST https://api.doc.cheap/v1/scans \
  -H "Authorization: Bearer sk_sandbox_public" \
  -H "Content-Type: application/json" \
  -d "{\"image\": \"$(base64 < document.jpg | tr -d '\n')\"}"
```

```javascript runnable tab=javascript
import { readFileSync } from "node:fs";

const image = readFileSync("document.jpg").toString("base64");

const response = await fetch("https://api.doc.cheap/v1/scans", {
  method: "POST",
  headers: {
    Authorization: "Bearer sk_sandbox_public",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ image }),
});

const scan = await response.json();
console.log(scan.mrz.status, scan.mrz.reason, scan.mrz.text);
```

```python runnable tab=python
import base64
import json
import urllib.request

with open("document.jpg", "rb") as file:
    image = base64.b64encode(file.read()).decode()

request = urllib.request.Request(
    "https://api.doc.cheap/v1/scans",
    data=json.dumps({"image": image}).encode(),
    headers={
        "Authorization": "Bearer sk_sandbox_public",
        "Content-Type": "application/json",
    },
)

with urllib.request.urlopen(request) as response:
    status = response.status
    scan = json.load(response)

print(scan["mrz"]["status"], scan["mrz"]["reason"], scan["mrz"]["text"])
```

## Hand `mrz.text` to a checksum routine

`mrz.text` is the zone's lines run together with nothing between them: one
unbroken string, no newlines and no spaces. The zone's alphabet is `A-Z`, `0-9`
and the filler `<`, so joining the lines loses nothing.

That is the value a checksum library wants. Pass it unchanged.

```text
P<GRCPARADEIGMA<<ELENI<SOFIA<<<<<<<<<<<<<<<<AM73045184GRC9403084F3203101PN48291630<<<<72
```

Do not trim the `<` fillers. They are padding the check digits are computed
over, and a trimmed zone fails digits that a whole one passes.

Do not reconstruct the zone from the parsed fields either. A rebuilt zone
checks our arithmetic rather than the document's, which is the opposite of the
reason to re-check.

The zone's length tells the routine which format it is. A TD3 passport is 88
characters, a TD1 card is 90, and a TD2 travel document is 72. The full layout
table is on the [MRZ reference](/reference/mrz).

## Check one digit by hand

Use this when a library disagrees with us and you need to see which one is
right. The arithmetic is the same for every digit of every format.

1. Give each character a value. `<` is 0 and a digit is itself. A letter is its
   position in the alphabet plus 9, so `A` is 10 and `Z` is 35.
2. Multiply the values by the repeating weights 7, 3, 1, starting at 7.
3. Sum the products and take the remainder modulo 10. That is the digit.

The passport number of the specimen below is `AM7304518`, and the zone prints
`4` after it.

```text
character   A    M    7   3   0   4   5   1   8
value      10   22    7   3   0   4   5   1   8
weight      7    3    1   7   3   1   7   3   1
product    70   66    7  21   0   4  35   3   8

sum = 214        214 modulo 10 = 4        the zone prints 4
```

Which characters each digit covers differs by format, and getting that range
wrong is the usual cause of a disagreement. Suspect the composite digit first.
It skips the nationality and the sex on a TD3 zone, and covers two lines on a
TD1 one.

## Check a zone without writing any code

Paste the zone into the free MRZ checker at
<https://doc.cheap/mrz-checker>. It runs every digit of the format it detects
and shows each one computed beside the one the zone prints.

It needs no account and no key, and it is the fastest way to settle a
disagreement between two implementations.

## Compare the zone with the printed page

A check digit proves the zone is internally consistent. It does not prove the
zone agrees with the rest of the document.

The verdict covers both. A `failed` status can name a cross-zone disagreement
even when every digit checked out, and the sentence then says which field
disagreed.

Both zones are read on a document that carries both, and each value appears as
its own reading in `fields`. A disagreement is visible there as two entries
under one `name` with different values.

Treat the two clauses differently. A digit failure points at the reading; a
cross-zone mismatch points at the document.

## Handle a document with no zone

`mrz.status: absent` means the document carries no machine-readable zone, or
none was read. `reason`, `lines` and `text` are all null.

A driving licence is the common case, and the front of an identity card is the
other. Neither is a failure.

Such a document offers nothing to re-check. The values come from the printed
page, and what backs them is the per-field confidence rather than a check
digit.

## Decide what a failure means

`mrz.reason` is assembled from two clauses, and they say different things.

| Reason names | What it points at |
|---|---|
| `Check digit failed for: document number` | One field of the zone did not check out |
| `MRZ check digits did not validate` | The zone failed as a whole and no single field could be blamed |
| `MRZ does not match the visual zone for: surname` | The zone and the printed page disagree |

The second sentence is worth recognizing exactly. It appears when the aggregate
verdict is a failure but no individual field was marked invalid, so there is
nothing more specific to name.

A failure is not by itself a verdict on the document. Three ordinary causes
come first.

- **A poor photograph.** A glare across one character changes a value and
  breaks the digit it feeds. Re-photograph and scan again.
- **A damaged document.** A worn or creased zone reads wrong in the same way.
- **A transcription somewhere upstream.** A zone that was retyped by a person
  at any point is a zone that no longer checks out.

A cross-zone mismatch is the one worth escalating. The zone and the printed
page were produced together, and a document where they disagree is one for a
person to look at.

## Next

- [MRZ reference](/reference/mrz) — the three formats, the fields each one
  fills and the shape of every verdict.
- [The MRZ and the visual zone](/concepts/mrz-and-the-visual-zone) — why a
  document says the same thing twice.
- [Recognize an ID card](/guides/recognize-an-id-card) — reading the zone off
  the back of a card.
