// Vendored from the private monorepo's @doc-cheap/contracts (src/image-format.ts).
// Copied by scripts/sync-mcp-mirror.mjs because that package is not published;
// edit it there, not here.

// The image formats the scan endpoint reads, told apart by their first bytes.
//
// The request schema can only say that `image` is base64; it cannot say that
// the bytes inside are a picture. Bytes that are not one used to travel all the
// way to the recognition engine, whose refusal surfaced as a server failure —
// a 500 for what is the caller's mistake. Checking the signature first turns it
// into the refusal the caller can act on, before any allowance or credit is
// touched. The API and the MCP server both check with this one function, so
// the two cannot disagree about what counts as an image.
//
// Only the header is inspected. A file that starts like a JPEG or a PNG and is
// damaged further in still goes to recognition, which answers what it can read.

export type ImageFormat = "jpeg" | "png";

/** The formats named in every refusal, in the order the documentation lists them. */
export const SUPPORTED_IMAGE_FORMATS = "JPEG or PNG";

// JPEG: the start-of-image marker FF D8, followed by the FF that opens the next
// marker segment. Three bytes are the shortest prefix every JPEG shares.
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff] as const;

// PNG: the fixed eight-byte signature, then the first chunk, which the format
// requires to be IHDR — its four-byte length, then the type at offset 12.
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const PNG_IHDR = [0x49, 0x48, 0x44, 0x52] as const;
const PNG_IHDR_OFFSET = 12;

/**
 * How many leading bytes `detectImageFormat` reads. A caller holding base64
 * can decode just this much rather than the whole image.
 */
export const IMAGE_SIGNATURE_BYTES = PNG_IHDR_OFFSET + PNG_IHDR.length;

function startsWith(bytes: Uint8Array, expected: readonly number[], offset = 0): boolean {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, index) => bytes[offset + index] === byte);
}

/** The format of an image from its leading bytes, or null when it is neither. */
export function detectImageFormat(bytes: Uint8Array): ImageFormat | null {
  if (startsWith(bytes, JPEG_SIGNATURE)) return "jpeg";
  if (startsWith(bytes, PNG_SIGNATURE) && startsWith(bytes, PNG_IHDR, PNG_IHDR_OFFSET)) {
    return "png";
  }
  return null;
}
