import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { TopBannerItem } from "./top-banner-item";

import type { MangaType } from "~/database/models/manga.model";

/**
 * Cụm banner HOT: 5 card khít desktop (≥1280), tỉ lệ 2:3, auto-scroll ngang.
 * Không đổi routing/submit/payload. Không overlay đè nội dung của item.
 */
function TopBanner({ bannerItems }: { bannerItems: MangaType[] }) {
  // BEGIN <feature> HOT_SECTION_5COL_CAROUSEL
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState<number>(0);
  const [cardH, setCardH] = useState<number>(0);
  const [isPaused, setPaused] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; scrollLeft: number } | null>(null);

  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const GAP = 16; // gap-4
    const calc = () => {
      const w = el.clientWidth;
      const vw = typeof window !== "undefined" ? window.innerWidth : 1280;
      const cols = vw >= 1280 ? 5 : vw >= 1024 ? 4 : vw >= 640 ? 3 : 2;
      const cardWidth = Math.max(220, Math.floor((w - GAP * (cols - 1)) / cols));
      const cardHeight = Math.round((cardWidth * 3) / 2); // 2:3
      setCardW(cardWidth);
      setCardH(cardHeight);
    };

    const ro = new ResizeObserver(calc);
    ro.observe(el);
    calc();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || cardW === 0) return;

    const GAP = 16;
    const step = cardW + GAP;
    const timer = setInterval(() => {
      if (isPaused || isDragging) return;
      const nearEnd = el.scrollLeft + el.clientWidth + step >= el.scrollWidth;
      if (nearEnd) {
        el.scrollTo({ left: 0, behavior: "auto" });
      } else {
        el.scrollTo({ left: el.scrollLeft + step, behavior: "smooth" });
      }
    }, 2600);

    return () => clearInterval(timer);
  }, [cardW, isPaused, isDragging]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    const onDown = (e: MouseEvent) => {
      setDragging(true);
      el.classList.add("select-none");
      dragRef.current = {
        startX: e.pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
    };
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - dragRef.current.startX) * 1.2;
      el.scrollLeft = dragRef.current.scrollLeft - walk;
    };
    const endDrag = () => {
      dragRef.current = null;
      el.classList.remove("select-none");
      const GAP = 16;
      const step = cardW + GAP;
      const snapped = Math.round(el.scrollLeft / step) * step;
      el.scrollTo({ left: snapped, behavior: "smooth" });
      setDragging(false);
    };

    el.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", endDrag);

    // Touch
    const tDown = (e: TouchEvent) => {
      setDragging(true);
      dragRef.current = {
        startX: e.touches[0].pageX - el.offsetLeft,
        scrollLeft: el.scrollLeft,
      };
    };
    const tMove = (e: TouchEvent) => {
      if (!dragRef.current) return;
      const x = e.touches[0].pageX - el.offsetLeft;
      const walk = (x - dragRef.current.startX) * 1.2;
      el.scrollLeft = dragRef.current.scrollLeft - walk;
    };
    const tEnd = () => {
      const GAP = 16;
      const step = cardW + GAP;
      const snapped = Math.round(el.scrollLeft / step) * step;
      el.scrollTo({ left: snapped, behavior: "smooth" });
      setDragging(false);
      dragRef.current = null;
    };

    el.addEventListener("touchstart", tDown, { passive: true });
    el.addEventListener("touchmove", tMove, { passive: true });
    el.addEventListener("touchend", tEnd);

    return () => {
      el.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", endDrag);
      el.removeEventListener("touchstart", tDown);
      el.removeEventListener("touchmove", tMove);
      el.removeEventListener("touchend", tEnd);
    };
  }, [cardW]);

  const items = useMemo(() => bannerItems?.filter(Boolean) ?? [], [bannerItems]);
  if (!items.length) return null;

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={scrollerRef}
        className="no-scrollbar flex gap-4 overflow-x-auto pb-2"
        style={{ WebkitOverflowScrolling: "touch", scrollBehavior: "smooth" }}
      >
        {items.map((m) => (
          <div
            key={(m as any).id ?? (m as any)._id}
            className="shrink-0"
            style={{ width: cardW || 260, height: cardH || 390 }}
          >
            <TopBannerItem manga={m as any} className="h-full w-full" />
          </div>
        ))}
      </div>
    </div>
  );
  // END <feature> HOT_SECTION_5COL_CAROUSEL
}

export default TopBanner;
export { TopBanner };
