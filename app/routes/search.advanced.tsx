import { useMemo, useState } from "react";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { useLoaderData, useSearchParams } from "react-router-dom";

import { getAllGenres } from "@/queries/genres.query";
import { getTotalMangaCount, searchMangaApprovedWithPagination } from "@/queries/manga.query";
import { Dropdown } from "~/components/dropdown";
import { GenreGridPicker } from "~/components/genre-grid-picker";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import { MANGA_CONTENT_TYPE, MANGA_STATUS, MANGA_USER_STATUS } from "~/constants/manga";
import type { GenresType } from "~/database/models/genres.model";
import type { MangaType } from "~/database/models/manga.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Tìm kiếm nâng cao | WW" },
    { name: "description", content: "Lọc truyện theo trạng thái và thể loại" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = 18;

  // Nếu chưa có tham số áp dụng (apply=1) → chỉ tải danh sách thể loại, không truy vấn manga
  const isApplied = url.searchParams.get("apply") === "1";
  const q = url.searchParams.get("q") || "";
  const sortParam = url.searchParams.get("sort") || "updatedAt"; // updatedAt | oldest | viewNumber | likeNumber | completed
  const statuses = new Set((url.searchParams.get("status") || "").split(",").filter(Boolean));
  // Back-compat: old param `genres` is treated as includeGenres
  const includeGenres = (url.searchParams.get("includeGenres") || url.searchParams.get("genres") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const excludeGenres = (url.searchParams.get("excludeGenres") || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const [genresList] = await Promise.all([getAllGenres()]);

  if (!isApplied) {
    return { genresList, manga: [], totalPages: 0, currentPage: 1, sort: sortParam, isApplied: false };
  }

  const query: Record<string, any> = {
    status: MANGA_STATUS.APPROVED,
    contentType: { $in: [MANGA_CONTENT_TYPE.MANGA, null] },
  };

  if (statuses.has("completed")) query.userStatus = MANGA_USER_STATUS.COMPLETED;
  else if (statuses.has("ongoing")) query.userStatus = MANGA_USER_STATUS.ON_GOING;

  const includeList = [...includeGenres];
  if (statuses.has("oneshot")) includeList.push("oneshot");
  const includeUniq = Array.from(new Set(includeList));
  const excludeUniq = Array.from(new Set(excludeGenres));

  if (includeUniq.length && excludeUniq.length) {
    query.genres = { $all: includeUniq, $nin: excludeUniq };
  } else if (includeUniq.length) {
    query.genres = { $all: includeUniq };
  } else if (excludeUniq.length) {
    query.genres = { $nin: excludeUniq };
  }

  let sort: Record<string, 1 | -1> | undefined;
  switch (sortParam) {
    case "viewNumber":
      sort = { viewNumber: -1 };
      break;
    case "likeNumber":
      sort = { likeNumber: -1 };
      break;
    case "completed":
      query.userStatus = MANGA_USER_STATUS.COMPLETED;
      sort = { updatedAt: -1 };
      break;
    case "oldest":
      sort = { updatedAt: 1 };
      break;
    case "updatedAt":
    default:
      sort = { updatedAt: -1 };
      break;
  }

  const [manga, total] = await Promise.all([
    searchMangaApprovedWithPagination({ keyword: q || undefined, page, limit, query, sort }),
    getTotalMangaCount({ searchTerm: q || undefined, query }),
  ]);
  const totalPages = Math.ceil(total / limit);
  return { genresList, manga, totalPages, currentPage: page, sort: sortParam, isApplied: true };
}

export default function AdvancedSearchPage() {
  const { genresList, manga, totalPages, currentPage, isApplied } = useLoaderData<{
    genresList: GenresType[];
    manga: MangaType[];
    totalPages: number;
    currentPage: number;
    isApplied: boolean;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Local staging state (chưa áp dụng)
  const initialName = searchParams.get("q") || "";
  const initialStatuses = new Set(
    (searchParams.get("status") || "").split(",").filter(Boolean)
  );
  const initialIncludeGenres = new Set(
    ((searchParams.get("includeGenres") || searchParams.get("genres") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean))
  );
  const initialExcludeGenres = new Set(
    (searchParams.get("excludeGenres") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
  );
  const sortParam = searchParams.get("sort") || "updatedAt";

  const [name, setName] = useState(initialName);
  const [draftStatuses, setDraftStatuses] = useState<Set<string>>(initialStatuses);
  const [draftIncludeGenres, setDraftIncludeGenres] = useState<Set<string>>(initialIncludeGenres);
  const [draftExcludeGenres, setDraftExcludeGenres] = useState<Set<string>>(initialExcludeGenres);
  const [showExclude, setShowExclude] = useState<boolean>(initialExcludeGenres.size > 0);

  const toggleStatus = (key: "ongoing" | "completed" | "oneshot") => {
    setDraftStatuses((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleIncludeGenre = (slug: string) => {
    setDraftIncludeGenres((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
    // Không cho trùng include/exclude
    setDraftExcludeGenres((prev) => {
      if (!prev.has(slug)) return prev;
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  };

  const toggleExcludeGenre = (slug: string) => {
    setDraftExcludeGenres((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });
    // Không cho trùng include/exclude
    setDraftIncludeGenres((prev) => {
      if (!prev.has(slug)) return prev;
      const next = new Set(prev);
      next.delete(slug);
      return next;
    });
  };

  const applyFilters = () => {
    setSearchParams((prev) => {
      if (name.trim()) prev.set("q", name.trim());
      else prev.delete("q");
      prev.set("status", Array.from(draftStatuses).join(","));
      prev.set("includeGenres", Array.from(draftIncludeGenres).join(","));
      prev.set("excludeGenres", Array.from(draftExcludeGenres).join(","));
      // cleanup legacy param
      prev.delete("genres");
      prev.set("apply", "1");
      prev.set("page", "1");
      return prev;
    });
  };

  const handleSortChange = (value: string) => {
    setSearchParams((prev) => {
      prev.set("sort", value);
      prev.set("page", "1");
      prev.set("apply", "1");
      return prev;
    });
  };

  const handlePageChange = (page: number) => {
    setSearchParams((prev) => {
      prev.set("page", String(page));
      prev.set("apply", "1");
      return prev;
    });
  };

  // Fast lookup for genres (stable ordering)
  const genresAZ = useMemo(() => {
    const list = Array.isArray(genresList) ? genresList.slice() : [];
    return list.sort((a, b) => (a.name || "").localeCompare(b.name || "", "vi"));
  }, [genresList]);

  return (
    <div className="container-page mx-auto px-4 py-6">
      <h1 className="text-txt-primary mb-3 text-3xl font-semibold">Tìm kiếm nâng cao</h1>
      <div className="h-1.5 w-20 bg-fuchsia-400 mb-6" />

      {/* Name input */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <input
          type="text"
          placeholder="Nhập tên truyện (không bắt buộc)"
          className="bg-bgc-layer2 text-txt-primary w-full max-w-xl rounded-xl px-3 py-2 outline-none placeholder:text-txt-secondary"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      {/* Status checkboxes (không query ngay, chỉ staging) */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-txt-primary">
          <input
            type="checkbox"
            className="accent-fuchsia-400"
            checked={draftStatuses.has("ongoing")}
            onChange={() => toggleStatus("ongoing")}
          />
          Đang tiến hành
        </label>
        <label className="flex items-center gap-2 text-sm text-txt-primary">
          <input
            type="checkbox"
            className="accent-fuchsia-400"
            checked={draftStatuses.has("completed")}
            onChange={() => toggleStatus("completed")}
          />
          Đã hoàn thành
        </label>
        <label className="flex items-center gap-2 text-sm text-txt-primary">
          <input
            type="checkbox"
            className="accent-fuchsia-400"
            checked={draftStatuses.has("oneshot")}
            onChange={() => toggleStatus("oneshot")}
          />
          Oneshot
        </label>
      </div>

      {/* Genres selector (staging) */}
      <div className="mb-4">
        <div className="mb-2 text-sm text-txt-secondary">Thể loại (bao gồm)</div>
        <GenreGridPicker
          genres={genresAZ}
          selectedSlugs={draftIncludeGenres}
          onToggle={toggleIncludeGenre}
          showLetterNav={false}
          placeholder="Có thể nhập nhiều từ khóa cùng lúc để tìm"
          helperText={
            <>
              Gõ <b>a,b,c…</b> để lọc theo chữ đầu; gõ <b>nhiều từ khóa</b> để tìm nhanh.
            </>
          }
        />

        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowExclude((v) => !v)}
            className="rounded-lg border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm font-semibold text-txt-primary hover:bg-white/5"
          >
            Chọn thể loại muốn loại trừ{draftExcludeGenres.size ? ` (${draftExcludeGenres.size})` : ""}
          </button>
        </div>

        {showExclude ? (
          <div className="mt-3">
            <div className="mb-2 text-sm text-txt-secondary">Thể loại (loại trừ)</div>
            <GenreGridPicker
              genres={genresAZ}
              selectedSlugs={draftExcludeGenres}
              onToggle={toggleExcludeGenre}
              showLetterNav={false}
              placeholder="Có thể nhập nhiều từ khóa cùng lúc để tìm"
              helperText={
                <>
                  Truyện có <b>bất kỳ</b> thể loại trong danh sách này sẽ bị loại khỏi kết quả.
                </>
              }
            />
          </div>
        ) : null}
      </div>

      {/* Apply button moved below genres */}
      <div className="mb-8">
        <button
          onClick={applyFilters}
          className="rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-6 py-3 text-sm font-semibold text-black shadow-lg transition-opacity hover:opacity-90"
        >
          Áp dụng bộ lọc
        </button>
        {!isApplied && (
          <p className="mt-2 text-xs text-txt-secondary">Bấm "Áp dụng bộ lọc" để xem kết quả.</p>
        )}
      </div>

      {/* Sort and results header */}
      <div className="mb-3 mt-2 flex items-center justify-between">
        <h2 className="text-txt-primary text-xl font-semibold">Kết quả</h2>
        <div className="flex items-center gap-2">
          <span className="text-txt-secondary text-sm">Sắp xếp theo:</span>
          <div className="w-64">
            <Dropdown
              options={[
                { value: "updatedAt", label: "Mới cập nhật" },
                { value: "oldest", label: "Cũ nhất" },
                { value: "viewNumber", label: "Đọc nhiều" },
                { value: "likeNumber", label: "Được yêu thích" },
                { value: "completed", label: "Đã hoàn thành" },
              ]}
              value={sortParam}
              onSelect={(v) => handleSortChange(String(v))}
            />
          </div>
        </div>
      </div>

      {/* Results grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {manga.length === 0 && isApplied && (
          <div className="col-span-full text-center text-sm text-txt-secondary">
            Không tìm thấy truyện nào phù hợp.
          </div>
        )}
        {manga.map((item) => (
          <MangaCard key={String((item as any).id || (item as any)._id)} manga={item} />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}
    </div>
  );
}
