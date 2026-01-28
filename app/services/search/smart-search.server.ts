import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import {
  DEFAULT_SCOPE,
  splitAliases,
  tokenizeText,
  normalizeText,
  type SearchResultScope,
  type SearchScope,
} from "~/utils/text-normalize";

export type SmartSearchHit = {
  id: string;
  slug?: string;
  title: string;
  poster: string;
  genres: string[];
  chapters: number;
  scope: SearchResultScope;
  altTitle?: string;
  highlight?: {
    field: SearchResultScope;
    snippet: string;
  };
};

export type SmartSearchResponse = {
  items: SmartSearchHit[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
  requestedOffset: number;
  scope: SearchScope;
  resolvedQuery: string;
};

export type SmartSearchParams = {
  query: string;
  scope?: SearchScope;
  limit: number;
  offset: number;
};

type FieldConfig = {
  key: SearchResultScope;
  weight: number;
  regexPaths: Array<{ path: keyof MangaType | string; isArray?: boolean }>;
  getValues: (doc: MangaType) => string[];
};

type FieldMatch = {
  key: SearchResultScope;
  score: number;
  tokens: Set<string>;
  snippet?: string;
};

const BASE_FIELD_ORDER: SearchResultScope[] = ["title", "alias", "character", "doujinshi"];
const TEXT_MATCH_LIMIT = 150;
const REGEX_MATCH_LIMIT = 120;
const MAX_REGEX_TOKEN_LENGTH = 3;

const FIELD_CONFIGS: Record<SearchResultScope, FieldConfig> = {
  title: {
    key: "title",
    weight: 5,
    regexPaths: [{ path: "title" }],
    getValues: (doc) => (doc.title ? [doc.title] : []),
  },
  alias: {
    key: "alias",
    weight: 4,
    regexPaths: [{ path: "alternateTitle" }, { path: "keywords" }],
    getValues: (doc) => {
      const values: string[] = [];
      values.push(...splitAliases(doc.alternateTitle));
      if (doc.keywords) {
        values.push(...splitAliases(doc.keywords));
      }
      if (doc.code) {
        values.push(String(doc.code));
      }
      return values;
    },
  },
  character: {
    key: "character",
    weight: 3,
    regexPaths: [{ path: "characterNames", isArray: true }],
    getValues: (doc) => doc.characterNames || [],
  },
  doujinshi: {
    key: "doujinshi",
    weight: 3,
    regexPaths: [
      { path: "doujinshiNames", isArray: true },
      { path: "author" },
      { path: "translatorNames", isArray: true },
      { path: "translationTeam" },
    ],
    getValues: (doc) => {
      const values: string[] = [];
      values.push(...(doc.doujinshiNames || []));
      if (doc.author) values.push(doc.author);
      values.push(...(doc.translatorNames || []));
      if (doc.translationTeam) values.push(doc.translationTeam);
      return values;
    },
  },
};

const NON_WORD = /\s+/g;

export async function smartSearch({ query, scope = DEFAULT_SCOPE, limit, offset }: SmartSearchParams): Promise<SmartSearchResponse> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return emptyResponse(scope);
  }

  const normalizedQuery = normalizeText(cleanedQuery);
  const tokens = tokenizeText(normalizedQuery);
  if (tokens.length === 0) {
    return emptyResponse(scope, cleanedQuery);
  }

  const textMatches = await searchTextMatches(cleanedQuery);
  const regexMatches = await searchRegexMatches(tokens, scope);
  const candidates = mergeCandidates(textMatches, regexMatches);

  if (candidates.length === 0) {
    return emptyResponse(scope);
  }

  const scored = rankCandidates(candidates, tokens, cleanedQuery, scope);
  const total = scored.length;
  const ordered = scored.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
  const paged = ordered.slice(offset, offset + limit);

  const items = paged.map((entry) => ({
    id: entry.id,
    slug: entry.slug,
    title: entry.title,
    poster: entry.poster,
    genres: entry.genres,
    chapters: entry.chapters,
    scope: entry.scope,
    ...(entry.altTitle ? { altTitle: entry.altTitle } : {}),
    ...(entry.highlight ? { highlight: entry.highlight } : {}),
  }));

  return {
    items,
    total,
    hasMore: offset + limit < total,
    nextOffset: Math.min(total, offset + limit),
    requestedOffset: offset,
    scope,
    resolvedQuery: cleanedQuery,
  };
}

function emptyResponse(scope: SearchScope, resolvedQuery: string = ""): SmartSearchResponse {
  return {
    items: [],
    total: 0,
    hasMore: false,
    nextOffset: 0,
    requestedOffset: 0,
    scope,
    resolvedQuery,
  };
}

async function searchTextMatches(query: string) {
  return await MangaModel.find(
    {
      status: MANGA_STATUS.APPROVED,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
      $text: { $search: query },
    },
    { score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .limit(TEXT_MATCH_LIMIT)
    .lean()
    .then((docs) => docs.map((doc: any) => ({ ...doc, __textScore: Number(doc.score ?? 0) })))
    .catch(() => [] as Array<MangaType & { __textScore?: number }>);
}

async function searchRegexMatches(tokens: string[], scope: SearchScope) {
  const fields = resolveFieldKeys(scope);
  const filter = buildRegexFilter(tokens, fields);
  if (!filter.$and || filter.$and.length === 0) {
    return [] as MangaType[];
  }
  return await MangaModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(REGEX_MATCH_LIMIT)
    .lean()
    .catch(() => [] as MangaType[]);
}

function resolveFieldKeys(scope: SearchScope): SearchResultScope[] {
  if (scope === "all") {
    return [...BASE_FIELD_ORDER];
  }
  return [scope];
}

function buildRegexFilter(tokens: string[], fieldKeys: SearchResultScope[]) {
  const filter: Record<string, any> = {
    status: MANGA_STATUS.APPROVED,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  };
  const andConditions: any[] = [];
  const allowedFieldKeys = fieldKeys.filter((key) => key === "title");
  if (allowedFieldKeys.length === 0) {
    return filter;
  }

  tokens.forEach((token) => {
    const regex = buildTokenRegex(token);
    if (!regex) return;
    const fieldConditions: any[] = [];

    allowedFieldKeys.forEach((fieldKey) => {
      const config = FIELD_CONFIGS[fieldKey];
      config.regexPaths.forEach(({ path, isArray }) => {
        if (isArray) {
          fieldConditions.push({ [path]: { $elemMatch: { $regex: regex } } });
        } else {
          fieldConditions.push({ [path]: { $regex: regex } });
        }
      });
      if (fieldKey === "alias" && /^\d+$/.test(token)) {
        fieldConditions.push({ code: Number(token) });
      }
    });

    if (fieldConditions.length > 0) {
      andConditions.push({ $or: fieldConditions });
    }
  });

  if (andConditions.length > 0) {
    filter.$and = andConditions;
  }

  return filter;
}

function buildTokenRegex(token: string) {
  const escaped = escapeRegex(token);
  if (token.length > MAX_REGEX_TOKEN_LENGTH) {
    return null;
  }
  if (token.length <= 2) {
    return new RegExp(escaped, "i");
  }
  const fuzzyPattern = escaped.split("").join(".*?");
  return new RegExp(fuzzyPattern, "i");
}

type CandidateDoc = (MangaType & { __textScore?: number }) | (MangaType & { score?: number });

function mergeCandidates(textMatches: CandidateDoc[], regexMatches: MangaType[]) {
  const map = new Map<string, MangaType & { __textScore?: number }>();
  textMatches.forEach((doc: any) => {
    const id = String(doc?._id ?? doc?.id ?? "");
    if (!id) return;
    map.set(id, { ...(doc as any), __textScore: Number(doc.__textScore ?? doc.score ?? 0) });
  });
  regexMatches.forEach((doc: any) => {
    const id = String(doc?._id ?? doc?.id ?? "");
    if (!id || map.has(id)) return;
    map.set(id, doc as any);
  });
  return Array.from(map.values());
}

type RankedEntry = {
  id: string;
  slug?: string;
  title: string;
  poster: string;
  genres: string[];
  chapters: number;
  score: number;
  scope: SearchResultScope;
  altTitle?: string;
  highlight?: { field: SearchResultScope; snippet: string };
  updatedAt: number;
};

function rankCandidates(
  candidates: Array<MangaType & { __textScore?: number }>,
  tokens: string[],
  query: string,
  scope: SearchScope,
): RankedEntry[] {
  const displayTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  const orderedFields = scope === "all" ? BASE_FIELD_ORDER : [scope, ...BASE_FIELD_ORDER.filter((f) => f !== scope)];

  const results: RankedEntry[] = [];

  for (const doc of candidates) {
    const analysis = analyzeDocument(doc, tokens, displayTokens, orderedFields, scope);
    if (!analysis) continue;

    const popularity = computePopularity(doc);
    const textScore = Number((doc as any).__textScore ?? 0) * 5;
    const totalScore = analysis.totalScore + popularity + textScore;

    const altTitle = deriveAlternateTitle(doc);

    results.push({
      id: String((doc as any)?.id ?? (doc as any)?._id ?? ""),
      slug: doc.slug,
      title: doc.title,
      poster: doc.poster,
      genres: doc.genres || [],
      chapters: doc.chapters || 0,
      scope: analysis.scope,
      ...(altTitle ? { altTitle } : {}),
      ...(analysis.highlight ? { highlight: analysis.highlight } : {}),
      score: totalScore,
      updatedAt: doc.updatedAt ? new Date(doc.updatedAt).getTime() : 0,
    });
  }

  return results;
}

function deriveAlternateTitle(doc: MangaType): string | undefined {
  const candidates = [
    ...splitAliases(doc.alternateTitle),
    ...splitAliases(doc.keywords),
  ]
    .map((alias) => alias.trim())
    .filter(Boolean);

  const normalizedTitle = doc.title?.trim().toLowerCase();

  for (const alias of candidates) {
    if (!alias) continue;
    if (!normalizedTitle || alias.toLowerCase() !== normalizedTitle) {
      return alias;
    }
  }

  return undefined;
}

function analyzeDocument(
  doc: MangaType,
  tokens: string[],
  displayTokens: string[],
  orderedFields: SearchResultScope[],
  scope: SearchScope,
) {
  const matchedTokensGlobal = new Set<string>();
  const fieldMatches: Record<SearchResultScope, FieldMatch> = {
    title: initFieldMatch("title"),
    alias: initFieldMatch("alias"),
    character: initFieldMatch("character"),
    doujinshi: initFieldMatch("doujinshi"),
  };

  BASE_FIELD_ORDER.forEach((fieldKey) => {
    const config = FIELD_CONFIGS[fieldKey];
    const values = config.getValues(doc).filter(Boolean);
    if (values.length === 0) {
      fieldMatches[fieldKey] = initFieldMatch(fieldKey);
      return;
    }

    const matchedTokens = new Set<string>();
    let snippet: string | undefined;
    let fieldScore = 0;

    values.forEach((value) => {
      const normalized = normalizeText(value);
      const compact = normalized.replace(NON_WORD, "");
      const localTokens: string[] = [];

      tokens.forEach((token) => {
        if (!token) return;
        if (normalized.includes(token) || compact.includes(token)) {
          matchedTokens.add(token);
          matchedTokensGlobal.add(token);
          localTokens.push(token);
          fieldScore += config.weight;
          if (normalized.startsWith(token)) {
            fieldScore += 1;
          }
        } else if (token.length >= 3 && hasFuzzyWordMatch(normalized, token)) {
          matchedTokens.add(token);
          matchedTokensGlobal.add(token);
          localTokens.push(token);
          fieldScore += config.weight - 1;
        } else if (config.key === "alias" && /^\d+$/.test(token) && String(doc.code || "").includes(token)) {
          matchedTokens.add(token);
          matchedTokensGlobal.add(token);
          localTokens.push(token);
          fieldScore += config.weight + 2;
        }
      });

      if (localTokens.length > 0 && !snippet) {
        snippet = buildHighlightSnippet(value, displayTokens.length ? displayTokens : localTokens);
      }
    });

    const scopeMultiplier = scope === "all" || scope === fieldKey ? 1 : 0.6;
    fieldMatches[fieldKey] = {
      key: fieldKey,
      tokens: matchedTokens,
      snippet,
      score: fieldScore * scopeMultiplier,
    };
  });

  if (scope !== "all" && fieldMatches[scope]?.tokens.size === 0) {
    return null;
  }

  if (matchedTokensGlobal.size === 0) {
    return null;
  }

  let bestField: SearchResultScope = orderedFields[0] ?? "title";
  let bestSnippet = fieldMatches[bestField].snippet;
  let totalScore = matchedTokensGlobal.size * 10;

  orderedFields.forEach((fieldKey) => {
    totalScore += fieldMatches[fieldKey]?.score ?? 0;
    if (!bestSnippet && fieldMatches[fieldKey]?.snippet) {
      bestField = fieldKey;
      bestSnippet = fieldMatches[fieldKey]?.snippet;
    }
  });

  if (!bestSnippet) {
    const fallbackValues = FIELD_CONFIGS[bestField].getValues(doc);
    bestSnippet = fallbackValues[0] || doc.title;
  }

  const highlight = bestSnippet
    ? {
        field: bestField,
        snippet: bestSnippet,
      }
    : undefined;

  return {
    totalScore,
    scope: bestField,
    highlight,
  };
}

function initFieldMatch(key: SearchResultScope): FieldMatch {
  return {
    key,
    tokens: new Set<string>(),
    score: 0,
  };
}

function buildHighlightSnippet(value: string, tokens: string[]) {
  if (!value) return value;
  let snippet = escapeHtml(value);
  tokens.forEach((token) => {
    if (!token) return;
    const regex = new RegExp(escapeRegex(token), "gi");
    snippet = snippet.replace(regex, (match) => `<mark>${match}</mark>`);
  });
  return snippet;
}

function hasFuzzyWordMatch(normalizedValue: string, token: string) {
  const words = normalizedValue.split(NON_WORD).filter(Boolean);
  return words.some((word) => {
    if (Math.abs(word.length - token.length) > 2) return false;
    return levenshtein(word, token) <= 1;
  });
}

function computePopularity(doc: MangaType) {
  const view = doc.viewNumber ?? 0;
  const follow = doc.followNumber ?? 0;
  const like = doc.likeNumber ?? 0;
  return Math.log10(1 + view + follow * 5 + like * 3);
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function levenshtein(a: string, b: string) {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}
