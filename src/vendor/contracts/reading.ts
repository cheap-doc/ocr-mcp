// Vendored from the private monorepo's @doc-cheap/contracts (src/reading.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

import { z } from "zod";

// The recognition READING: the exhaustive view of what the engine read, with
// every zone's value for every field, its check outcome and its probability.
//
// It is not the API's response. The response is the report in ./scan.ts, which
// is built from this. The reading is what the service writes down for a scan
// it retains, and what the report is rebuilt from when that scan is read back,
// so it is a schema — validated on the way into storage and on the way out —
// rather than a shape the code hopes is right.
//
// The request types live here too, because a request is validated against the
// same contract and has nowhere better to be.
//
// Every field is a required key: a value that is not known is null, never an
// absent key. Requests are strict objects so that a misspelled option is
// rejected instead of silently ignored.

export const ScanStatus = z
  .enum(["recognized", "no_document_found", "unreadable", "unsupported_document", "rejected"])
  .meta({
    id: "ScanStatus",
    description: "Outcome of a scan. Exactly these five string values; there are no numeric codes.",
  });
export type ScanStatus = z.infer<typeof ScanStatus>;

const SCAN_ID_DESCRIPTION =
  "Scan identifier: a UUID version 7 (RFC 9562), canonical lower-case " +
  "`8-4-4-4-12`. Its leading 48 bits are the millisecond the scan was made, so " +
  "ids sort in the order the scans happened — but treat the value as opaque: " +
  "nothing else about it is part of the contract.";
const SCAN_ID_EXAMPLE = "01a0af18-cd8d-7a61-9f2d-4c7b8e105da3";

const scanIdPattern = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);

export const ScanId = scanIdPattern.meta({
  id: "ScanId",
  description: SCAN_ID_DESCRIPTION,
  example: SCAN_ID_EXAMPLE,
});
export type ScanId = z.infer<typeof ScanId>;

// The same id as a path parameter, kept inline: a parameter whose schema is a
// $ref is not followed by the contract-test runner.
export const ScanIdParam = scanIdPattern.meta({
  description: SCAN_ID_DESCRIPTION,
  example: SCAN_ID_EXAMPLE,
});

const CountryCode = z
  .string()
  .regex(/^[A-Z]{3}$/)
  .meta({ description: "ISO 3166-1 alpha-3 country code.", example: "GRC" });

const IsoDate = z.iso.date().meta({ description: "Calendar date, ISO-8601 (`YYYY-MM-DD`)." });
const IsoDateTime = z.iso
  .datetime()
  .meta({ description: "Timestamp, ISO-8601 in UTC (`YYYY-MM-DDTHH:MM:SSZ`)." });

const DataImageUrl = z
  .string()
  .regex(/^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/)
  .meta({ description: "Image as a `data:` URL with base64 payload." });

export const ScanOptions = z
  .strictObject({
    mode: z.enum(["full"]).default("full").meta({
      description: "Recognition mode. Only `full` exists so far.",
    }),
    expect_country: CountryCode.nullable().default(null).meta({
      description: "Country the caller expects the document to be from, or null for any.",
    }),
    date_format: z.enum(["iso"]).default("iso").meta({
      description: "Format of dates in the response. Only `iso` exists so far.",
    }),
    return_portrait: z.boolean().default(true).meta({
      description: "Whether to return the holder's photograph crop in `images.main_photo`.",
    }),
    retain_hours: z
      .number()
      .int()
      .min(0)
      .max(8760)
      .nullable()
      .default(null)
      .meta({
        description:
          "How many hours the result stays readable through `GET /v1/scans/{id}`. " +
          "`0` is zero retention: nothing is written down. Omit it, or send `null`, to use the " +
          "account's own history-retention setting instead; an explicit value always wins over " +
          "the setting. The maximum is 8760 hours (one year).",
      }),
  })
  .meta({ id: "ScanOptions" });
export type ScanOptions = z.infer<typeof ScanOptions>;
export type ScanOptionsInput = z.input<typeof ScanOptions>;

// Untyped on purpose: the schema below embeds it as its documented example,
// so typing it from the schema would be circular.
const scanRequestExampleValue = {
  image:
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==",
  options: {
    mode: "full",
    expect_country: null,
    date_format: "iso",
    return_portrait: true,
    retain_hours: 0,
  },
  reference: "order-1042",
} as const;

export const ScanRequest = z
  .strictObject({
    image: z.base64().min(1).meta({
      description: "The document image, base64-encoded (JPEG or PNG).",
    }),
    options: ScanOptions.prefault({}),
    reference: z.string().min(1).max(128).nullable().default(null).meta({
      description: "Caller's own correlation string, echoed back in the response.",
      example: "order-1042",
    }),
  })
  .meta({ id: "ScanRequest", examples: [scanRequestExampleValue] });
export type ScanRequest = z.infer<typeof ScanRequest>;
export type ScanRequestInput = z.input<typeof ScanRequest>;

export const scanRequestExample: ScanRequestInput = scanRequestExampleValue;

export const ReadingDocument = z
  .object({
    kind: z.string().min(1).meta({ description: "Document type, e.g. `passport`." }),
    country: CountryCode.nullable(),
    country_name: z.string().nullable().meta({ example: "Greece" }),
    issuing_state: CountryCode.nullable(),
  })
  .meta({ id: "ReadingDocument" });
export type ReadingDocument = z.infer<typeof ReadingDocument>;

export const ReadingHolder = z
  .object({
    given_names: z.string().nullable(),
    surname: z.string().nullable(),
    full_name: z.string().nullable(),
    birth_date: IsoDate.nullable(),
    sex: z.enum(["M", "F", "X"]).nullable(),
    nationality: CountryCode.nullable(),
  })
  .meta({ id: "ReadingHolder" });
export type ReadingHolder = z.infer<typeof ReadingHolder>;

export const ReadingIdentifiers = z
  .object({
    number: z.string().nullable().meta({ description: "Document number." }),
    personal_number: z.string().nullable(),
  })
  .meta({ id: "ReadingIdentifiers" });
export type ReadingIdentifiers = z.infer<typeof ReadingIdentifiers>;

export const ReadingValidity = z
  .object({
    issued_on: IsoDate.nullable(),
    expires_on: IsoDate.nullable(),
    is_expired: z.boolean().nullable(),
    days_remaining: z.number().int().nullable().meta({
      description: "Days until expiry at the time of the scan; negative once expired.",
    }),
  })
  .meta({ id: "ReadingValidity" });
export type ReadingValidity = z.infer<typeof ReadingValidity>;

export const ReadingSources = z
  .object({
    mrz: z.object({
      present: z.boolean(),
      checksums_valid: z.boolean().nullable().meta({
        description: "Null when no MRZ is present.",
      }),
    }),
    visual: z.object({ present: z.boolean() }),
    barcode: z.object({ present: z.boolean() }),
  })
  .meta({
    id: "ReadingSources",
    description: "Which zones of the document the data was read from.",
  });
export type ReadingSources = z.infer<typeof ReadingSources>;

export const ReadingImages = z
  .object({
    portrait: DataImageUrl.nullable(),
    cropped_document: DataImageUrl.nullable(),
  })
  .meta({
    id: "ReadingImages",
    description:
      "Image crops, returned in the recognition response only. The document image itself is " +
      "never stored and neither are these crops, so a scan read back later through " +
      "`GET /v1/scans/{id}` carries `images: null`. A retained scan keeps a micro thumbnail " +
      "(96 px at most) and its outcome fields for the retention window, readable in the " +
      "cabinet rather than through this API. Each crop is scaled down by height, " +
      "proportionally and never upwards, to at most 250 px for `cropped_document` and " +
      "100 px for `portrait`, then re-encoded with every metadata block dropped.",
  });
export type ReadingImages = z.infer<typeof ReadingImages>;

// Validity of a single value read from one source. Maps the engine's integer
// check result: 1 -> valid, 0 -> invalid, anything else (including "not
// performed") -> not_checked.
export const FieldValidity = z.enum(["valid", "invalid", "not_checked"]).meta({
  id: "FieldValidity",
  description:
    "Validity of one source's value: `valid` (check passed, e.g. an MRZ check digit), " +
    "`invalid` (check failed), or `not_checked` (no check applies).",
});
export type FieldValidity = z.infer<typeof FieldValidity>;

// Whether the sources that carry a field agree. Maps the engine's integer
// comparison result: 1 -> match, 0 -> mismatch, anything else (a single source,
// so nothing to compare) -> not_checked.
export const FieldComparison = z.enum(["match", "mismatch", "not_checked"]).meta({
  id: "FieldComparison",
  description:
    "Cross-source agreement for a field: `match` (every source that carries it agrees), " +
    "`mismatch` (they disagree — inspect the values), or `not_checked` (only one source).",
});
export type FieldComparison = z.infer<typeof FieldComparison>;

// One value of a field as read from one source (MRZ, VISUAL, BARCODE, …). Every
// source the engine read is surfaced, not just the merged best value.
export const FieldValue = z
  .object({
    source: z.string().min(1).meta({
      description: "Zone the value was read from, e.g. `MRZ`, `VISUAL` or `BARCODE`.",
      example: "MRZ",
    }),
    value: z.string().meta({ description: "The value as read from this source, normalised." }),
    original_value: z
      .string()
      .nullable()
      .meta({
        description:
          "The value in its own script/form before transliteration or normalisation " +
          "(e.g. a Cyrillic or Arabic spelling, or the raw MRZ date), or null when the " +
          "engine reported none.",
      }),
    valid: FieldValidity,
    confidence: z.number().min(0).max(100).nullable().meta({
      description: "Recognition probability for this source's value, 0–100, or null.",
    }),
    page: z.number().int().min(0).meta({
      description: "Zero-based index of the document page the value was read from.",
    }),
  })
  .meta({ id: "FieldValue" });
export type FieldValue = z.infer<typeof FieldValue>;

// One extracted field, with every per-source value the engine produced. This is
// the exhaustive view; the curated `holder`/`document`/`identifiers`/`validity`
// blocks above are the convenience subset of the same data.
export const ExtractedField = z
  .object({
    type: z.number().int().meta({
      description: "Stable engine field-type code (e.g. 8 = surname, 2 = document number).",
      example: 8,
    }),
    name: z.string().meta({ description: "Human-readable field name.", example: "Surname" }),
    lcid: z
      .number()
      .int()
      .meta({
        description:
          "Language/script identifier of the field: 0 is neutral/Latin; a non-zero value " +
          "marks a national-script or language variant (e.g. Cyrillic, Arabic, Greek).",
      }),
    value: z.string().nullable().meta({
      description: "The merged best value across sources, or null when the field is empty.",
    }),
    comparison_status: FieldComparison,
    values: z.array(FieldValue).meta({
      description: "One entry per source the field was read from.",
    }),
  })
  .meta({ id: "ExtractedField" });
export type ExtractedField = z.infer<typeof ExtractedField>;

// How long the request took, split into the two things a caller can act on.
//
// One number could not say which of them to work on: transfer and decoding of a
// multi-megabyte upload is the caller's own network and image size, while the
// recognition itself is ours. A caller watching a slow integration needs to
// know which half to attack, and a caller comparing regions needs the half that
// does not depend on where they are.
export const ScanTiming = z
  .object({
    upload_ms: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "From the request's headers reaching the server to its body being received " +
          "and validated, with your key resolved and its rate limit checked. The " +
          "allowance, idempotency and credit gates are claimed after this number is " +
          "taken, so they are not in it. Dominated by your own connection and by how " +
          "large the image is — this is the half you can shrink, by sending a smaller " +
          "picture from closer by.",
      }),
    processing_ms: z.number().int().min(0).meta({
      description: "The recognition itself — the server-side engine call.",
    }),
    total_ms: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "From the request arriving to the result being complete. At least " +
          "`upload_ms + processing_ms`; the remainder is the gates that run after " +
          "`upload_ms` is taken — the allowance, the idempotency check and the credit " +
          "hold — plus preparing the result images and mapping the engine's output " +
          "into this body. It stops there: writing the history row and serializing the " +
          "response happen after the number is fixed, so the same figure is stored and " +
          "returned.",
      }),
  })
  .meta({
    id: "ScanTiming",
    description:
      "The split of the request's time. Null on a scan made before the split existed and " +
      "read back out of storage: only the engine call was timed then, and the two halves " +
      "cannot be recovered from it.",
  });
export type ScanTiming = z.infer<typeof ScanTiming>;

// The machine-readable zone as it is printed, verbatim.
//
// The lines are the one part of a document a caller can re-verify themselves —
// re-run the check digits, feed them to a border-control library, compare them
// against what a chip says — and nothing else in the response can be turned
// back into them. They are reported exactly as read, never reconstructed from
// the parsed fields.
export const ReadingMrz = z
  .object({
    lines: z.array(z.string()).meta({
      description:
        "The zone's lines in order, exactly as read — two for a TD3 passport, " +
        "three for a TD1 card. The zone's alphabet is `A-Z`, `0-9` and the " +
        "filler `<`, so a line carries no whitespace.",
    }),
    text: z.string().meta({
      description:
        "The same lines run together with nothing between them: one unbroken " +
        "string, with no newlines and no spaces.",
    }),
  })
  .meta({
    id: "ReadingMrz",
    description:
      "The machine-readable zone as text. Null when the document carries none, or " +
      "when none was read.",
  });
export type ReadingMrz = z.infer<typeof ReadingMrz>;

export const ReadingWarning = z
  .object({
    code: z.string().min(1).meta({ example: "glare_detected" }),
    field: z.string().nullable().meta({
      description: "Dotted path of the affected response field, or null for the whole scan.",
      example: "images.document",
    }),
    severity: z.enum(["low", "medium", "high"]),
  })
  .meta({ id: "ReadingWarning" });
export type ReadingWarning = z.infer<typeof ReadingWarning>;

export const ScanReading = z
  .object({
    id: ScanId,
    status: ScanStatus,
    billed: z.boolean().meta({ description: "Whether this scan was charged to the balance." }),
    confidence: z.number().min(0).max(1).nullable(),
    duration_ms: z
      .number()
      .int()
      .min(0)
      .meta({
        description:
          "Server-side processing time of the scan in milliseconds — the same number as " +
          "`timing.processing_ms`, kept for callers written against it.",
      }),
    timing: ScanTiming.nullable(),
    document: ReadingDocument.nullable(),
    holder: ReadingHolder.nullable(),
    identifiers: ReadingIdentifiers.nullable(),
    validity: ReadingValidity.nullable(),
    sources: ReadingSources,
    mrz: ReadingMrz.nullable(),
    images: ReadingImages.nullable(),
    warnings: z.array(ReadingWarning),
    fields: z.array(ExtractedField).meta({
      description:
        "Every field the engine extracted, from every source and every script — the " +
        "exhaustive view behind the curated blocks above. Always present; empty when " +
        "nothing was extracted.",
    }),
    reference: z.string().nullable().meta({
      description: "The request's `reference`, echoed back.",
    }),
    created_at: IsoDateTime,
  })
  .meta({ id: "ScanReading" });
export type ScanReading = z.infer<typeof ScanReading>;

// A row of the account's scan history: the fields a list view needs, without
// the heavy per-scan detail (extracted data and image crops). The full result
// is read back one scan at a time through `GET /v1/scans/{id}`.
export const ScanSummary = z
  .object({
    id: ScanId,
    status: ScanStatus,
    billed: z.boolean().meta({ description: "Whether this scan was charged to the balance." }),
    duration_ms: z.number().int().min(0).meta({
      description: "Server-side processing time of the scan in milliseconds.",
    }),
    reference: z.string().nullable().meta({
      description: "The request's `reference`, echoed back.",
    }),
    created_at: IsoDateTime,
  })
  .meta({ id: "ScanSummary" });
export type ScanSummary = z.infer<typeof ScanSummary>;

export const ScanList = z
  .object({
    scans: z.array(ScanSummary).meta({
      description: "The account's scans, most recent first.",
    }),
  })
  .meta({ id: "ScanList" });
export type ScanList = z.infer<typeof ScanList>;
