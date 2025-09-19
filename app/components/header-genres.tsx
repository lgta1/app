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
      const aIsOne = normalizeVN(a.name) === "oneshot" || (a as any).slug === "oneshot";
      const bIsOne = normalizeVN(b.name) === "oneshot" || (b as any).slug === "oneshot";
      if (aIsOne && !bIsOne) return -1;
      if (!aIsOne && bIsOne) return 1;

      const an = normalizeVN(a.name);
      const bn = normalizeVN(b.name);
      return an.localeCompare(bn);
    });

    return arr;
  }, [genres]);
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
          <div className="text-txt-focus mb-3 font-sans text-base font-semibold">
            Thể loại
          </div>

          {/* Danh sách: mobile 3 cột cố định; từ sm trở lên auto-fit; có scroll để không bị cắt số lượng */}
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-3 gap-x-4 gap-y-2 sm:[grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
              {sorted.map((genre) => (
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
                    {(genre as any).name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          {/* END <feature> GENRES_AZ_FLAT_PIN_ONESHOT_BODY */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
