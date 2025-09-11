import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import TopBannerItem from "./top-banner-item";

import type { MangaType } from "~/database/models/manga.model";

/**
 * HotCarousel – 5 ô card vừa khít desktop + auto-scroll ngang.
 * - Không đổi routing/exports loader/action/submit.
 * - Chỉ tác động UI trong phạm vi component này.
 */
export default function HotCarousel({ bannerItems }: { bannerItems: MangaType[] }) {
  // BEGIN <feature> HOT_SECTION_DESKTOP_5_COL_CAROUSEL
  const items = useMemo(() => bannerItems?.filter(Boolean) ?? [], [bannerItems]);
  const trackRef = useRef<HTMLDivElement>(null);
  const [cardW, setCardW] = useState<number>(0);
  const [paused, setPaused] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; left: number } | null>(null);

  // Tính chiều rộng card theo số cột (xl:5, lg:4, md:3, sm:2)
  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const GAP = 16; // ~gap-4
    const calc = () => {
      const vw = window.innerWidth;
      const cols = vw >= 1280 ? 5 : vw >= 1024 ? 4 : vw >= 640 ? 3 : 2;
      const w = el.clientWidth;
      // Giới hạn min để card không quá nhỏ
      const cw = Math.max(220, Math.floor((w - GAP * (cols - 1)) / cols));
      setCardW(cw);
    };

    const ro = new ResizeObserver(calc);
    ro.observe(el);
    calc();
    return () => ro.disconnect();
  }, []);

  // Auto-scroll theo từng "bước" đúng bề ngang card
  useEffect(() => {
    const el = trackRef.current;
    if (!el || !cardW) return;

    const GAP = 16;
    const step = cardW + GAP;

    const timer = setInterval(() => {
      if (paused || dragging) return;
      const nearEnd = el.scrollLeft + el.clientWidth + step >= el.scrollWidth - 2;
      if (nearEnd) {
        el.scrollTo({ left: 0, behavior: "auto" });
      } else {
        el.scrollTo({ left: el.scrollLeft + step, behavior: "smooth" });
      }
    }, 2600);

    return () => clearInterval(timer);
  }, [cardW, paused, dragging]);

  // Kéo chuột/touch để scroll, nhả ra snap về bội số step
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const GAP = 16;
    const step = () => cardW + GAP;

    const down = (pageX: number) => {
      setDragging(true);
      el.classList.add("select-none");
      drag.current = { x: pageX - el.offsetLeft, left: el.scrollLeft };
    };
    const move = (pageX: number) => {
      if (!drag.current) return;
      const x = pageX - el.offsetLeft;
      const walk = (x - drag.current.x) * 1.2;
      el.scrollLeft = drag.current.left - walk;
    };
    const end = () => {
      drag.current = null;
      el.classList.remove("select-none");
      setDragging(false);
      const snapped = Math.round(el.scrollLeft / step()) * step();
      el.scrollTo({ left: snapped, behavior: "smooth" });
    };

    const onMouseDown = (e: MouseEvent) => down(e.pageX);
    const onMouseMove = (e: MouseEvent) => move(e.pageX);
    const onMouseUp = () => end();

    const onTouchStart = (e: TouchEvent) => down(e.touches[0].pageX);
    const onTouchMove = (e: TouchEvent) => move(e.touches[0].pageX);
    const onTouchEnd = () => end();

    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);

    return () => {
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [cardW]);

  if (!items.length) return null;

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        ref={trackRef}
        className="no-scrollbar flex gap-4 overflow-x-auto"
        style={{
          WebkitOverflowScrolling: "touch",
          scrollBehavior: "smooth",
          paddingBottom: 8,
        }}
      >
        {items.map((m) => {
          const key = (m as any).id ?? (m as any)._id;
          return (
            <div key={key} className="shrink-0" style={{ width: cardW || 260 }}>
              {/* card cao theo tỉ lệ 3:4 giống ảnh mẫu */}
              <div className="relative aspect-[3/4] w-full">
                {/* TopBannerItem phải fill cha; nếu item cũ có width/height fix, wrapper này vẫn đảm bảo khung 3:4. */}
                <div className="absolute inset-0">
                  <TopBannerItem manga={m as any} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
  // END <feature> HOT_SECTION_DESKTOP_5_COL_CAROUSEL
}
