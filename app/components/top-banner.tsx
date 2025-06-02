import { useRef } from "react";
import { ChevronLeft } from "lucide-react";
import { ChevronRight } from "lucide-react";

import { TopBannerItem } from "./top-banner-item";

import type { MangaType } from "~/database/models/manga.model";
export function TopBanner({ bannerItems }: { bannerItems: MangaType[] }) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 492; // width của item (230px) + gap (16px)
      const newScrollLeft =
        direction === "left"
          ? scrollContainerRef.current.scrollLeft - scrollAmount
          : scrollContainerRef.current.scrollLeft + scrollAmount;

      scrollContainerRef.current.scrollTo({
        left: newScrollLeft,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="group relative w-full rounded-lg">
      {/* Left Navigation Button */}
      <button
        onClick={() => scroll("left")}
        className="group/button bg-bgc-layer1/60 hover:bg-bgc-layer1/80 absolute top-0 left-0 z-10 flex h-full w-10 items-center justify-center rounded-l-lg opacity-0 transition-all duration-300 group-hover:opacity-100"
        aria-label="Scroll left"
      >
        <ChevronLeft
          className="h-8 w-8 transition-all duration-200 group-hover/button:scale-140 group-active/button:scale-110"
          strokeWidth={3}
        />
      </button>

      {/* Right Navigation Button */}
      <button
        onClick={() => scroll("right")}
        className="group/button bg-bgc-layer1/60 hover:bg-bgc-layer1/80 absolute top-0 right-0 z-10 flex h-full w-10 items-center justify-center rounded-r-lg opacity-0 transition-all duration-300 group-hover:opacity-100"
        aria-label="Scroll right"
      >
        <ChevronRight
          className="h-8 w-8 transition-all duration-200 group-hover/button:scale-140 group-active/button:scale-110"
          strokeWidth={3}
        />
      </button>

      <div
        ref={scrollContainerRef}
        className="no-scrollbar flex flex-row gap-4 overflow-x-auto rounded-lg"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
      >
        {bannerItems.map((manga) => (
          <TopBannerItem key={manga.id} manga={manga} />
        ))}
      </div>
    </div>
  );
}

export default TopBanner;
