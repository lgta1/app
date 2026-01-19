// app/components/header-genres.tsx
import { useMemo, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, X } from "lucide-react";

import type { GenresType } from "~/database/models/genres.model";

const PINNED_GENRE_SLUGS = ["3d-hentai", "manhwa", "anh-cosplay"] as const;
const PINNED_GENRE_SET: Set<string> = new Set(PINNED_GENRE_SLUGS);

interface HeaderGenresProps {
  genres: GenresType[];
}

// Khử dấu cho VN (tránh Unicode Property Escapes để tương thích mobile cũ)
const foldVN = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim();

export function HeaderGenres({ genres }: HeaderGenresProps) {
  const [open, setOpen] = useState(false);

  const debugTap = (msg: string, extra?: Record<string, unknown>) => {
    try {
      const qs = window.location?.search || "";
      const enabled =
        /(?:^|[?&])debug=1(?:&|$)/.test(qs) || localStorage.getItem("vh_debug_overlay") === "1";
      if (!enabled) return;
      // eslint-disable-next-line no-console
      console.debug(
        `[genres-dropdown] ${msg}`,
        {
          t: Math.round(performance.now()),
          hydrated: Boolean((window as any).__APP_HYDRATED__),
          ...extra,
        },
      );
    } catch {}
  };

  // BEGIN unify with MangaCreate genre search
  const [q, setQ] = useState("");
  const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  // Deduplicate and sort A–Z by folded name
  const sortedGenres: GenresType[] = useMemo(() => {
    const list = Array.isArray(genres) ? genres.slice() : [];
    const uniq = new Map<string, GenresType>();
    for (const g of list) {
      const slug = (g as any)?.slug;
      const name = (g as any)?.name;
      if (!slug || !name) continue;
      if (!uniq.has(slug)) uniq.set(slug, g);
    }
    const alphabetical = Array.from(uniq.values()).sort((a, b) => {
      const aa = foldVN((a as any).name || "");
      const bb = foldVN((b as any).name || "");
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return 0;
    });

    if (!alphabetical.length) {
      return alphabetical;
    }

    const pinnedLookup = new Map<string, GenresType>();
    for (const item of alphabetical) {
      const slug = ((item as any)?.slug || "") as string;
      if (PINNED_GENRE_SET.has(slug)) {
        pinnedLookup.set(slug, item);
      }
    }

    const pinnedOrdered = PINNED_GENRE_SLUGS.map((slug) => pinnedLookup.get(slug)).filter(Boolean) as GenresType[];
    const remainder = alphabetical.filter((item) => !PINNED_GENRE_SET.has((((item as any)?.slug) || "") as string));

    return [...pinnedOrdered, ...remainder];
  }, [genres]);

  // Tokenize query by spaces or commas
  const tokens: string[] = useMemo(
    () => foldVN(q).split(/[\s,]+/).filter(Boolean) as string[],
    [q]
  );

  // If only single letters typed, filter by first letters; else match any token in name/slug
  const filtered: GenresType[] = useMemo(() => {
    if (!tokens.length) return sortedGenres;

    const onlySingleLetters = tokens.every((t: string) => /^[a-z]$/.test(t));
    if (onlySingleLetters) {
      const L = new Set(tokens.map((t: string) => t.toUpperCase()));
      return sortedGenres.filter((g: GenresType) =>
        L.has((foldVN((g as any).name || "")[0] || "#").toUpperCase()),
      );
    }

    return sortedGenres.filter((g: GenresType) => {
      const hay = `${foldVN((g as any).name || "")} ${(((g as any).slug as string) || "").toLowerCase()}`;
      return tokens.some((t: string) => hay.includes(t));
    });
  }, [sortedGenres, tokens]);

  // Group: '#' first then A–Z
  const grouped: Array<[string, GenresType[]]> = useMemo(() => {
    const map: Record<string, GenresType[]> = {};
    for (const g of filtered) {
      const slug = (((g as any)?.slug) || "") as string;
      const first = (foldVN((g as any).name || "")[0] || "#").toUpperCase();
      const key = PINNED_GENRE_SET.has(slug) ? "#" : AZ.includes(first) ? first : "#";
      (map[key] ||= []).push(g);
    }
    const out: Array<[string, GenresType[]]> = [];
    if (map["#"]?.length) out.push(["#", map["#"]]);
    for (const L of AZ) if (map[L]?.length) out.push([L, map[L]]);
    return out;
  }, [filtered, AZ]);
  // END unify with MangaCreate genre search

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        {/* ⬇️ Thêm responsive font cho trigger: to hơn từ laptop/desktop */}
        <button
          type="button"
          className="flex items-center justify-start gap-1 text-sm lg:text-[17px] whitespace-nowrap touch-manipulation"
          onPointerDown={() => debugTap("trigger pointerdown")}
          onClick={() => debugTap("trigger click")}
        >
          <div className="text-txt-primary text-sm lg:text-[17px] leading-tight font-semibold whitespace-nowrap text-outline-purple">
            Thể loại
          </div>
          <span className="inline-flex text-outline-purple-thin lg:text-outline-purple">
            <ChevronDown className="text-txt-primary h-3 w-3 lg:h-4 lg:w-4" />
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-bgc-layer1 border-bd-default data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-[99999] w-[100vw] rounded-xl border p-4 shadow-lg will-change-[transform,opacity] sm:w-full sm:max-w-[95vw] md:w-[640px] max-h-[80svh] overflow-hidden flex flex-col"
          sideOffset={8}
          align="center"
          // Tắt tự focus khi mở để không bật bàn phím trên mobile
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header: ô tìm + nút X đóng */}
          <div className="mb-3 flex items-center justify-between gap-3">
            {/* Ô tìm kiếm (lọc theo chữ cái đầu) */}
            <label className="relative w-full">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Có thể nhập nhiều từ khóa cùng lúc… (vd: manhwa color series)"
                className="w-full rounded-md border border-bd-default bg-bgc-layer2 pl-8 pr-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
              />
            </label>

            {/* Nút đóng ở góc phải */}
            <Popover.Close asChild>
              <button
                type="button"
                aria-label="Đóng"
                className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md border border-bd-default bg-bgc-layer2 hover:bg-bgc-layer3"
              >
                <X className="h-4 w-4" />
              </button>
            </Popover.Close>
          </div>

          {/* Danh sách: chiếm phần còn lại & cuộn chuẩn, không bị cắt đáy */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-2 pb-2">
            <div className="space-y-4">
              {grouped.map(([letter, items]) => (
                <div key={letter}>
                  {/* header nhóm */}
                  <div className="mb-2 flex items-center gap-2">
                    <div className="text-sm font-bold text-txt-focus">{letter}</div>
                    <div className="h-px flex-1 bg-bd-default/60" />
                  </div>

                  {/* Lưới CỐ ĐỊNH 3 cột */}
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    {items.map((genre) => {
                      const name = (genre as any).name as string;
                      const slug = (genre as any).slug as string;
                      const href = `/genres/${slug}`;
                      const key =
                        (genre as any)._id?.toString?.() || (genre as any).id || slug;
                      return (
                        <a
                          key={key}
                          href={href}
                          className="block break-inside-avoid py-1 touch-manipulation [touch-action:manipulation]"
                          title={((genre as any).description as string) || undefined}
                          onPointerDown={() => debugTap("item pointerdown", { href })}
                          onClick={() => {
                            debugTap("item click", { href });
                            setOpen(false);
                          }}
                        >
                          <div className="text-txt-primary hover:text-txt-focus text-xs [@media(min-width:427px)]:text-[15px] sm:text-[15px] font-medium">
                            <span className="font-bold">{name.slice(0, 1)}</span>
                            {name.slice(1)}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Không có kết quả */}
              {grouped.length === 0 && (
                <div className="text-sm text-txt-secondary">
                  Không có thể loại phù hợp.
                </div>
              )}
            </div>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
