import { absoluteDocLinks } from "./vendor/contracts/doc-links.ts";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { findPage, uriForPage } from "./resources.ts";

// Ready-made requests a user can pick from the client's prompt menu. Each one
// is a short instruction that drives this server's own tools; none of them
// carries a fact of its own, so what the model ends up saying comes from the
// tool results and the documentation, not from the prompt text.

function userText(text: string): { role: "user"; content: { type: "text"; text: string } } {
  return { role: "user", content: { type: "text", text } };
}

// The addresses a batch was given, in the order given. Prompt arguments are
// plain strings, so a list arrives as one string; spaces, commas and new lines
// all separate entries because that is what a person pastes.
export function splitUrls(value: string): string[] {
  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const imageUrl = z
  .string()
  .min(1)
  .describe("https: address of the document image, on a public internet address.");

export function registerPrompts(server: McpServer, docsDir: string, docsBase: string): void {
  server.registerPrompt(
    "scan_document_to_json",
    {
      title: "Read a document into JSON",
      description:
        "Scan one passport, ID card or driver's licence image by its URL and present the " +
        "printed fields it carries, with the structured JSON underneath.",
      argsSchema: { image_url: imageUrl },
    },
    ({ image_url }) => ({
      messages: [
        userText(
          `Read the document in the image at ${image_url}.\n\n` +
            "Call the scan_document tool with image_url set to that address. Then present " +
            "the result: the document type and issuing country, the holder's name, date of " +
            "birth and nationality, the document number and expiry date, and whether the " +
            "machine-readable zone passed its checks. Quote every value exactly as the tool " +
            "returned it, and show the structured JSON under the summary.\n\n" +
            "If meta.status is anything other than recognized, say what that status means " +
            "(search_docs explains each one) instead of filling in fields.",
        ),
      ],
    }),
  );

  server.registerPrompt(
    "check_document_expiry",
    {
      title: "Check whether a document has expired",
      description:
        "Scan one document image by its URL and report its expiry date, whether it has " +
        "expired as of the scan, and how many days are left.",
      argsSchema: { image_url: imageUrl },
    },
    ({ image_url }) => ({
      messages: [
        userText(
          `Check whether the document in the image at ${image_url} has expired.\n\n` +
            "Call the scan_document tool with image_url set to that address. Report " +
            "document.expiry_date, document.is_expired and document.days_remaining exactly " +
            "as returned — they are worked out on the day of the scan. Say plainly whether " +
            "the document is expired today and how many days it has left, or how long ago it " +
            "expired.\n\n" +
            "If expiry_date is null, say the expiry date could not be read rather than " +
            "assuming one.",
        ),
      ],
    }),
  );

  server.registerPrompt(
    "batch_scan",
    {
      title: "Scan a batch of documents",
      description:
        "Check the balance, then scan several document images one by one and summarise " +
        "what was read and which ones failed.",
      argsSchema: {
        image_urls: z
          .string()
          .min(1)
          .describe(
            "The document image addresses (https), separated by spaces, commas or new lines.",
          ),
      },
    },
    ({ image_urls }) => {
      const urls = splitUrls(image_urls);
      return {
        messages: [
          userText(
            `Scan these ${urls.length} document image(s):\n` +
              urls.map((url, index) => `${index + 1}. ${url}`).join("\n") +
              "\n\n" +
              "First call check_balance and tell me how many credits are available; it also " +
              "says when the public sandbox key is in use. Then call scan_document once per " +
              "address, one at a time, each with its own idempotency_key so that a retry " +
              "never charges twice.\n\n" +
              "Afterwards give one table — address, status, document type, document number, " +
              "billed — and then list every address that failed or was not recognised, with " +
              "the reason the tool gave.",
          ),
        ],
      };
    },
  );

  server.registerPrompt(
    "explain_error",
    {
      title: "Explain an API error code",
      description:
        "Explain what a doc.cheap API error code means, whether retrying helps, and what " +
        "to change — from the documentation page for that code.",
      argsSchema: {
        error_code: z
          .string()
          .min(1)
          .describe("The error.code value from the API response, e.g. insufficient_credits."),
      },
    },
    async ({ error_code }) => {
      const code = error_code.trim();
      const ask = userText(
        `Explain the doc.cheap API error \`${code}\`: what raises it, whether retrying ` +
          "helps, and what to change so the next call succeeds. Keep to what the " +
          "documentation says.",
      );
      const page = /^[a-z_]+$/.test(code) ? await findPage(docsDir, `errors/${code}`) : undefined;
      if (!page) {
        return {
          messages: [
            ask,
            userText(
              `There is no documentation page for \`${code}\` in this server's copy. Call ` +
                "search_docs with that code to find where it is described; if nothing " +
                "matches, say it is not a documented error code.",
            ),
          ],
        };
      }
      return {
        messages: [
          ask,
          {
            role: "user",
            content: {
              type: "resource",
              resource: {
                uri: uriForPage(page.slug),
                mimeType: "text/markdown",
                // Full addresses, for the reason given in resources.ts.
                text: absoluteDocLinks(page.markdown, docsBase),
              },
            },
          },
        ],
      };
    },
  );
}
