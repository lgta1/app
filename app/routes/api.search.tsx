import type { Route } from "./+types/api.search";

import { smartSearch } from "~/services/search/smart-search.server";
import {
  DEFAULT_SCOPE,
  SEARCH_SCOPES,
  type SearchScope,
} from "~/utils/text-normalize";

const MAX_LIMIT = 20;
const MIN_LIMIT = 5;

function parseScope(raw: string | null): SearchScope {
  if (!raw) return DEFAULT_SCOPE;
  if (SEARCH_SCOPES.includes(raw as SearchScope)) {
    return raw as SearchScope;
  }
  return DEFAULT_SCOPE;
}

export async function loader({ request }: Route.LoaderArgs) {
  const { sharedTtlCache } = await import("~/.server/utils/ttl-cache");

  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  const scope = parseScope(url.searchParams.get("scope"));
  const limitParam = Number(url.searchParams.get("limit") || "10");
  const offsetParam = Number(url.searchParams.get("offset") || "0");
  const limit = Number.isFinite(limitParam) ? Math.min(MAX_LIMIT, Math.max(MIN_LIMIT, limitParam)) : 10;
  const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `api.search:q=${encodeURIComponent(normalizedQuery)}:scope=${scope}:limit=${limit}:offset=${offset}`;

  return sharedTtlCache.getOrSet(cacheKey, 10_000, () =>
    smartSearch({ query: normalizedQuery, scope, limit, offset })
  );
}
