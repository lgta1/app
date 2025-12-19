import { load, type CheerioAPI, type Cheerio, type Element } from "cheerio";
import type { Model } from "mongoose";
import { createRequire } from "node:module";

import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS, type MangaContentType } from "~/constants/manga";
import { generateUniqueMangaSlug } from "~/database/helpers/manga-slug.helper";
import { MangaModel } from "~/database/models/manga.model";
import { AuthorModel } from "~/database/models/author.model";
import { DoujinshiModel } from "~/database/models/doujinshi.model";
import { CharacterModel } from "~/database/models/character.model";
import { TranslatorModel } from "~/database/models/translator.model";
import { slugify } from "~/utils/slug.utils";
import { stripDiacritics } from "~/utils/text-normalize";
import genresData from "~/../data/genres-full.json";
import supplementalGenresData from "~/../data/genres-missing-upsert.json";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept-Language": "vi,en;q=0.9",
};

const COVER_CANDIDATE_SELECTORS = [
  ".cover-frame",
  ".book-cover",
  ".manga-cover",
  ".thumb",
  ".thumb img",
  ".book-info .cover",
  ".book-info .poster",
  ".book-detail .cover",
  ".book-detail .poster",
  ".manga-info .cover",
  ".manga-info .poster",
  ".detail-info .cover",
  ".detail-info .poster",
  ".comic-info .cover",
  ".comic-info .poster",
  ".info .cover",
  ".info .poster",
  ".content .cover",
  ".content .cover img",
  "figure.cover",
  "figure.cover img",
  ".cover img",
];

const COVER_CONTAINER_SELECTORS = [
  ".book-info",
  ".book-detail",
  ".manga-info",
  ".detail-info",
  ".comic-info",
  ".info",
  ".content",
];

const BRAND_PATTERNS = [
  /vi[\s-]?hentai(?:\.pro)?/gi,
  /việt[\s-]?hentai/gi,
  /hentai\s+vietsub\s+hd/gi,
  /kuro\s*neko/gi,
  /mèo\s*đen/gi,
];

const sanitizeWhitespace = (value?: string | null) => {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
};

const stripBranding = (value?: string | null) => {
  let result = sanitizeWhitespace(value);
  if (!result) return "";
  for (const pattern of BRAND_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return sanitizeWhitespace(result);
};

const sanitizeTitle = (value?: string | null) => {
  let cleaned = stripBranding(value);
  if (!cleaned) return "";
  cleaned = cleaned.replace(/\s*[|\-–—]+\s*$/g, "");
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
  return cleaned || stripBranding(value) || "";
};

const sanitizeDescription = (value?: string | null) => {
  let cleaned = stripBranding(value);
  if (!cleaned) return "";
  cleaned = cleaned.replace(/(\s*[-–—]\s*){2,}/g, " - ");
  cleaned = cleaned.replace(/\s*[-–—]\s*$/g, "");
  return sanitizeWhitespace(cleaned);
};

const normalizeForCompare = (value?: string) =>
  stripDiacritics(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const stripTrailingTitleSuffix = (description: string, title: string) => {
  if (!description || !title) return description;
  const normTitle = normalizeForCompare(title);
  if (!normTitle) return description;

  const parts = description.split(/[-–—|:]+/);
  if (parts.length < 2) return description;

  const last = parts[parts.length - 1].trim();
  const normLast = normalizeForCompare(last);
  if (normLast && normLast === normTitle) {
    const rebuilt = parts.slice(0, -1).join(" - ").trim().replace(/[-–—|:]+$/, "").trim();
    return rebuilt || description;
  }

  return description;
};

const extractTitleFromDom = ($: CheerioAPI) => {
  const selectors = [
    "h1",
    ".manga-info h1",
    ".book-info h1",
    ".detail-info h1",
    ".comic-info h1",
    ".book-title",
    ".grow.text-lg",
    ".detail-info .title",
  ];
  for (const selector of selectors) {
    const text = sanitizeWhitespace($(selector).first().text());
    if (text) {
      return text;
    }
  }
  return undefined;
};

const require = createRequire(import.meta.url);

type GenreEntry = { slug: string; name: string; aliases?: string[] };

const loadScriptGenres = (): GenreEntry[] => {
  try {
    // NOTE: This module is executed in an ESM build in many environments (Remix/Vite).
    // Using `createRequire` keeps compatibility with CommonJS exports.
    const requireFromHere = createRequire(import.meta.url);
    const raw = requireFromHere("../../../../scripts/genres.array.cjs");
    if (Array.isArray(raw)) {
      return raw
        .map((item) => {
          const aliasSource = item?.aliases ?? item?.alias;
          const aliases = Array.isArray(aliasSource)
            ? aliasSource
            : aliasSource
              ? [String(aliasSource)]
              : [];
          return { slug: item?.slug, name: item?.name, aliases };
        })
        .filter((item) => Boolean(item.slug) && Boolean(item.name));
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("Không thể tải scripts/genres.array.cjs cho importer:", error);
  }
  return [];
};

const MANUAL_GENRE_ALIASES: Record<string, string> = {
  catgirl: "animal-girl",
  catgirls: "animal-girl",
  animalgirls: "animal-girl",
  "short-hentai": "short",
  shorthentai: "short",
  bodyswap: "body-swap",
  "body-swap": "body-swap",
  crossdressing: "cross-dressing",
  "cross-dressing": "cross-dressing",
  "cross dressing": "cross-dressing",
  pantyhose: "pantyhose",
  "dirty-old-man": "dirtyoldman",
  "dirty old man": "dirtyoldman",
  dirtyoldman: "dirtyoldman",
};

const GENRE_LOOKUP = (() => {
  const map = new Map<string, string>();
  const sources: GenreEntry[] = [
    ...(genresData as GenreEntry[]),
    ...(supplementalGenresData as GenreEntry[]),
    ...loadScriptGenres(),
  ];

  const addKey = (key: string, slug: string) => {
    if (!key || !slug) return;
    map.set(key, slug);
  };

  const collectKeyVariants = (value?: string) => {
    const variants = new Set<string>();
    const normalized = slugify(value || "");
    if (normalized) {
      variants.add(normalized);
      variants.add(normalized.replace(/-/g, ""));
    }
    return Array.from(variants).filter(Boolean);
  };

  for (const entry of sources) {
    const slug = entry?.slug?.trim().toLowerCase();
    if (!slug) continue;
    addKey(slug, slug);
    addKey(slug.replace(/-/g, ""), slug);
    collectKeyVariants(entry.name).forEach((key) => addKey(key, slug));
    (entry.aliases || []).forEach((alias) => {
      collectKeyVariants(alias).forEach((key) => addKey(key, slug));
    });
  }

  for (const [alias, target] of Object.entries(MANUAL_GENRE_ALIASES)) {
    const aliasKey = slugify(alias);
    const slug = target?.trim().toLowerCase();
    if (!aliasKey || !slug) continue;
    addKey(aliasKey, slug);
    addKey(aliasKey.replace(/-/g, ""), slug);
  }

  return map;
})();

export type ParsedViHentaiPage = {
  title: string;
  alternateTitle?: string;
  description: string;
  poster: string;
  rawGenres: string[];
  authorNames: string[];
  doujinshiNames: string[];
  characterNames: string[];
  executorNames: string[];
  translationTeam?: string;
  statusText?: string;
  viewNumber?: number;
  followNumber?: number;
  chapterCount: number;
  codeLabel?: string;
  url: string;
};

export type ViHentaiImportOptions = {
  url: string;
  ownerId: string;
  translationTeam?: string;
  slugOverride?: string;
  dryRun?: boolean;
  approve?: boolean;
  skipIfExists?: boolean;
  contentType?: MangaContentType;
  userStatusOverride?: number;
};

export type ViHentaiImportResult = {
  url: string;
  parsed: ParsedViHentaiPage;
  matchedGenres: string[];
  unknownGenres: string[];
  payload: {
    title: string;
    alternateTitle?: string;
    slug: string;
    description: string;
    poster: string;
    genres: string[];
    author?: string;
    translationTeam: string;
    ownerId: string;
    status: number;
    userStatus: number;
    translatorNames: string[];
    translatorSlugs: string[];
    doujinshiNames: string[];
    doujinshiSlugs: string[];
    characterNames: string[];
    characterSlugs: string[];
    keywords?: string;
    contentType: MangaContentType;
  };
  mode: "dry-run" | "created" | "skipped";
  message: string;
  createdId?: string;
  createdSlug?: string;
};

const fetchHtml = async (url: string) => {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`Không thể tải trang (${response.status} ${response.statusText})`);
  }
  return response.text();
};

const findLabelSection = ($: CheerioAPI, label: string) => {
  const normalized = label.trim().toLowerCase();
  const candidates = $("span")
    .filter((_, el) => $(el).text().trim().toLowerCase().startsWith(normalized))
    .toArray();
  if (!candidates.length) {
    return null;
  }

  const preferredEl =
    candidates.find((el) => /[:：]/.test($(el).text())) ?? candidates[candidates.length - 1];
  const preferred = $(preferredEl);
  const parent = preferred.parent();
  return parent.length ? parent : preferred;
};

const extractLabeledText = ($: CheerioAPI, label: string) => {
  const section = findLabelSection($, label);
  if (!section) return undefined;
  const clone = section.clone();
  clone.find("span").each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.startsWith(label.trim().toLowerCase())) {
      $(el).remove();
    }
  });
  return clone.text().replace(/[:：]/, "").trim().replace(/\s+/g, " ");
};

const parseNumeric = (value?: string | null) => {
  if (!value) return 0;
  const digits = value.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  return Number.parseInt(digits, 10) || 0;
};

const parseGenres = ($: CheerioAPI) => {
  const section = findLabelSection($, "Thể loại");
  if (!section) return [] as string[];
  return section
    .find("a")
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean);
};

const parseAuthorNames = ($: CheerioAPI) => {
  const section = findLabelSection($, "Tác giả");
  if (!section) {
    const fallback = sanitizeWhitespace(extractLabeledText($, "Tác giả"));
    return fallback ? [fallback] : [];
  }

  const anchors = section
    .find("a")
    .map((_, el) => sanitizeWhitespace($(el).text()))
    .get()
    .filter(Boolean);

  if (anchors.length) {
    return Array.from(new Set(anchors));
  }

  const fallback = sanitizeWhitespace(extractLabeledText($, "Tác giả"));
  return fallback ? [fallback] : [];
};

const splitLabelListValues = (value?: string | null) => {
  const cleaned = sanitizeWhitespace(value);
  if (!cleaned) return [] as string[];
  return cleaned
    .split(/[,/|;]/)
    .map((part) => sanitizeWhitespace(part))
    .filter(Boolean);
};

const parseLabeledEntityList = ($: CheerioAPI, labels: string[]) => {
  const collected = new Map<string, string>();
  const addValue = (value?: string | null) => {
    const name = sanitizeWhitespace(value);
    if (!name) return;
    const key = name.toLowerCase();
    if (collected.has(key)) return;
    collected.set(key, name);
  };

  for (const label of labels) {
    const section = findLabelSection($, label);
    if (section) {
      const anchors = section
        .find("a")
        .map((_, el) => sanitizeWhitespace($(el).text()))
        .get()
        .filter(Boolean);
      if (anchors.length) {
        anchors.forEach(addValue);
        continue;
      }
    }
    const fallbackValues = splitLabelListValues(extractLabeledText($, label));
    fallbackValues.forEach(addValue);
  }

  return Array.from(collected.values());
};

const parseDoujinshiNames = ($: CheerioAPI) => parseLabeledEntityList($, ["Doujinshi", "Bộ truyện", "Series"]);

const parseCharacterNames = ($: CheerioAPI) => parseLabeledEntityList($, ["Nhân vật", "Characters", "Character"]);

const parseChapterCount = ($: CheerioAPI) => {
  const header = $("div")
    .filter((_, el) => $(el).find("span").first().text().trim().startsWith("Danh sách chương"))
    .first();
  if (!header.length) return 0;
  const list = header.nextAll("ul").first();
  if (!list.length) return 0;
  const anchorCount = list.find("a").length;
  if (anchorCount > 0) return anchorCount;
  return list.find("li").length;
};

const parseFollowNumber = ($: CheerioAPI) => {
  const button = $("button")
    .filter((_, el) => $(el).text().toLowerCase().includes("theo dõi"))
    .first();
  if (!button.length) return 0;
  const match = button.text().match(/\((\d+)\)/);
  return match ? Number.parseInt(match[1], 10) : 0;
};

const normalizePosterUrl = (value?: string | null) => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("//")) {
    return `https:${trimmed}`;
  }
  return trimmed;
};

const parsePosterFromStyle = (style?: string | null) => {
  if (!style) return undefined;
  const match = style.match(/url\((['"]?)(?<url>.+?)\1\)/);
  return normalizePosterUrl(match?.groups?.url);
};

const extractImageFromElement = ($element: Cheerio<Element>) => {
  const candidateImages: Array<Cheerio<Element>> = [];
  if ($element.is("img")) {
    candidateImages.push($element);
  }
  const firstChildImg = $element.find("img").first();
  if (firstChildImg.length) {
    candidateImages.push(firstChildImg);
  }

  for (const img of candidateImages) {
    const attrs = ["data-src", "data-original", "data-lazy", "data-lazy-src", "src"] as const;
    for (const attr of attrs) {
      const value = normalizePosterUrl(img.attr(attr));
      if (value) {
        return value;
      }
    }
    const srcset = img.attr("srcset")?.split(",")[0]?.trim().split(" ")[0];
    const srcsetUrl = normalizePosterUrl(srcset);
    if (srcsetUrl) {
      return srcsetUrl;
    }
  }

  const styleUrl = parsePosterFromStyle($element.attr("style"));
  if (styleUrl) {
    return styleUrl;
  }

  const backgroundAttr = $element.attr("data-bg") || $element.attr("data-background");
  return normalizePosterUrl(backgroundAttr);
};

const extractPosterFromDom = ($: CheerioAPI) => {
  for (const selector of COVER_CANDIDATE_SELECTORS) {
    const node = $(selector).first();
    if (!node.length) continue;
    const url = extractImageFromElement(node as Cheerio<Element>);
    if (url) {
      return url;
    }
  }

  for (const containerSelector of COVER_CONTAINER_SELECTORS) {
    const container = $(containerSelector).first();
    if (!container.length) continue;
    const direct = extractImageFromElement(container as Cheerio<Element>);
    if (direct) {
      return direct;
    }
    const fallbackNode = container.find(".cover, .poster, img, figure").first();
    if (fallbackNode.length) {
      const url = extractImageFromElement(fallbackNode as Cheerio<Element>);
      if (url) {
        return url;
      }
    }
  }

  return undefined;
};

const inferUserStatus = (text?: string) => {
  if (!text) return MANGA_USER_STATUS.ON_GOING;
  const normalized = text.toLowerCase();
  if (normalized.includes("hoàn") || normalized.includes("complete") || normalized.includes("xong")) {
    return MANGA_USER_STATUS.COMPLETED;
  }
  return MANGA_USER_STATUS.ON_GOING;
};

const parsePage = (html: string, url: string): ParsedViHentaiPage => {
  const $ = load(html);

  const titleFromDom = extractTitleFromDom($);
  const fallbackTitle =
    $("meta[property='og:title']").attr("content")?.trim() || $("title").text().trim();
  const title = sanitizeTitle(titleFromDom || fallbackTitle);
  if (!title) {
    throw new Error("Không tìm thấy tiêu đề từ trang nguồn");
  }

  const rawDescription =
    $("meta[property='og:description']").attr("content")?.trim() ||
    $("meta[name='description']").attr("content")?.trim();
  const normalizedTitle = sanitizeWhitespace(title);
  const description = sanitizeDescription(rawDescription);
  const trimmedDescription = stripTrailingTitleSuffix(description, normalizedTitle);
  const safeDescription = trimmedDescription && trimmedDescription !== normalizedTitle ? trimmedDescription : "";

  const poster =
    extractPosterFromDom($) ||
    normalizePosterUrl($("meta[property='og:image']").attr("content")) ||
    normalizePosterUrl($("meta[name='twitter:image']").attr("content")) ||
    parsePosterFromStyle($(".cover-frame").first().attr("style"));
  if (!poster) {
    throw new Error("Không tìm thấy ảnh bìa (poster)");
  }

  const rawGenres = parseGenres($);
  const doujinshiNames = parseDoujinshiNames($);
  const characterNames = parseCharacterNames($);
  const alternateTitle = sanitizeWhitespace(extractLabeledText($, "Tên khác"));
  const authorNames = parseAuthorNames($);
  const executorNames = parseLabeledEntityList($, ["Thực hiện", "Thuc hien", "Thực Hiện"]);
  const translationTeam = sanitizeWhitespace(extractLabeledText($, "Nhóm dịch"));
  const statusText = sanitizeWhitespace(extractLabeledText($, "Tình trạng"));
  const viewSection = findLabelSection($, "Lượt xem");
  const viewNumber = viewSection
    ? parseNumeric(viewSection.find(".abbreviation-number").attr("abbreviation") || viewSection.text())
    : 0;
  const chapterCount = parseChapterCount($);
  const followNumber = parseFollowNumber($);
  const codeLabel = extractLabeledText($, "Code");

  return {
    title,
    alternateTitle,
    description: safeDescription,
    poster,
    rawGenres,
    authorNames,
    doujinshiNames,
    characterNames,
    executorNames,
    translationTeam,
    statusText,
    viewNumber,
    followNumber,
    chapterCount,
    codeLabel,
    url,
  };
};

const mapGenres = (rawGenres: string[]) => {
  const matched: string[] = [];
  const unknown: string[] = [];

  for (const label of rawGenres) {
    const key = slugify(label);
    if (!key) continue;
    const slug = GENRE_LOOKUP.get(key);
    if (slug) {
      if (!matched.includes(slug)) {
        matched.push(slug);
      }
    } else {
      unknown.push(label);
    }
  }

  return { matched, unknown };
};

type TranslatorMeta = {
  translationTeam: string;
  translatorNames: string[];
  translatorSlugs: string[];
};

const normalizeTranslatorName = (value?: string | null) => {
  const trimmed = sanitizeWhitespace(value);
  if (!trimmed) return "";
  const normalized = trimmed.replace(/^nh[oó]m\s*[:：-]?\s*/i, "").trim();
  return normalized || trimmed;
};

const buildTranslatorMeta = (primary?: string, fallback?: string): TranslatorMeta => {
  const normalizedPrimary = normalizeTranslatorName(primary);
  const normalizedFallback = normalizeTranslatorName(fallback);
  const selected = normalizedPrimary || normalizedFallback;
  const translationTeam = selected || sanitizeWhitespace(primary) || sanitizeWhitespace(fallback) || "Auto-import";
  if (!selected) {
    return {
      translationTeam,
      translatorNames: [],
      translatorSlugs: [],
    };
  }
  const slugBase = slugify(selected) || selected.replace(/\s+/g, "-").toLowerCase();
  return {
    translationTeam,
    translatorNames: [selected],
    translatorSlugs: [slugBase],
  };
};

const buildKeywords = (
  statusText?: string,
  translationTeam?: string,
  rawGenres?: string[],
  codeLabel?: string,
  authorNames?: string[],
  alternateTitle?: string,
  doujinshiNames?: string[],
  characterNames?: string[],
) => {
  const parts = [
    statusText,
    translationTeam,
    rawGenres?.join(", "),
    codeLabel,
    authorNames?.join(", "),
    alternateTitle,
    doujinshiNames?.join(", "),
    characterNames?.join(", "),
  ]
    .map((part) => sanitizeWhitespace(part))
    .filter(Boolean);
  const joined = parts.join(" | ");
  return joined || undefined;
};

const normalizeNameList = (values?: string[]) => {
  if (!Array.isArray(values) || !values.length) {
    return [] as string[];
  }
  return values.map((value) => sanitizeWhitespace(value)).filter(Boolean);
};

const mergeUniqueNames = (primary: string[], secondary: string[]) => {
  const map = new Map<string, string>();
  primary.forEach((name) => {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, name);
  });
  secondary.forEach((name) => {
    const key = name.toLowerCase();
    if (!map.has(key)) map.set(key, name);
  });
  return Array.from(map.values());
};

const buildSlugListForNames = (names: string[], fallbackPrefix: string) => {
  const used = new Set<string>();
  return names.map((name, index) => {
    const base = slugify(name) || `${fallbackPrefix}-${index + 1}`;
    let slug = base;
    let suffix = 2;
    while (used.has(slug)) {
      slug = `${base}-${suffix++}`;
    }
    used.add(slug);
    return slug;
  });
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
type NameSlugDocument = { name: string; slug: string };

const ensureUniqueSlugForModel = async <T extends NameSlugDocument>(
  model: Model<T>,
  base: string,
  fallbackPrefix: string,
) => {
  const safeBase = base || fallbackPrefix;
  let slug = safeBase;
  let suffix = 2;
  // eslint-disable-next-line no-constant-condition
  while (await model.exists({ slug })) {
    slug = `${safeBase}-${suffix++}`;
    if (suffix > 200) {
      slug = `${safeBase}-${Date.now()}`;
      break;
    }
  }
  return slug;
};

const ensureNamedDocuments = async <T extends NameSlugDocument>(
  model: Model<T>,
  names?: string[],
  slugs?: string[],
  slugPrefix = "entity",
) => {
  if (!names?.length) {
    return { names: [] as string[], slugs: [] as string[] };
  }

  const ensuredNames: string[] = [];
  const ensuredSlugs: string[] = [];

  for (let i = 0; i < names.length; i += 1) {
    const name = sanitizeWhitespace(names[i]);
    if (!name) continue;
    const slugHint = sanitizeWhitespace(slugs?.[i]);
    const slugBase = slugify(slugHint || name) || `${slugPrefix}-${Date.now()}-${i}`;

    const existingBySlug = await model.findOne({ slug: slugBase }).lean();
    if (existingBySlug) {
      ensuredNames.push(existingBySlug.name);
      ensuredSlugs.push(existingBySlug.slug);
      continue;
    }

    const existingByName = await model
      .findOne({ name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") } })
      .lean();
    if (existingByName) {
      ensuredNames.push(existingByName.name);
      ensuredSlugs.push(existingByName.slug);
      continue;
    }

    const uniqueSlug = await ensureUniqueSlugForModel(model, slugBase, slugPrefix);
    const doc = await model.create({ name, slug: uniqueSlug } as T);
    ensuredNames.push(doc.name);
    ensuredSlugs.push(doc.slug);
  }

  if (!ensuredNames.length) {
    return { names: [] as string[], slugs: [] as string[] };
  }

  return { names: ensuredNames, slugs: ensuredSlugs };
};

const ensureTranslatorDocuments = async <T extends { translatorNames: string[]; translatorSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(TranslatorModel, payload.translatorNames, payload.translatorSlugs, "translator");
  return {
    ...payload,
    translatorNames: ensured.names,
    translatorSlugs: ensured.slugs,
  };
};

const ensureDoujinshiDocuments = async <T extends { doujinshiNames: string[]; doujinshiSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(DoujinshiModel, payload.doujinshiNames, payload.doujinshiSlugs, "doujinshi");
  return {
    ...payload,
    doujinshiNames: ensured.names,
    doujinshiSlugs: ensured.slugs,
  };
};

const ensureAuthorDocuments = async <T extends { authorNames?: string[]; authorSlugs?: string[]; author?: string }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(AuthorModel as any, payload.authorNames, payload.authorSlugs, "author");
  return {
    ...payload,
    authorNames: ensured.names,
    authorSlugs: ensured.slugs,
    author: ensured.names.length ? ensured.names.join(", ") : payload.author,
  };
};

const ensureCharacterDocuments = async <T extends { characterNames: string[]; characterSlugs: string[] }>(
  payload: T,
) => {
  const ensured = await ensureNamedDocuments(CharacterModel, payload.characterNames, payload.characterSlugs, "character");
  return {
    ...payload,
    characterNames: ensured.names,
    characterSlugs: ensured.slugs,
  };
};

const prepareBaseMangaPayload = (
  parsed: ParsedViHentaiPage,
  options: Omit<ViHentaiImportOptions, "url">,
  matchedGenres: string[],
) => {
  const translatorMeta = buildTranslatorMeta(options.translationTeam, parsed.translationTeam);
  const executorNames = normalizeNameList(parsed.executorNames);
  const userStatus = options.userStatusOverride ?? inferUserStatus(parsed.statusText);
  const contentType = options.contentType ?? MANGA_CONTENT_TYPE.MANGA;
  const authorList = normalizeNameList(parsed.authorNames);
  const authorSlugs = buildSlugListForNames(authorList, "author");
  const doujinshiNames = normalizeNameList(parsed.doujinshiNames);
  const characterNames = normalizeNameList(parsed.characterNames);
  const doujinshiSlugs = buildSlugListForNames(doujinshiNames, "doujinshi");
  const characterSlugs = buildSlugListForNames(characterNames, "character");
  const translatorNames = mergeUniqueNames(translatorMeta.translatorNames, executorNames);
  const translatorSlugs = buildSlugListForNames(translatorNames, "translator");
  const keywords = buildKeywords(
    parsed.statusText,
    translatorMeta.translationTeam,
    parsed.rawGenres,
    parsed.codeLabel,
    authorList,
    parsed.alternateTitle,
    doujinshiNames,
    characterNames,
  );
  const author = authorList.length ? authorList.join(", ") : undefined;

  return {
    title: parsed.title,
    alternateTitle: parsed.alternateTitle || undefined,
    description: sanitizeDescription(parsed.description) || "",
    poster: parsed.poster,
    genres: matchedGenres,
    author,
    authorNames: authorList,
    authorSlugs,
    translationTeam: translatorMeta.translationTeam,
    translatorNames,
    translatorSlugs,
    doujinshiNames,
    doujinshiSlugs,
    characterNames,
    characterSlugs,
    ownerId: options.ownerId,
    status: options.approve ? MANGA_STATUS.APPROVED : MANGA_STATUS.PENDING,
    userStatus,
    keywords,
    contentType,
  };
};

export const fetchViHentaiPage = async (url: string) => {
  const html = await fetchHtml(url);
  return parsePage(html, url);
};

type BasePayload = ReturnType<typeof prepareBaseMangaPayload>;

export const buildMangaPayloadFromViHentai = async (
  parsed: ParsedViHentaiPage,
  options: Omit<ViHentaiImportOptions, "url">,
  matchedGenres: string[],
  basePayload?: BasePayload,
) => {
  const prepared = basePayload ?? prepareBaseMangaPayload(parsed, options, matchedGenres);
  const slug = options.slugOverride || (await generateUniqueMangaSlug(prepared.title));

  return {
    ...prepared,
    slug,
  };
};

export async function importViHentaiManga(options: ViHentaiImportOptions): Promise<ViHentaiImportResult> {
  if (!options.url) throw new Error("Thiếu URL nguồn");
  if (!options.ownerId) throw new Error("Thiếu ownerId");

  const parsed = await fetchViHentaiPage(options.url);
  const { matched, unknown } = mapGenres(parsed.rawGenres);
  if (!matched.length) {
    throw new Error(
      `Không map được thể loại hợp lệ. Nhận được: ${parsed.rawGenres.join(", ") || "<empty>"}`,
    );
  }

  const basePayload = prepareBaseMangaPayload(parsed, options, matched);

  if (options.skipIfExists) {
    const existing = await MangaModel.findOne({ title: parsed.title })
      .select({ _id: 1, slug: 1 })
      .lean();
    if (existing) {
      return {
        url: options.url,
        parsed,
        matchedGenres: matched,
        unknownGenres: unknown,
        payload: {
          ...basePayload,
          slug: String(existing.slug || existing._id),
        },
        mode: "skipped",
        message: "Bỏ qua vì đã tồn tại truyện cùng tên",
        createdSlug: String(existing.slug || existing._id),
      };
    }
  }

  let payload = await buildMangaPayloadFromViHentai(parsed, options, matched, basePayload);

  if (options.dryRun) {
    return {
      url: options.url,
      parsed,
      matchedGenres: matched,
      unknownGenres: unknown,
      payload,
      mode: "dry-run",
      message: "Dry-run: chỉ hiển thị payload, không ghi DB",
    };
  }

  payload = await ensureTranslatorDocuments(payload);
  payload = await ensureAuthorDocuments(payload);
  payload = await ensureDoujinshiDocuments(payload);
  payload = await ensureCharacterDocuments(payload);

  const doc = await MangaModel.create(payload);
  return {
    url: options.url,
    parsed,
    matchedGenres: matched,
    unknownGenres: unknown,
    payload,
    mode: "created",
    message: "Tạo truyện thành công",
    createdId: String(doc._id),
    createdSlug: doc.slug,
  };
}
