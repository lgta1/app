import { MANGA_CONTENT_TYPE, MANGA_STATUS, type MangaContentType } from "~/constants/manga";
import { MangaModel, type MangaType } from "~/database/models/manga.model";
import { getLatestChapterTitlesForMangaIds } from "./shared.latest-chapter-titles";
import { FEATURED_GENRE_SLUGS, normalizeGenreSlugs } from "~/constants/featured-genres";
import type { UserType } from "~/database/models/user.model";
import { isAdmin } from "~/helpers/user.helper";
import { ensureSlugForDocs, resolveMangaHandle } from "~/database/helpers/manga-slug.helper";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";

const buildContentTypeFilter = (
  desired: MangaContentType,
  includeLegacyNull: boolean = desired === MANGA_CONTENT_TYPE.MANGA,
) => {
  return includeLegacyNull ? { $in: [desired, null] } : desired;
};

const withContentType = (
  query: Record<string, any> | undefined,
  fallback: MangaContentType = MANGA_CONTENT_TYPE.MANGA,
  includeLegacyNull: boolean = fallback === MANGA_CONTENT_TYPE.MANGA,
) => {
  const next = { ...(query ?? {}) };
  if (!("contentType" in next)) {
    next.contentType = buildContentTypeFilter(fallback, includeLegacyNull);
  }
  return next;
};

const normalizeMangaMedia = (doc: any) => {
  if (!doc) return doc;
  const next = { ...(doc as any) };
  next.id = String(next.id ?? next._id ?? "");
  if (typeof next.poster === "string") next.poster = rewriteLegacyCdnUrl(next.poster);
  if (typeof next.shareImage === "string") next.shareImage = rewriteLegacyCdnUrl(next.shareImage);
  return next as any;
};

const normalizeMangaList = (docs: any[]) => (docs as any[]).map((d) => normalizeMangaMedia(d));

export const getNewManga = async (
  page: number = 1,
  limit: number = 10,
  options?: { contentType?: MangaContentType; minChapters?: number },
) => {
  const skip = (page - 1) * limit;
  const desiredContentType = options?.contentType ?? MANGA_CONTENT_TYPE.MANGA;
  const includeLegacyNull = !options?.contentType && desiredContentType === MANGA_CONTENT_TYPE.MANGA;

  const minChapters = Number.isFinite(options?.minChapters as any)
    ? Math.max(0, Number(options?.minChapters))
    : undefined;

  const filter = {
    status: MANGA_STATUS.APPROVED,
    contentType: buildContentTypeFilter(desiredContentType, includeLegacyNull),
    ...(minChapters !== undefined ? { chapters: { $gte: minChapters } } : null),
  };

  // NOTE:
  // - lastChapterAt/latestChapterAt không có trong schema hiện tại → loại khỏi sort để tránh mất index.
  // - Ưu tiên sort theo updatedAt desc (fallback createdAt desc) và bảo đảm có index phù hợp.
  const [mangaRaw, totalCount] = await Promise.all([
    MangaModel.find(filter)
      .select({
        title: 1,
        alternateTitle: 1,
        slug: 1,
        poster: 1,
        chapters: 1,
        createdAt: 1,
        updatedAt: 1,
        genres: 1,
        userStatus: 1,
      })
      .sort({ updatedAt: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MangaModel.countDocuments(filter),
  ]);

  await ensureSlugForDocs(mangaRaw as any[]);

  // Ensure each item has a stable `id` field for client keys/links (lean() doesn't include virtual id)
  let manga = normalizeMangaList(mangaRaw as any[]);

  // Append latestChapterTitle denormalized to reduce client requests
  {
    const ids = manga.map((m) => String(m.id ?? m._id));
    const titles = await getLatestChapterTitlesForMangaIds(ids).catch(() => ({} as Record<string, string>));
    manga = manga.map((m) => ({ ...(m as any), latestChapterTitle: titles[String(m.id ?? m._id)] ?? null }));
  }

  return {
    manga,
    totalCount,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  };
};

export const getNewCosplay = async (page: number = 1, limit: number = 10) => {
  return getNewManga(page, limit, { contentType: MANGA_CONTENT_TYPE.COSPLAY });
};

export const getRandomApprovedMangaId = async (): Promise<string | null> => {
  const [doc] = await MangaModel.aggregate<{ _id: string }>([
    {
      $match: {
        status: MANGA_STATUS.APPROVED,
        contentType: buildContentTypeFilter(MANGA_CONTENT_TYPE.MANGA),
      },
    },
    { $sample: { size: 1 } },
    { $project: { _id: 1 } },
  ]);

  return doc ? String(doc._id) : null;
};
export const getTotalMangaCount = async ({
  searchTerm,
  query = {},
}: {
  searchTerm?: string;
  query?: Record<string, any>;
}) => {
  if (searchTerm) {
    return await MangaModel.countDocuments({
      $text: { $search: searchTerm },
      ...query,
    });
  }
  return await MangaModel.countDocuments(query);
};

export const getTotalMangaCountAdmin = async ({
  searchTerm,
  status,
  query = {},
}: {
  searchTerm?: string;
  status?: number;
  query?: Record<string, any>;
}) => {
  const filter: any = { ...query };

  if (searchTerm) {
    filter.$text = { $search: searchTerm };
  }

  if (status !== undefined) {
    filter.status = status;
  }

  return await MangaModel.countDocuments(filter);
};

export const getAllMangaAdmin = async (
  page: number = 1,
  limit: number = 10,
  status?: number,
) => {
  const skip = (page - 1) * limit;
  const filter = status !== undefined ? { status } : {};
  const docs = await MangaModel.find(filter)
    .sort({ updatedAt: -1, lastChapterAt: -1, latestChapterAt: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  return (docs as any[]).map((d) => ({ ...d, id: String(d?.id ?? d?._id ?? "") }));
};

export const searchMangaWithPagination = async (
  searchTerm: string,
  page: number = 1,
  limit: number = 10,
  status?: number,
) => {
  const skip = (page - 1) * limit;
  const filter: any = { $text: { $search: searchTerm } };
  if (status !== undefined) {
    filter.status = status;
  }
  const docs = await MangaModel.find(filter, { score: { $meta: "textScore" } })
    .sort({ score: { $meta: "textScore" } })
    .skip(skip)
    .limit(limit)
    .lean();
  return (docs as any[]).map((d) => ({ ...d, id: String(d?.id ?? d?._id ?? "") }));
};

export const searchMangaAdminAdvanced = async ({
  keyword,
  page = 1,
  limit = 10,
  status,
}: {
  keyword: string;
  page?: number;
  limit?: number;
  status?: number;
}) => {
  const skip = Math.max(0, (page - 1) * limit);
  const baseFilter: Record<string, any> = {};
  if (status !== undefined) {
    baseFilter.status = status;
  }

  const textFilter = {
    ...baseFilter,
    $text: { $search: keyword },
  };

  const [docs, total] = await Promise.all([
    MangaModel.find(textFilter, { score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, updatedAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    MangaModel.countDocuments(textFilter),
  ]);

  let results = docs;
  let totalCount = total;

  if (results.length === 0 && Number.isInteger(Number(keyword))) {
    const codeFilter = { ...baseFilter, code: keyword };
    const codeDocs = await MangaModel.find(codeFilter)
      .sort({ createdAt: -1 })
      .lean();
    results = codeDocs;
    totalCount = await MangaModel.countDocuments(codeFilter);
  }

  const normalized = (results as any[]).map((d) => ({ ...d, id: String(d?.id ?? d?._id ?? "") }));
  return {
    mangas: normalized,
    total: totalCount,
  };
};

export const searchMangaApprovedWithPagination = async ({
  keyword,
  page,
  limit,
  query = {},
  sort,
  cursor,
}: {
  keyword?: string;
  page: number;
  limit: number;
  query?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  cursor?: Record<string, any>;
}) => {
  const buildSeekFilter = (
    sortSpec: Record<string, 1 | -1>,
    cursorValues: Record<string, any>,
  ): Record<string, any> | null => {
    const entries = Object.entries(sortSpec);
    if (entries.length === 0) return null;

    const tieDir = entries[entries.length - 1][1];
    const fields: Array<[string, 1 | -1]> = [...entries, ["_id", tieDir]];

    for (const [field] of fields) {
      if (!(field in cursorValues)) return null;
      const value = cursorValues[field];
      if (value === undefined || value === null) return null;
    }

    const orConditions: Record<string, any>[] = [];
    let equality: Record<string, any> = {};

    for (const [field, dir] of fields) {
      const op = dir === -1 ? "$lt" : "$gt";
      orConditions.push({
        ...equality,
        [field]: { [op]: cursorValues[field] },
      });
      equality = { ...equality, [field]: cursorValues[field] };
    }

    return { $or: orConditions };
  };

  const attachLatestChapterTitles = async (docs: any[]) => {
    const withId = normalizeMangaList(docs as any[]);
    try {
      const ids = withId.map((m) => String((m as any).id ?? (m as any)._id));
      const titles = await getLatestChapterTitlesForMangaIds(ids);
      return withId.map((m) => ({
        ...(m as any),
        latestChapterTitle: titles[String((m as any).id ?? (m as any)._id)] ?? null,
      }));
    } catch {
      return withId;
    }
  };

  const skip = (page - 1) * limit;
  const normalizedQuery = withContentType(query);

  if (keyword) {
    const mangas = await MangaModel.find(
      {
        $text: { $search: keyword },
        status: MANGA_STATUS.APPROVED,
        ...normalizedQuery,
      },
      { score: { $meta: "textScore" } },
    )
      .sort({ score: { $meta: "textScore" } })
      .skip(skip)
      .limit(limit)
      .lean();

    if (mangas.length === 0 && Number.isInteger(Number(keyword))) {
      const byCode = await MangaModel.find({
        code: keyword,
        status: MANGA_STATUS.APPROVED,
        ...normalizedQuery,
      }).lean();
      return await attachLatestChapterTitles(byCode as any[]);
    }
    return await attachLatestChapterTitles(mangas as any[]);
  }

  const effectiveSort = sort ?? { createdAt: -1 };
  const seekFilter = cursor ? buildSeekFilter(effectiveSort, cursor) : null;
  const baseFilter: Record<string, any> = {
    status: MANGA_STATUS.APPROVED,
    ...normalizedQuery,
  };
  if (seekFilter) {
    Object.assign(baseFilter, seekFilter);
  }

  const queryBuilder = MangaModel.find(baseFilter)
    .sort(effectiveSort)
    .limit(limit)
    .lean();

  const docs = seekFilter ? await queryBuilder : await queryBuilder.skip(skip);
  return await attachLatestChapterTitles(docs as any[]);
};

export const getRelatedManga = async (manga: MangaType, limit: number = 10) => {
  const desiredContentType = manga.contentType ?? MANGA_CONTENT_TYPE.MANGA;
  const includeLegacyNull = desiredContentType === MANGA_CONTENT_TYPE.MANGA;
  const docs = await MangaModel.find({
    $or: [
      { genres: { $in: manga.genres } },
      { ownerId: manga.ownerId },
      { author: manga.author },
    ],
    status: MANGA_STATUS.APPROVED,
    contentType: buildContentTypeFilter(desiredContentType, includeLegacyNull),
    _id: { $ne: manga.id },
  })
    .limit(limit)
    .lean();
  return normalizeMangaList(docs as any[]);
};

// Lấy tối đa `limit` truyện cùng tác giả (nếu có trường author), loại trừ truyện hiện tại
export const getMangaBySameAuthor = async (
  author: string | undefined,
  excludeId: string,
  limit: number = 4,
  options?: {
    requireApproved?: boolean;
    contentType?: MangaContentType;
    // Fallback for cases where `author` is empty (e.g. cosplay posts):
    // show other items from the same uploader.
    fallbackToOwnerId?: boolean;
    ownerId?: string;
  },
) => {
  const canFallbackToOwner = Boolean(options?.fallbackToOwnerId && options?.ownerId);
  if (!author && !canFallbackToOwner) return [] as MangaType[];

  // If author is missing but fallback is allowed, use ownerId.
  if (!author && canFallbackToOwner) {
    const filter: Record<string, any> = {
      _id: { $ne: excludeId },
      ownerId: String(options!.ownerId),
    };
    if (options?.requireApproved !== false) {
      filter.status = MANGA_STATUS.APPROVED;
    }
    if (options?.contentType) {
      filter.contentType = buildContentTypeFilter(
        options.contentType,
        options.contentType === MANGA_CONTENT_TYPE.MANGA,
      );
    } else if (options?.requireApproved !== false) {
      filter.contentType = buildContentTypeFilter(MANGA_CONTENT_TYPE.MANGA);
    }

    const docs = await MangaModel.find(filter)
      .sort({ updatedAt: -1 })
      .limit(limit + 5)
      .lean();

    const seen = new Set<string>();
    const unique: MangaType[] = [];
    for (const d of docs) {
      const id = String((d as any)?.id ?? (d as any)?._id ?? "");
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(d as MangaType);
      if (unique.length >= limit) break;
    }

    const withId = normalizeMangaList(unique);
    try {
      const ids = withId.map((m) => String((m as any).id ?? (m as any)._id));
      const titles = await getLatestChapterTitlesForMangaIds(ids);
      return withId.map((m) => ({
        ...(m as any),
        latestChapterTitle: titles[String((m as any).id ?? (m as any)._id)] ?? null,
      }));
    } catch (e) {
      return withId;
    }
  }

  // Tách toàn bộ danh sách tên "A, B, C" -> match bất kỳ tên nào (thay vì chỉ tên đầu)
  const names = String(author)
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0);
  if (names.length === 0) return [] as MangaType[];

  // Tạo mảng điều kiện $or với regex khớp nguyên tên giữa các dấu phẩy (không ăn nhầm substring)
  const orConds = names.map((name) => {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return { author: new RegExp(`(?:^|,\\s*)${escaped}(?:\\s*,|$)`, "i") };
  });

  const filter: Record<string, any> = {
    _id: { $ne: excludeId },
    $or: orConds,
  };
  if (options?.requireApproved !== false) {
    filter.status = MANGA_STATUS.APPROVED;
  }
  if (options?.contentType) {
    filter.contentType = buildContentTypeFilter(
      options.contentType,
      options.contentType === MANGA_CONTENT_TYPE.MANGA,
    );
  } else if (options?.requireApproved !== false) {
    filter.contentType = buildContentTypeFilter(MANGA_CONTENT_TYPE.MANGA);
  }
  const docs = await MangaModel.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit + 5) // lấy dư chút để dedupe trước khi slice
    .lean();

  // Deduplicate & slice
  const seen = new Set<string>();
  const unique: MangaType[] = [];
  for (const d of docs) {
    const id = String((d as any)?.id ?? (d as any)?._id ?? "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    unique.push(d as MangaType);
    if (unique.length >= limit) break;
  }
  // Denormalize latest chapter titles for returned list
  // Bảo đảm mỗi item có id ổn định
  const withId = normalizeMangaList(unique);
  try {
    const ids = withId.map((m) => String((m as any).id ?? (m as any)._id));
    const titles = await getLatestChapterTitlesForMangaIds(ids);
    return withId.map((m) => ({ ...(m as any), latestChapterTitle: titles[String((m as any).id ?? (m as any)._id)] ?? null }));
  } catch (e) {
    return withId;
  }
};



// Gợi ý truyện theo overlap giữa genres của truyện và danh sách nổi bật.
// - Lấy các genre của manga thuộc FEATURED_GENRE_SLUGS
// - Tìm truyện có chứa TẤT CẢ các genre đó ($all) để bảo đảm độ liên quan cao
// - Giới hạn `limit` (mặc định 5), loại trừ chính truyện hiện tại
export const getRecommendedByFeaturedGenres = async (
  manga: MangaType,
  limit: number = 5,
) => {
  const desiredContentType = manga.contentType ?? MANGA_CONTENT_TYPE.MANGA;
  const includeLegacyNull = desiredContentType === MANGA_CONTENT_TYPE.MANGA;
  // Chiến lược:
  // 1. Lấy các genres của manga xuất hiện trong FEATURED_GENRE_SLUGS (giữ thứ tự gốc của manga để phản ánh mức độ quan trọng do uploader chọn trước).
  // 2. Tìm truyện chứa TẤT CẢ các genres đó ($all).
  // 3. Nếu chưa đủ limit -> loại bỏ lần lượt genre đầu tiên (ví dụ [a,b,c,d] -> [b,c,d] -> [c,d] -> [d])
  // 4. Dừng khi đủ 'limit' hoặc còn 1 genre (không bỏ thêm được).
  // 5. Loại trừ truyện hiện tại & tránh trùng lặp.
  // Lý do bỏ từ đầu: các genre xuất hiện sớm thường broad hơn; giữ lại phần sau giúp kết quả vẫn mang sắc thái đặc thù.
  const currentGenres = normalizeGenreSlugs(manga.genres || []);
  // Lấy các genres của truyện có trong danh sách nổi bật, giữ nguyên thứ tự xuất hiện trên manga
  let required = currentGenres.filter((g) => FEATURED_GENRE_SLUGS.has(g));

  if (required.length === 0) return [] as MangaType[];

  const results: MangaType[] = [] as any;
  const seen = new Set<string>();

  // Một số slug có thể tồn tại dưới dạng alias trong DB (do dữ liệu lịch sử/seed khác nhau).
  // Query theo nhóm để tránh trường hợp normalize -> slug canonical nhưng DB lại lưu alias.
  const genreAliases = (slug: string): string[] => {
    const s = String(slug || "").toLowerCase();
    if (!s) return [];

    // Canonical <-> legacy aliases
    if (s === "anh-cosplay" || s === "cosplay") return ["anh-cosplay", "cosplay"];
    if (s === "blowjobs" || s === "blowjob") return ["blowjobs", "blowjob"];

    return [s];
  };

  // Helper: thêm vào results tránh trùng
  const pushUnique = (docs: any[]) => {
    for (const d of docs) {
      const id = String((d as any)?.id ?? (d as any)?._id ?? "");
      if (!id || id === String(manga.id) || seen.has(id)) continue;
      seen.add(id);
      results.push(d as MangaType);
      if (results.length >= limit) break;
    }
  };

  // Vòng lặp fallback: nếu chưa đủ, lần lượt bỏ 1 genre ở đầu và thử lại
  // Ví dụ: [mother, milf, nun, nurse] -> thử 4, thiếu -> thử [milf, nun, nurse] -> thiếu -> [nun, nurse] -> ...
  while (required.length >= 1 && results.length < limit) {
    const andGenres = required
      .map((g) => genreAliases(g))
      .filter((alts) => alts.length > 0)
      .map((alts) => ({ genres: { $in: alts } }));

    const batch = await MangaModel.find({
      status: MANGA_STATUS.APPROVED,
      _id: { $ne: manga.id },
      ...(andGenres.length > 0 ? { $and: andGenres } : { genres: { $all: required } }),
      contentType: buildContentTypeFilter(desiredContentType, includeLegacyNull),
    })
      .sort({ updatedAt: -1 })
      .limit(limit - results.length)
      .lean();

    pushUnique(batch);

    if (results.length >= limit) break;
    if (required.length === 1) break; // không thể bỏ thêm nữa
    // Bỏ bớt 1 genre ở đầu danh sách (ưu tiên giữ các genre phía sau)
    required = required.slice(1);
  }

  // Denormalize latest chapter titles for returned recommendations
  // Chuẩn hóa id rồi đính kèm latestChapterTitle
  const withId = normalizeMangaList(results);
  try {
    const ids = withId.map((m) => String((m as any).id ?? (m as any)._id));
    const titles = await getLatestChapterTitlesForMangaIds(ids);
    return withId.map((m) => ({ ...(m as any), latestChapterTitle: titles[String((m as any).id ?? (m as any)._id)] ?? null }));
  } catch (e) {
    return withId;
  }
};

export const getMangaPublishedById = async (handle: string, user?: UserType) => {
  const manga = await resolveMangaHandle(handle);

  const attachAuthorMangaCounts = async (doc: any) => {
    if (!doc || typeof doc !== "object") return doc;
    const slugsRaw = Array.isArray((doc as any)?.authorSlugs) ? ((doc as any).authorSlugs as unknown[]) : [];
    const slugs = Array.from(
      new Set(
        slugsRaw
          .map((s) => String(s ?? "").trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    if (slugs.length === 0) return doc;

    // Count approved stories for each author slug (canonical field).
    const rows = await MangaModel.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          status: MANGA_STATUS.APPROVED,
          contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, MANGA_CONTENT_TYPE.COSPLAY, null] },
          authorSlugs: { $in: slugs },
        },
      },
      { $unwind: "$authorSlugs" },
      { $match: { authorSlugs: { $in: slugs } } },
      { $group: { _id: "$authorSlugs", count: { $sum: 1 } } },
    ]).catch(() => []);

    const map: Record<string, number> = {};
    for (const slug of slugs) map[slug] = 0;
    for (const r of rows) {
      const k = String((r as any)?._id ?? "").toLowerCase();
      if (k) map[k] = Number((r as any)?.count ?? 0) || 0;
    }
    (doc as any).authorMangaCountBySlug = map;
    return doc;
  };

  const normalize = (doc: any) => {
    return normalizeMangaMedia(doc);
  };

  if (manga?.status === MANGA_STATUS.APPROVED) {
    const doc = await attachAuthorMangaCounts(manga);
    return normalize(doc);
  }

  if (manga?.ownerId === user?.id || isAdmin(user?.role || "")) {
    const doc = await attachAuthorMangaCounts(manga);
    return normalize(doc);
  }

  return null;
};

export const getMangaByIdAndOwner = async (
  handle: string,
  ownerId: string,
  isAdmin: boolean = false,
) => {
  const doc = await resolveMangaHandle(handle);
  if (!doc) return null;
  if (!isAdmin && String(doc.ownerId) !== String(ownerId)) return null;

  return { ...(doc as any), id: String((doc as any).id ?? (doc as any)._id ?? "") } as any;
};
