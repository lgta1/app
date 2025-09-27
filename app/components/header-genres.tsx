// app/components/header-genres.tsx
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

import type { GenresType } from "~/database/models/genres.model";

interface HeaderGenresProps {
  genres: GenresType[];
}

function normalizeVN(s: string) {
  return (
    (s || "")
      .normalize("NFD")
      // Khử dấu bằng Unicode property để hỗ trợ đầy đủ tiếng Việt
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim()
  );
}

export function HeaderGenres({ genres }: HeaderGenresProps) {
  const [open, setOpen] = useState(false);

  // 🔎 DEBUG: in ra TV (Header) đang nhận bao nhiêu kênh từ đài + có bondage/slave không
  // (Không ảnh hưởng logic; chỉ hỗ trợ kiểm tra)
  try {
    // eslint-disable-next-line no-console
    console.log(
      "[ui:header] genres =",
      Array.isArray(genres) ? genres.length : 0,
      "| bondage:",
      Array.isArray(genres) && genres.some((g: any) => g?.slug === "bondage"),
      "| slave:",
      Array.isArray(genres) && genres.some((g: any) => g?.slug === "slave")
    );
  } catch (_) {
    // ignore
  }

  // BEGIN <feature> GENRES_AZ_FLAT_PIN_ONESHOT_HEADER
  const sorted = useMemo(() => {
    // tạo bản sao mảng, tránh mutate props
    const arr = (genres || []).map((g) => ({ ...g }));

    // Chuẩn hóa Title Case để hiển thị đồng nhất (không ảnh hưởng sort vì sort dùng normalizeVN)
    arr.forEach((g) => {
      if (g?.name) {
        const parts = g.name.split(" ");
        g.name = parts
          .map((p) => (p.length ? p[0].toLocaleUpperCase() + p.slice(1) : p))
          .join(" ");
      }
    });

    // Sắp xếp: Oneshot đứng đầu, phần còn lại A–Z (khử dấu)
    arr.sort((a, b) => {
      const aIsOne =
        normalizeVN(a.name) === "oneshot" || (a as any).slug === "oneshot";
      const bIsOne =
        normalizeVN(b.name) === "oneshot" || (b as any).slug === "oneshot";
      if (aIsOne && !bIsOne) return -1;
      if (!aIsOne && bIsOne) return 1;

      const an = normalizeVN(a.name);
      const bn = normalizeVN(b.name);
      return an.localeCompare(bn);
    });

    return arr;
  }, [genres]);

  // Ô tìm kiếm: chỉ lọc theo CHỮ CÁI ĐẦU TIÊN (không phải "chứa chuỗi")
  const [q, setQ] = useState("");

  // Lọc theo chữ cái đầu (đã khử dấu). Nếu không nhập gì -> trả về toàn bộ.
  const filteredByFirstLetter = useMemo(() => {
    const letter = normalizeVN(q).trim().charAt(0); // lấy ký tự đầu
    if (!letter) return sorted;
    return sorted.filter((g) => {
      const first = normalizeVN((g as any).name || "").charAt(0);
      return first === letter;
    });
  }, [sorted, q]);

  // Danh sách tên cần ép vào nhóm '#'
  const forceHash = useMemo(() => {
    return new Set([
      "full color",
      "oneshot",
      "3d hentai",
    ]);
  }, []);

  // Gom nhóm theo chữ cái đầu để render
  // Yêu cầu: nhóm '#' đứng đầu và BA mục trên nằm trong '#' KHI q rỗng (không đang tìm kiếm).
  const grouped: Array<[string, GenresType[]]> = useMemo(() => {
    const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const map: Record<string, GenresType[]> = {};

    for (const g of filteredByFirstLetter) {
      const name = (g as any).name || "";
      const normalized = normalizeVN(name);
      const first = (normalized[0] || "#").toUpperCase();

      // Khi không nhập tìm kiếm: ép vào '#'
      const useHash = !q && forceHash.has(normalized);

      const key = useHash ? "#" : (AZ.includes(first) ? first : "#");
      (map[key] ||= []).push(g);
    }

    const ordered: Array<[string, GenresType[]]> = [];
    // Đặt '#' lên đầu trước
    if (map["#"]?.length) ordered.push(["#", map["#"]]);
    // Sau đó mới tới A-Z
    for (const L of AZ) if (map[L]?.length) ordered.push([L, map[L]]);
    return ordered;
  }, [filteredByFirstLetter, q, forceHash]);
  // END <feature> GENRES_AZ_FLAT_PIN_ONESHOT_HEADER

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <div className="flex cursor-pointer items-center justify-start gap-1">
          <div className="text-txt-primary text-sm leading-normal font-semibold">
            Thể loại
          </div>
          <ChevronDown className="text-txt-primary h-3 w-3" />
        </div>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="bg-bgc-layer1 border-bd-default data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-[99999] w-[100vw] rounded-xl border p-4 shadow-lg will-change-[transform,opacity] sm:w-full sm:max-w-[95vw] md:w-[640px]"
          sideOffset={8}
          align="center"
        >
          {/* BEGIN <feature> GENRES_AZ_FLAT_PIN_ONESHOT_BODY */}
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-txt-focus font-sans text-base font-semibold">
              Thể loại
            </div>

            {/* Ô tìm kiếm (lọc theo chữ cái đầu tiên, khử dấu) */}
            <label className="relative w-full max-w-[360px]">
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
                placeholder="Nhập chữ cái đầu… (vd: a, b, c)"
                className="w-full rounded-md border border-bd-default bg-bgc-layer2 pl-8 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>

          {/* Danh sách: cố định 3 cột ở mọi breakpoint */}
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-4">
              {grouped.map(([letter, items]) => (
                <div key={letter}>
                  {/* header nhóm */}
                  <div className="mb-2 flex items-center gap-2">
                    <div className="text-sm font-bold text-txt-focus">{letter}</div>
                    <div className="h-px flex-1 bg-bd-default/60" />
                  </div>

                  {/* Lưới CỐ ĐỊNH 3 cột (không auto-fit) */}
                  <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                    {items.map((genre) => {
                      const name = (genre as any).name as string;
                      return (
                        <Link
                          key={
                            (genre as any)._id?.toString?.() ||
                            (genre as any).id ||
                            (genre as any).slug
                          }
                          to={`/genres/${(genre as any).slug}`}
                          className="block break-inside-avoid py-1"
                          onClick={() => setOpen(false)}
                        >
                          <div className="text-txt-primary hover:text-txt-focus text-xs font-medium">
                            <span className="font-bold">{name.slice(0, 1)}</span>
                            {name.slice(1)}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Không có kết quả */}
              {grouped.length === 0 && (
                <div className="text-sm text-txt-secondary">Không có thể loại phù hợp.</div>
              )}
            </div>
          </div>
          {/* END <feature> GENRES_AZ_FLAT_PIN_ONESHOT_BODY */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
