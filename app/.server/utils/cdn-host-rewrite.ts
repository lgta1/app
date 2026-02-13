import { getLegacyCdnHosts } from "~/.server/utils/cdn-url";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeBase = (base: string): string => String(base || "").trim().replace(/\/+$/g, "");

const getKnownCdnHosts = (): string[] => {
  const fixed = ["cdn.vinahentai.online", "cdn.vinahentai.one"];
  const legacy = getLegacyCdnHosts();
  const fromEnv = (() => {
    const raw = (process.env.CDN_BASE ?? "").trim();
    if (!raw) return [];
    try {
      return [new URL(raw).hostname];
    } catch {
      return [];
    }
  })();

  return Array.from(new Set([...fixed, ...legacy, ...fromEnv]))
    .map((h) => String(h || "").trim())
    .filter(Boolean);
};

const getCarryLength = (bases: string[]): number => {
  const maxLen = bases.reduce((m, h) => Math.max(m, h.length), 0);
  return Math.max(0, maxLen - 1);
};

export const rewriteCdnHostsInText = (text: string, targetCdnBase: string): string => {
  const input = String(text || "");
  if (!input) return input;

  const base = normalizeBase(targetCdnBase);
  if (!base) return input;

  let out = input;

  // IMPORTANT: Do NOT blindly replace `//cdn.host` because it appears inside
  // absolute URLs as the substring in `https://cdn.host` (after the `:`).
  // Replacing that would produce `https:https://...`.
  for (const host of getKnownCdnHosts()) {
    const escapedHost = escapeRegExp(host);
    out = out.replaceAll(`https://${host}`, base);
    out = out.replaceAll(`http://${host}`, base);

    // Rewrite true protocol-relative URLs only when `//host` is NOT preceded by `:`.
    const protoRelative = new RegExp(`(^|[^:])\\/\\/${escapedHost}`, "gi");
    out = out.replace(protoRelative, `$1${base}`);
  }

  return out;
};

export const rewriteCdnHostsDeepInPlace = <T>(value: T, targetCdnBase: string): T => {
  if (!value) return value;
  const base = normalizeBase(targetCdnBase);
  if (!base) return value;

  const seen = new Set<unknown>();

  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return rewriteCdnHostsInText(v, base);
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

export const rewriteCdnHostsInStream = (
  input: ReadableStream<Uint8Array> | undefined,
  targetCdnBase: string,
): ReadableStream<Uint8Array> | undefined => {
  if (!input) return input;
  const base = normalizeBase(targetCdnBase);
  if (!base) return input;

  const knownBasesForCarry = (() => {
    const hosts = getKnownCdnHosts();
    const bases: string[] = [];
    for (const host of hosts) bases.push(`https://${host}`, `http://${host}`, `//${host}`);
    return bases;
  })();
  if (!knownBasesForCarry.length) return input;

  const carryLen = getCarryLength(knownBasesForCarry);
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = input.getReader();
  let carry = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await reader.read();
      if (done) {
        if (carry) {
          controller.enqueue(encoder.encode(rewriteCdnHostsInText(carry, base)));
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

      const rewritten = rewriteCdnHostsInText(emitPart, base);
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
