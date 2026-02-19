import { MANGA_CONTENT_TYPE, MANGA_STATUS } from "~/constants/manga";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { normalizeText, splitAliases, type SearchResultScope } from "~/utils/text-normalize";

export type BasicSearchItem = {
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

export type BasicSearchResponse = {
  items: BasicSearchItem[];
  total: number;
  hasMore: boolean;
  nextOffset: number;
  requestedOffset: number;
};

type BasicSearchParams = {
  query: string;
  limit: number;
  offset?: number;
  maxTotal?: number;
};

export async function basicSearch({ query, limit, offset = 0, maxTotal = 80 }: BasicSearchParams): Promise<BasicSearchResponse> {
  const cleanedQuery = query.trim();
  if (!cleanedQuery) {
    return { items: [], total: 0, hasMore: false, nextOffset: 0, requestedOffset: 0 };
  }

  const safeLimit = Math.max(1, Math.min(100, limit));
  const safeOffset = Math.max(0, offset);
  const safeMaxTotal = Math.max(1, Math.min(200, maxTotal));

  if (safeOffset >= safeMaxTotal) {
    return {
      items: [],
      total: 0,
      hasMore: false,
      nextOffset: safeOffset,
      requestedOffset: safeOffset,
    };
  }

  const remaining = safeMaxTotal - safeOffset;
  const queryLimit = remaining > safeLimit ? safeLimit + 1 : safeLimit;

  const textDocs = await MangaModel.find(
    {
      status: MANGA_STATUS.APPROVED,
      contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
      $text: { $search: cleanedQuery },
    },
    {
      score: { $meta: "textScore" },
      title: 1,
      slug: 1,
      poster: 1,
      genres: 1,
      chapters: 1,
      alternateTitle: 1,
      keywords: 1,
      characterNames: 1,
      doujinshiNames: 1,
      author: 1,
      translatorNames: 1,
      translationTeam: 1,
      updatedAt: 1,
    },
  )
    .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
    .skip(safeOffset)
    .limit(queryLimit)
    .lean()
    .catch(() => [] as MangaType[]);

  const normalizedQuery = normalizeText(cleanedQuery);
  const pageDocs = textDocs.slice(0, safeLimit);
  const hasMore = textDocs.length > safeLimit;

  const items = pageDocs.map((doc) => {
    const scope = resolveBestScope(doc as MangaType, normalizedQuery);
    const altTitle = deriveAlternateTitle(doc as MangaType);

    return {
      id: String((doc as any)?.id ?? (doc as any)?._id ?? ""),
      slug: (doc as MangaType).slug,
      title: (doc as MangaType).title,
      poster: (doc as MangaType).poster,
      genres: (doc as MangaType).genres || [],
      chapters: (doc as MangaType).chapters || 0,
      scope,
      ...(altTitle ? { altTitle } : {}),
    } satisfies BasicSearchItem;
  });

  return {
    items,
    total: items.length,
    hasMore,
    nextOffset: safeOffset + items.length,
    requestedOffset: safeOffset,
  };
}

function resolveBestScope(doc: MangaType, normalizedQuery: string): SearchResultScope {
  const title = normalizeText(doc.title || "");
  if (title.includes(normalizedQuery)) return "title";

  const aliases = [
    ...splitAliases(doc.alternateTitle),
    ...splitAliases(doc.keywords),
  ].map((value) => normalizeText(value));
  if (aliases.some((value) => value.includes(normalizedQuery))) return "alias";

  const characters = (doc.characterNames || []).map((value) => normalizeText(value));
  if (characters.some((value) => value.includes(normalizedQuery))) return "character";

  return "doujinshi";
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
    if (!normalizedTitle || alias.toLowerCase() !== normalizedTitle) {
      return alias;
    }
  }

  return undefined;
}
