import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ThumbsUp, ChevronLeft, ChevronRight } from "lucide-react";
import { MangaCard } from "~/components/manga-card";
import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";

type Props = {
  mangaList: MangaType[];
  /**
   * detail-vertical: vertical stacked list (manga detail page)
   * reader-horizontal: horizontal scroll-snap (chapter reader)
   */
  variant?: "detail-vertical" | "reader-horizontal";
};

export default function RecommendedManga({ mangaList, variant = "detail-vertical" }: Props) {
  const items = (mangaList ?? []).filter(Boolean);
  if (items.length === 0) return null;

  const truncate = (s: string, n: number) => (s?.length > n ? s.slice(0, n).trimEnd() + "…" : s);

  const Header = (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <ThumbsUp className="h-4 w-4 text-lav-500" />
        <h2 className="text-txt-primary text-xl font-semibold uppercase">có thể bạn sẽ thích</h2>
      </div>
    </div>
  );

  if (variant === "reader-horizontal") {
    const trackRef = useRef<HTMLDivElement | null>(null);
    const dragState = useRef<{ x: number; left: number } | null>(null);
    const resumeTimeoutRef = useRef<number | null>(null);
    const [columns, setColumns] = useState(5);
    const [gapPx, setGapPx] = useState(12);
    const [edgePadding, setEdgePadding] = useState(0);
    const [cardWidth, setCardWidth] = useState(0);
    const [paused, setPaused] = useState(false);
    const [dragging, setDragging] = useState(false);

    const slides = useMemo(() => items.slice(0, 10), [items]);
    const shouldLoop = slides.length > columns;
    const renderSlides = useMemo(() => (shouldLoop ? slides.concat(slides) : slides), [slides, shouldLoop]);

    const updateLayout = useCallback(() => {
      const el = trackRef.current;
      if (!el || typeof window === "undefined") return;
      const isDesktop = window.innerWidth >= 1024;
      const nextCols = isDesktop ? 5 : 2;
      const nextGap = isDesktop ? 12 : 2;
      const available = el.clientWidth || window.innerWidth;
      const computedCard = Math.max(isDesktop ? 180 : 150, Math.floor((available - nextGap * (nextCols - 1)) / nextCols));
      setColumns(nextCols);
      setGapPx(nextGap);
      setCardWidth(computedCard);
      setEdgePadding(isDesktop ? 0 : 2);
    }, []);

    useEffect(() => {
      if (typeof window === "undefined") return;
      updateLayout();
      window.addEventListener("resize", updateLayout);
      return () => window.removeEventListener("resize", updateLayout);
    }, [updateLayout]);

    useEffect(() => {
      updateLayout();
    }, [slides.length, updateLayout]);

    const requestResume = useCallback((delay = 0) => {
      if (resumeTimeoutRef.current) window.clearTimeout(resumeTimeoutRef.current);
      resumeTimeoutRef.current = window.setTimeout(() => {
        setPaused(false);
        resumeTimeoutRef.current = null;
      }, delay);
    }, []);

    const pauseForInteraction = useCallback((delay = 4000) => {
      setPaused(true);
      requestResume(delay);
    }, [requestResume]);

    useEffect(() => () => {
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    }, []);

    const scrollByStep = useCallback(
      (direction: 1 | -1) => {
        const el = trackRef.current;
        if (!el || !cardWidth) return;
        const step = cardWidth + gapPx;
        if (step <= 0) return;

        if (shouldLoop) {
          const half = el.scrollWidth / 2;
          if (direction > 0 && el.scrollLeft + step >= half) {
            el.scrollLeft = el.scrollLeft - half;
          } else if (direction < 0 && el.scrollLeft - step <= 0) {
            el.scrollLeft = el.scrollLeft + half;
          }
          el.scrollTo({ left: el.scrollLeft + direction * step, behavior: "smooth" });
        } else {
          const max = Math.max(0, el.scrollWidth - el.clientWidth);
          const next = Math.max(0, Math.min(el.scrollLeft + direction * step, max));
          el.scrollTo({ left: next, behavior: "smooth" });
        }
      },
      [cardWidth, gapPx, shouldLoop],
    );

    useEffect(() => {
      if (!shouldLoop || !cardWidth) return;
      const interval = window.setInterval(() => {
        if (paused || dragging) return;
        scrollByStep(1);
      }, 3600);
      return () => window.clearInterval(interval);
    }, [scrollByStep, paused, dragging, shouldLoop, cardWidth]);

    useEffect(() => {
      const el = trackRef.current;
      if (!el) return;

      const begin = (pageX: number) => {
        setDragging(true);
        setPaused(true);
        if (resumeTimeoutRef.current) {
          window.clearTimeout(resumeTimeoutRef.current);
          resumeTimeoutRef.current = null;
        }
        dragState.current = { x: pageX - el.offsetLeft, left: el.scrollLeft };
        el.classList.add("select-none");
      };

      const move = (pageX: number) => {
        if (!dragState.current) return;
        const x = pageX - el.offsetLeft;
        const walk = (x - dragState.current.x) * 1.1;
        el.scrollLeft = dragState.current.left - walk;
      };

      const end = () => {
        if (!dragState.current) return;
        dragState.current = null;
        setDragging(false);
        el.classList.remove("select-none");
        pauseForInteraction();
      };

      const onMouseDown = (e: MouseEvent) => begin(e.pageX);
      const onMouseMove = (e: MouseEvent) => move(e.pageX);
      const onMouseUp = () => end();

      const onTouchStart = (e: TouchEvent) => begin(e.touches[0].pageX);
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
    }, [pauseForInteraction]);

    const handlePrev = () => {
      pauseForInteraction();
      scrollByStep(-1);
    };
    const handleNext = () => {
      pauseForInteraction();
      scrollByStep(1);
    };

    const handleMouseEnter = () => {
      setPaused(true);
      if (resumeTimeoutRef.current) {
        window.clearTimeout(resumeTimeoutRef.current);
        resumeTimeoutRef.current = null;
      }
    };
    const handleMouseLeave = () => {
      requestResume(500);
    };

    return (
      <section className="mt-8">
        {Header}
        <div className="mt-4">
          <div className="relative" aria-live="polite">
            <div
              ref={trackRef}
              className="no-scrollbar flex overflow-x-scroll"
              style={{
                gap: `${gapPx}px`,
                scrollSnapType: "x mandatory",
                WebkitOverflowScrolling: "touch",
                paddingLeft: `${edgePadding}px`,
                paddingRight: `${edgePadding}px`,
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {renderSlides.map((manga, idx) => {
                const key = (manga as any).id ?? (manga as any)._id ?? idx;
                return (
                  <div
                    key={`${key}-${idx}`}
                    className="shrink-0 snap-start"
                    style={{ width: cardWidth || 160 }}
                  >
                    <MangaCard manga={manga} />
                  </div>
                );
              })}
            </div>

          </div>

          <div className="mt-3 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              className="h-8 w-8 rounded-full border border-bd-default bg-bgc-layer1 text-txt-primary transition hover:bg-bgc-layer2"
              aria-label="Xem truyện trước"
            >
              <ChevronLeft className="mx-auto h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="h-8 w-8 rounded-full border border-bd-default bg-bgc-layer1 text-txt-primary transition hover:bg-bgc-layer2"
              aria-label="Xem truyện tiếp theo"
            >
              <ChevronRight className="mx-auto h-4 w-4" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  // detail-vertical list style
  return (
    <section className="mt-8">
      {Header}
      <div className="mt-4 bg-bgc-layer1 border-bd-default rounded-2xl border p-4">
        <div className="space-y-5">
        {items.slice(0, 5).map((m) => (
          <Link
            key={m.id ?? (m as any)._id}
            to={buildMangaUrl(m as any)}
            className="flex items-start gap-4 rounded-lg transition-colors hover:bg-white/5 p-2 -m-2"
          >
            <div
              className="flex-shrink-0 overflow-hidden rounded-lg bg-black/20 aspect-[2/3]"
              style={{ width: 56 * 1.68 }}
            >
              <img
                src={(m as any).poster || (m as any).cover || (m as any).thumbnail || (m as any).image}
                alt={(m as any).title}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="min-w-0 flex-1">
              {/* Show truncated to 20 chars on lg+, fallback to normal truncate below lg */}
              <div className="text-txt-primary text-base font-semibold">
                <span className="hidden lg:inline">{truncate((m as any).title ?? "", 32)}</span>
                <span className="lg:hidden truncate inline-block max-w-full align-bottom">{(m as any).title}</span>
              </div>
              {Boolean((m as any).description) && (
                <div className="text-txt-secondary mt-1 line-clamp-2 text-sm">
                  {(m as any).description}
                </div>
              )}
            </div>
          </Link>
        ))}
        </div>
      </div>
    </section>
  );
}
