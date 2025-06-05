import { useState } from "react";
import { Link } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, ChevronRight } from "lucide-react";

import { GENRE_CATEGORY } from "~/constants/genres";
import type { GenresType } from "~/database/models/genres.model";

interface HeaderGenresProps {
  genres: GenresType[];
}

export function HeaderGenres({ genres }: HeaderGenresProps) {
  const [isHardcoreHidden, setIsHardcoreHidden] = useState(true);
  const [open, setOpen] = useState(false);

  // Nhóm thể loại theo category
  const genresByCategory = genres.reduce(
    (acc, genre) => {
      if (!acc[genre.category]) {
        acc[genre.category] = [];
      }
      acc[genre.category].push(genre);
      return acc;
    },
    {} as Record<string, GenresType[]>,
  );

  // Chia thể loại thành các cột
  const getGenreColumns = (categoryGenres: GenresType[], columnCount = 4) => {
    const columns: GenresType[][] = Array.from({ length: columnCount }, () => []);

    categoryGenres.forEach((genre, index) => {
      const columnIndex = index % columnCount;
      columns[columnIndex].push(genre);
    });

    return columns;
  };

  const mostPopularColumns = genresByCategory[GENRE_CATEGORY.MOST_VIEWED]
    ? getGenreColumns(genresByCategory[GENRE_CATEGORY.MOST_VIEWED])
    : [];

  const otherColumns = genresByCategory[GENRE_CATEGORY.OTHER]
    ? getGenreColumns(genresByCategory[GENRE_CATEGORY.OTHER])
    : [];

  const hardcoreColumns = genresByCategory[GENRE_CATEGORY.HARDCORE]
    ? getGenreColumns(genresByCategory[GENRE_CATEGORY.HARDCORE])
    : [];

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
          className="bg-bgc-layer1 border-bd-default data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-[99999] w-[100vw] rounded-xl border p-4 shadow-lg will-change-[transform,opacity] sm:w-full sm:max-w-[95vw] md:w-[440px]"
          sideOffset={8}
          align="center"
        >
          {/* Đọc nhiều nhất */}
          {mostPopularColumns.length > 0 && (
            <div className="border-bd-default mb-4 border-b pb-4">
              <div className="text-txt-focus mb-4 font-sans text-base font-semibold">
                Đọc nhiều nhất
              </div>
              <div className="flex justify-between md:flex-row">
                {mostPopularColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="w-[95px] sm:w-full md:w-[110px]">
                    {column.map((genre) => (
                      <Link
                        key={genre.id}
                        to={`/genres/${genre.slug}`}
                        className="block py-1"
                        onClick={() => setOpen(false)}
                      >
                        <div className="text-txt-primary hover:text-txt-focus text-xs font-medium">
                          {genre.name}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Thể loại khác */}
          {otherColumns.length > 0 && (
            <div className="border-bd-default mb-4 border-b pb-4">
              <div className="text-txt-focus mb-4 font-sans text-base font-semibold">
                Thể loại khác
              </div>
              <div className="flex justify-between md:flex-row">
                {otherColumns.map((column, columnIndex) => (
                  <div key={columnIndex} className="w-[95px] sm:w-full md:w-[110px]">
                    {column.map((genre) => (
                      <Link
                        key={genre.id}
                        to={`/genres/${genre.slug}`}
                        className="block py-1"
                        onClick={() => setOpen(false)}
                      >
                        <div className="text-txt-primary hover:text-txt-focus text-xs font-medium">
                          {genre.name}
                        </div>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Truyện Hardcore */}
          {hardcoreColumns.length > 0 && (
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="text-error-error font-sans text-base font-semibold sm:text-sm">
                  Truyện Hardcore (Cân nhắc trước khi xem)
                </div>
                <div
                  className="flex cursor-pointer items-center gap-1.5"
                  onClick={() => setIsHardcoreHidden(!isHardcoreHidden)}
                >
                  <div className="text-txt-secondary text-xs font-medium">
                    {isHardcoreHidden ? "Hiện" : "Ẩn"}
                  </div>
                  <div className="rotate-90 transform">
                    <ChevronRight
                      className="text-txt-secondary h-4 w-4"
                      style={{
                        transform: isHardcoreHidden ? "none" : "rotate(180deg)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {!isHardcoreHidden && (
                <div className="flex justify-between md:flex-row">
                  {hardcoreColumns.map((column, columnIndex) => (
                    <div key={columnIndex} className="w-[95px] sm:w-full md:w-[110px]">
                      {column.map((genre) => (
                        <Link
                          key={genre.id}
                          to={`/genres/${genre.slug}`}
                          className="block py-1"
                          onClick={() => setOpen(false)}
                        >
                          <div className="text-txt-primary hover:text-txt-focus text-xs font-medium">
                            {genre.name}
                          </div>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
