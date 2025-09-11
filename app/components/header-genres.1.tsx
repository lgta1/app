import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown } from "lucide-react";

import type { GenresType } from "~/database/models/genres.model";

interface HeaderGenresProps {
  genres: GenresType[];
}

function normalizeVN(s: string) {
  return (s || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function HeaderGenres({ genres }: HeaderGenresProps) {
  const [open, setOpen] = useState(false);

  // BEGIN <feature> GENRES_AZ_FLAT_NO_CATEGORY_HEADER
  const sorted = useMemo(() => {
    const arr = [...(genres || [])];

    // Chuẩn hóa Title Case đầu vào để hiển thị đúng “Thể loại”
    arr.forEach((g) => {
      if (g?.name) {
        const parts = g.name.split(" ");
        g.name = parts
          .map((p) => (p.length ? p[0].toLocaleUpperCase() + p.slice(1) : p))
          .join(" ");
      }
    });

    // Sắp xếp A–Z (khử dấu) và ghim Oneshot lên đầu nếu có
    arr.sort((a, b) => {
      const an = normalizeVN(a.name);
      const bn = normalizeVN(b.name);
      if (an === "oneshot") return -1;
      if (bn === "oneshot") return 1;
      return an.localeCompare(bn);
    });

    return arr;
  }, [genres]);
  // END <feature> GENRES_AZ_FLAT_NO_CATEGORY_HEADER

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
          {/* BEGIN <feature> GENRES_AZ_FLAT_NO_CATEGORY_BODY */}
          <div className="text-txt-focus mb-3 font-sans text-base font-semibold">
            Thể loại
          </div>

          {/* Danh sách A–Z, hiển thị hết: 3 cột, scroll bên trong nếu quá dài */}
          <div className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 md:grid-cols-3">
              {sorted.map((genre) => (
                <Link
                  key={genre.id || genre.slug}
                  to={`/genres/${genre.slug}`}
                  className="block break-inside-avoid py-1"
                  onClick={() => setOpen(false)}
                >
                  <div className="text-txt-primary hover:text-txt-focus text-xs font-medium">
                    {genre.name}
                  </div>
                </Link>
              ))}
            </div>
          </div>
          {/* END <feature> GENRES_AZ_FLAT_NO_CATEGORY_BODY */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
