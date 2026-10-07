/**
 * Entry codes look like `EE-7K2M-Q9XD`.
 *
 * The alphabet leaves out characters that are easy to confuse when read aloud
 * or typed by hand (0/O, 1/I/L), which keeps manual check-in fast and accurate.
 * 31^8 ≈ 8.5 × 10^11 possible codes — collisions are practically impossible and
 * are still guarded by a unique index + retry on the server.
 */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_PREFIX = "EE";
const BODY_LENGTH = 8;
const GROUP = 4;

const ALPHABET_SET = new Set(CODE_ALPHABET);

function randomBody(): string {
  const out: string[] = [];
  // Rejection sampling keeps every character equally likely.
  const limit = 256 - (256 % CODE_ALPHABET.length);
  while (out.length < BODY_LENGTH) {
    const bytes = new Uint8Array(BODY_LENGTH * 2);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= limit) continue;
      out.push(CODE_ALPHABET[byte % CODE_ALPHABET.length]);
      if (out.length === BODY_LENGTH) break;
    }
  }
  return out.join("");
}

function format(body: string): string {
  return `${CODE_PREFIX}-${body.slice(0, GROUP)}-${body.slice(GROUP)}`;
}

export function generateEntryCode(): string {
  return format(randomBody());
}

/**
 * Accepts anything a scanner or a human might produce — `ee 7k2m q9xd`,
 * `7K2MQ9XD`, a ticket URL ending in the code — and returns the canonical
 * `EE-XXXX-XXXX` form, or `null` when it can't be a valid code.
 */
export function normalizeEntryCode(input: string): string | null {
  if (!input) return null;
  let raw = input.trim();

  // QR codes from other apps may contain a full ticket URL.
  const fromUrl = raw.match(/tickets\/([^/?#\s]+)/i);
  if (fromUrl) raw = decodeURIComponent(fromUrl[1]);

  let compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (compact.length === BODY_LENGTH + CODE_PREFIX.length && compact.startsWith(CODE_PREFIX)) {
    compact = compact.slice(CODE_PREFIX.length);
  }
  if (compact.length !== BODY_LENGTH) return null;
  for (const ch of compact) {
    if (!ALPHABET_SET.has(ch)) return null;
  }
  return format(compact);
}

/**
 * Formats the code body while the user types, e.g. `7k2mq` → `7K2M-Q`.
 * A pasted full code (`EE-7K2M-Q9XD`) has its prefix stripped.
 */
export function formatPartialCode(input: string): string {
  const upper = input.trim().toUpperCase();
  let compact = upper.replace(/[^A-Z0-9]/g, "");
  const hasPrefix = new RegExp(`^${CODE_PREFIX}[^A-Z0-9]`).test(upper) || compact.length > BODY_LENGTH;
  if (hasPrefix && compact.startsWith(CODE_PREFIX)) compact = compact.slice(CODE_PREFIX.length);
  compact = compact.slice(0, BODY_LENGTH);
  const first = compact.slice(0, GROUP);
  const second = compact.slice(GROUP);
  return second ? `${first}-${second}` : first;
}
