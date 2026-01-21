import { DEFAULT_CDN_BASE } from "~/constants/cdn";

const splitCsv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const stripWww = (hostname: string): string => hostname.replace(/^www\./i, "");

const getForwardedHost = (request: Request): string | undefined => {
  const forwarded = (request.headers.get("x-forwarded-host") ?? "").trim();
  const hostHeader = (request.headers.get("host") ?? "").trim();
  const host = (forwarded || hostHeader).split(",")[0]?.trim();
  if (!host) return undefined;
  return host.replace(/:\d+$/, "");
};

const getCdnBaseForSiteHost = (hostname: string | undefined): string | undefined => {
  const host = stripWww((hostname ?? "").trim().toLowerCase());
  if (!host) return undefined;
  // Serve parallel domains with matching CDN subdomain.
  if (host === "vinahentai.fun" || host === "vinahentai.one") return `https://cdn.${host}`;
  return undefined;
};

export const getCdnBase = (request?: Request): string => {
  // Prefer deriving from the incoming host so backup domains don't accidentally
  // keep pointing at the primary CDN hostname.
  if (request) {
    const host = getForwardedHost(request);
    const derived = getCdnBaseForSiteHost(host);
    if (derived) return derived;
  }

  const fromEnv = (process.env.CDN_BASE ?? "").trim();
  if (fromEnv) return fromEnv;

  return DEFAULT_CDN_BASE;
};

const normalizeBase = (base: string): string => base.replace(/\/+$/g, "");

export const getLegacyCdnHosts = (): string[] => {
  // For future migrations, add the old CDN host(s) here, e.g.
  // LEGACY_CDN_HOSTS=cdn.vinahentai.com,cdn.vinahentai.xyz
  return splitCsv(process.env.LEGACY_CDN_HOSTS).length
    ? splitCsv(process.env.LEGACY_CDN_HOSTS)
    : [
        "cdn.vinahentai.top",
        "cdn.vinahentai.xyz",
        "cdn.vinahentai.com",
        "cdn.hoangsatruongsalacuavietnam.site",
      ];
};

const getLegacyCdnBases = (): string[] => {
  const hosts = getLegacyCdnHosts();
  const bases: string[] = [];
  for (const host of hosts) {
    bases.push(`https://${host}`, `http://${host}`, `//${host}`);
  }
  return bases;
};

export const isLegacyCdnUrl = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;

  for (const base of getLegacyCdnBases()) {
    if (text.startsWith(base)) return true;
  }

  try {
    const url = new URL(text);
    return getLegacyCdnHosts().some((h) => h.toLowerCase() === url.hostname.toLowerCase());
  } catch {
    return false;
  }
};

export const getLegacyCdnHostRegex = (): RegExp => {
  const escaped = getLegacyCdnHosts().map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(escaped.join("|"), "i");
};

/**
 * Rewrites legacy absolute URLs that point at one of LEGACY_CDN_HOSTS to the current CDN base.
 * Leaves other URLs unchanged.
 */
export const rewriteLegacyCdnUrl = (value: string, cdnBase: string = getCdnBase()): string => {
  if (!value) return value;
  const input = String(value).trim();
  if (!input) return value;

  const base = normalizeBase(cdnBase);

  // Fast-paths (avoid URL parsing)
  for (const legacyBase of getLegacyCdnBases()) {
    if (input.startsWith(legacyBase)) {
      return `${base}${input.slice(legacyBase.length)}`;
    }
  }

  // More general path (preserve query/hash if present)
  try {
    const url = new URL(input);
    const isLegacy = getLegacyCdnHosts().some((h) => h.toLowerCase() === url.hostname.toLowerCase());
    if (isLegacy) {
      return `${base}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    // ignore invalid absolute URLs
  }

  return value;
};

/**
 * Rewrites any occurrences of legacy CDN base URLs inside free-form text.
 * Useful for user content that may contain pasted media links.
 */
export const rewriteLegacyCdnUrlsInText = (text: string, cdnBase: string = getCdnBase()): string => {
  if (!text) return text;
  const base = normalizeBase(cdnBase);
  let out = String(text);
  for (const legacyBase of getLegacyCdnBases()) {
    out = out.replaceAll(legacyBase, base);
  }
  return out;
};
