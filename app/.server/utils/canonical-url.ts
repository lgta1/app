const DEFAULT_CANONICAL_ORIGIN = "https://vinahentai.online";

const stripWww = (hostname: string): string => hostname.replace(/^www\./i, "");

const isParallelApexHost = (hostname: string | undefined): boolean => {
  const host = stripWww(String(hostname ?? "").trim().toLowerCase());
  return host === "vinahentai.online" || host === "vinahentai.one";
};

const TRACKING_QUERY_KEYS = new Set([
  "fbclid",
  "gclid",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "utm_name",
  "utm_reader",
  "utm_referrer",
  "utm_creative_format",
  "utm_marketing_tactic",
]);

function getRequestOrigin(request: Request): string | undefined {
  try {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "";
    const proto = forwardedProto.split(",")[0].trim() || "https";
    const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
    const host = forwardedHost.split(",")[0].trim();
    if (!host) return undefined;
    return new URL(`${proto}://${host}`).origin;
  } catch {
    return undefined;
  }
}

function getKnownSiteCanonicalOriginForHost(hostname: string | undefined): string | undefined {
  const host = (hostname ?? "").trim().toLowerCase();
  if (!host) return undefined;

  // Map legacy hosts to the current canonical origin.
  if (host === "vinahentai.top" || host === "www.vinahentai.top") return DEFAULT_CANONICAL_ORIGIN;
  if (host === "vinahentai.xyz" || host === "www.vinahentai.xyz") return DEFAULT_CANONICAL_ORIGIN;
  if (host === "vinahentai.com" || host === "www.vinahentai.com") return DEFAULT_CANONICAL_ORIGIN;
  if (host === "vinahentai.fun" || host === "www.vinahentai.fun") return DEFAULT_CANONICAL_ORIGIN;

  return undefined;
}

function normalizePathname(pathname: string): string {
  const raw = pathname || "/";
  const collapsed = raw.replace(/\/+/g, "/");
  const trimmed = collapsed.replace(/\/+$/g, "");
  return trimmed || "/";
}

function stripTrackingParams(search: string): string {
  if (!search) return "";
  const params = new URLSearchParams(search);
  for (const key of Array.from(params.keys())) {
    const k = key.toLowerCase();
    if (k.startsWith("utm_") || TRACKING_QUERY_KEYS.has(k)) params.delete(key);
  }

  // Stable ordering helps avoid duplicates due to param order.
  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const next = new URLSearchParams(entries);
  const nextStr = next.toString();
  return nextStr ? `?${nextStr}` : "";
}

function normalizeOrigin(input: string | undefined): string | undefined {
  const raw = (input ?? "").trim();
  if (!raw) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

export const CANONICAL_ORIGIN =
  normalizeOrigin(process.env.CANONICAL_ORIGIN) ?? DEFAULT_CANONICAL_ORIGIN;

export function getEffectiveRequestUrl(request: Request): URL {
  const incoming = new URL(request.url);

  const forwardedProto = request.headers.get("x-forwarded-proto") ?? "";
  const proto = forwardedProto.split(",")[0].trim() || incoming.protocol.replace(/:$/, "") || "https";

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  const host = forwardedHost.split(",")[0].trim() || incoming.host;

  return new URL(`${proto}://${host}${incoming.pathname}${incoming.search}`);
}

export function getCanonicalUrl(request: Request): string {
  const effective = getEffectiveRequestUrl(request);

  const envOrigin = normalizeOrigin(process.env.CANONICAL_ORIGIN);
  const knownCanonical = getKnownSiteCanonicalOriginForHost(effective.hostname);

  // If we are serving multiple apex domains in parallel, do NOT force canonical origin
  // to the primary domain via env. That would make the backup domain emit primary-domain
  // canonicals and can cause the UI to generate absolute links to the primary domain.
  const useEnvOrigin = Boolean(envOrigin) && !isParallelApexHost(effective.hostname);
  const canonicalOrigin = (useEnvOrigin ? envOrigin : undefined) ?? knownCanonical ?? effective.origin;
  const canonicalPath = normalizePathname(effective.pathname);
  const canonicalSearch = stripTrackingParams(effective.search);

  return new URL(`${canonicalPath}${canonicalSearch}`, canonicalOrigin).toString();
}

/**
 * Returns a same-host redirect target that only normalizes path/query (and forwarded proto/host),
 * without forcing a different canonical origin. This keeps backup domains usable while still
 * collapsing tracking params / trailing slashes.
 */
export function getRedirectUrl(request: Request): string {
  const effective = getEffectiveRequestUrl(request);
  const knownCanonical = getKnownSiteCanonicalOriginForHost(effective.hostname);

  // Redirect legacy apex domains to the primary canonical origin.
  // This keeps historical domains consolidated and avoids serving duplicate sites.
  // NOTE: vinahentai.one is intentionally NOT mapped here.
  const forcedOrigin = knownCanonical ?? undefined;

  const nextHost = stripWww(effective.host);
  const nextOrigin = forcedOrigin ?? `${effective.protocol}//${nextHost}`;
  const normalizedPath = normalizePathname(effective.pathname);
  const normalizedSearch = stripTrackingParams(effective.search);
  return new URL(`${normalizedPath}${normalizedSearch}`, nextOrigin).toString();
}

export function getCanonicalOrigin(_request?: Request): string {
  // Prefer explicit env configuration.
  // If missing, derive from the request (including forwarded headers) so a domain switch
  // doesn't silently keep returning an old hardcoded fallback.
  const envOrigin = normalizeOrigin(process.env.CANONICAL_ORIGIN);
  if (envOrigin) {
    // Respect env for single-host deployments, but avoid forcing the primary origin
    // when serving parallel apex domains.
    try {
      if (_request) {
        const effective = getEffectiveRequestUrl(_request);
        if (!isParallelApexHost(effective.hostname)) return envOrigin;

        const envHost = stripWww(new URL(envOrigin).hostname);
        const reqHost = stripWww(effective.hostname);
        if (envHost.toLowerCase() === reqHost.toLowerCase()) return envOrigin;
      } else {
        return envOrigin;
      }
    } catch {
      return envOrigin;
    }
  }

  try {
    if (_request) {
      return getRequestOrigin(_request) ?? new URL(_request.url).origin;
    }
  } catch {}

  return DEFAULT_CANONICAL_ORIGIN;
}
