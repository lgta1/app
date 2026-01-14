const splitCsv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const stripWww = (hostname: string): string => hostname.replace(/^www\./i, "");

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getForwardedHost = (request: Request): string | undefined => {
  const forwarded = (request.headers.get("x-forwarded-host") || "").trim();
  const hostHeader = (request.headers.get("host") || "").trim();
  const host = (forwarded || hostHeader).split(",")[0]?.trim();
  if (!host) return undefined;
  return host.replace(/:\d+$/, "");
};

export const getCanonicalHostname = (request?: Request): string | undefined => {
  const origin = (process.env.CANONICAL_ORIGIN || process.env.VITE_CANONICAL_ORIGIN || "").trim();
  if (origin) {
    try {
      return stripWww(new URL(origin).hostname);
    } catch {
      // ignore invalid origin
    }
  }

  if (!request) return undefined;
  const host = getForwardedHost(request);
  if (!host) return undefined;
  return stripWww(host);
};

export const getLegacySiteHosts = (): string[] => {
  // For future migrations, add old site host(s) here, e.g.
  // LEGACY_SITE_HOSTS=vinahentai.com,www.vinahentai.com
  const fromEnv = splitCsv(process.env.LEGACY_SITE_HOSTS);
  return fromEnv.length
    ? fromEnv
    : ["vinahentai.xyz", "www.vinahentai.xyz", "vinahentai.com", "www.vinahentai.com"];
};

const getLegacySiteHostRegex = (legacyHosts: string[]): RegExp | undefined => {
  const escaped = legacyHosts.map(escapeRegExp).filter(Boolean);
  if (!escaped.length) return undefined;
  return new RegExp(escaped.join("|"), "gi");
};

/**
 * Rewrites legacy hostnames ONLY when they appear as part of a URL.
 * This intentionally does NOT rewrite plain-text mentions like "vinahentai.com" in story content/comments.
 */
const rewriteText = (text: string, canonicalHostname: string, legacyHosts: string[], re?: RegExp): string => {
  if (!text) return text;
  if (!canonicalHostname) return text;
  if (!legacyHosts.length) return text;

  const hostRegex = re ?? getLegacySiteHostRegex(legacyHosts);
  if (!hostRegex) return text;

  // Defensive: avoid any RegExp state (e.g. `lastIndex`) leaking across calls.
  const hostSource = new RegExp(hostRegex.source, hostRegex.flags).source;

  // Only rewrite when legacy host is the host part of a URL.
  // Matches: https://vinahentai.com, http://www.vinahentai.com, //vinahentai.com
  const urlHostRegex = new RegExp(`((?:https?:)?\\/\\/)(?:${hostSource})`, "gi");
  return text.replace(urlHostRegex, `$1${canonicalHostname}`);
};

const getCarryLength = (legacyHosts: string[]): number => {
  const maxLen = legacyHosts.reduce((m, h) => Math.max(m, h.length), 0);
  return Math.max(0, maxLen - 1);
};

/**
 * Wraps a ReadableStream and rewrites legacy site host strings across chunk boundaries.
 * This is required for React Router's `serverHandoffStream` streaming payload.
 */
export const rewriteLegacySiteHostsInStream = (
  input: ReadableStream<Uint8Array> | undefined,
  canonicalHostname: string | undefined,
): ReadableStream<Uint8Array> | undefined => {
  if (!input || !canonicalHostname) return input;

  const legacyHosts = getLegacySiteHosts()
    .map((h) => h.trim())
    .filter(Boolean)
    .filter((h) => h.toLowerCase() !== canonicalHostname.toLowerCase());

  const re = getLegacySiteHostRegex(legacyHosts);
  if (!re) return input;

  const carryLen = getCarryLength(legacyHosts);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = input.getReader();
  let carry = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (carry) {
          controller.enqueue(encoder.encode(rewriteText(carry, canonicalHostname, legacyHosts, re)));
          carry = "";
        }
        controller.close();
        return;
      }

      const chunkText = decoder.decode(value, { stream: true });
      const combined = carry + chunkText;

      if (carryLen === 0 || combined.length <= carryLen) {
        carry = combined;
        return;
      }

      const emitPart = combined.slice(0, -carryLen);
      carry = combined.slice(-carryLen);

      const rewritten = rewriteText(emitPart, canonicalHostname, legacyHosts, re);
      if (rewritten) controller.enqueue(encoder.encode(rewritten));
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } catch {
        // ignore
      }
    },
  });
};

/**
 * In-place rewrite of any string values inside a JSON-like structure.
 * Intended for loader/action/error payloads that will be serialized into HTML.
 */
export const rewriteLegacySiteHostsDeepInPlace = <T>(
  value: T,
  canonicalHostname: string | undefined,
): T => {
  if (!canonicalHostname) return value;

  const legacyHosts = getLegacySiteHosts()
    .map((h) => h.trim())
    .filter(Boolean)
    .filter((h) => h.toLowerCase() !== canonicalHostname.toLowerCase());

  const re = getLegacySiteHostRegex(legacyHosts);
  if (!re) return value;

  const seen = new Set<unknown>();

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return rewriteText(v, canonicalHostname, legacyHosts, re);
    if (!v || typeof v !== "object") return v;
    if (seen.has(v)) return v;
    seen.add(v);

    if (Array.isArray(v)) {
      for (let i = 0; i < v.length; i++) v[i] = walk(v[i]);
      return v;
    }

    const obj = v as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      obj[key] = walk(obj[key]);
    }
    return obj;
  };

  walk(value);
  return value;
};
