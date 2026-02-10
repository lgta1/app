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
  exactWeight: number;
  tokenWeight: number;
  regexPaths: Array<{ path: keyof MangaType | string; isArray?: boolean }>;
  getValues: (doc: MangaType) => string[];
};

const BASE_FIELD_ORDER: SearchResultScope[] = ["title", "alias", "character", "doujinshi"];
const TEXT_MATCH_LIMIT = 150;
const REGEX_MATCH_LIMIT = 120;
const MAX_REGEX_TOKEN_LENGTH = 3;

const FIELD_CONFIGS: Record<SearchResultScope, FieldConfig> = {
  title: {
    key: "title",
    exactWeight: 10,
    tokenWeight: 2,
    regexPaths: [{ path: "title" }],
    getValues: (doc) => (doc.title ? [doc.title] : []),
  },
  alias: {
    key: "alias",
    exactWeight: 8,
    tokenWeight: 1,
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
    exactWeight: 5,
    tokenWeight: 1,
    regexPaths: [{ path: "characterNames", isArray: true }],
    getValues: (doc) => doc.characterNames || [],
  },
  doujinshi: {
    key: "doujinshi",
    exactWeight: 4,
    tokenWeight: 1,
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
  const normalizedQuery = normalizeText(query);
  const orderedFields = scope === "all" ? BASE_FIELD_ORDER : [scope, ...BASE_FIELD_ORDER.filter((f) => f !== scope)];

  const results: RankedEntry[] = [];

  for (const doc of candidates) {
    const analysis = scoreDocument(doc, tokens, displayTokens, normalizedQuery, orderedFields, scope);
    if (!analysis) continue;

    const textScore = Number((doc as any).__textScore ?? 0) * 5;
    const totalScore = analysis.score + textScore;
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

function scoreDocument(
  doc: MangaType,
  tokens: string[],
  displayTokens: string[],
  normalizedQuery: string,
  orderedFields: SearchResultScope[],
  scope: SearchScope,
) {
  let totalMatchedTokens = 0;
  let totalScore = 0;
  let bestField: SearchResultScope = orderedFields[0] ?? "title";
  let bestSnippet: string | undefined;
  let bestFieldScore = -1;

  for (const fieldKey of BASE_FIELD_ORDER) {
    const config = FIELD_CONFIGS[fieldKey];
    const rawValues = config.getValues(doc).filter(Boolean);
    if (rawValues.length === 0) continue;

    const matchedTokens = new Set<string>();
    let exactHit = false;
    let partialHit = false;

    for (const value of rawValues) {
      const normalized = normalizeText(value);
      const compact = normalized.replace(NON_WORD, "");

      if (normalizedQuery) {
        if (normalized === normalizedQuery || compact === normalizedQuery) {
          exactHit = true;
        } else if (normalized.includes(normalizedQuery) || compact.includes(normalizedQuery)) {
          partialHit = true;
        }
      }

      for (const token of tokens) {
        if (!token) continue;
        if (normalized.includes(token) || compact.includes(token)) {
          matchedTokens.add(token);
          continue;
        }
        if (token.length >= 4 && hasFuzzyWordMatch(normalized, token)) {
          matchedTokens.add(token);
        }
      }
    }

    if (fieldKey === "alias" && /^\d+$/.test(normalizedQuery) && String(doc.code || "").includes(normalizedQuery)) {
      exactHit = true;
    }

    const tokenScore = matchedTokens.size * config.tokenWeight;
    const exactScore = exactHit
      ? config.exactWeight
      : partialHit
        ? Math.round(config.exactWeight * 0.7)
        : 0;
    const fieldScore = exactScore + tokenScore;

    if (matchedTokens.size > 0 || exactHit || partialHit) {
      totalMatchedTokens += matchedTokens.size;
      totalScore += fieldScore;
      if (!bestSnippet || fieldScore > bestFieldScore) {
        bestField = fieldKey;
        bestFieldScore = fieldScore;
        bestSnippet = buildHighlightSnippet(rawValues[0], displayTokens.length ? displayTokens : tokens);
      }
    }
  }

  if (scope !== "all") {
    const scopedValues = FIELD_CONFIGS[scope].getValues(doc).filter(Boolean);
    const scopedMatch = scopedValues.some((value) => {
      const normalized = normalizeText(value);
      if (normalizedQuery && normalized.includes(normalizedQuery)) return true;
      return tokens.some((token) => token && normalized.includes(token));
    });
    if (!scopedMatch) return null;
  }

  if (totalScore === 0 && totalMatchedTokens === 0) return null;

  totalScore += totalMatchedTokens * 2;

  if (!bestSnippet) {
    const fallbackValues = FIELD_CONFIGS[bestField].getValues(doc);
    bestSnippet = fallbackValues[0] || doc.title;
  }

  return {
    score: totalScore,
    scope: bestField,
    highlight: bestSnippet
      ? {
          field: bestField,
          snippet: bestSnippet,
        }
      : undefined,
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
