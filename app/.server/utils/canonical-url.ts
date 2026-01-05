const DEFAULT_CANONICAL_ORIGIN = "https://vinahentai.xyz";

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

export function getCanonicalOrigin(_request?: Request): string {
  // Prefer explicit env configuration.
  // If missing, derive from the request (including forwarded headers) so a domain switch
  // doesn't silently keep returning an old hardcoded fallback.
  const envOrigin = normalizeOrigin(process.env.CANONICAL_ORIGIN);
  if (envOrigin) return envOrigin;

  try {
    if (_request) {
      return getRequestOrigin(_request) ?? new URL(_request.url).origin;
    }
  } catch {}

  return DEFAULT_CANONICAL_ORIGIN;
}
