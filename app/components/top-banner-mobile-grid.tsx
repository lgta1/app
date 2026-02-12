import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MangaType } from "~/database/models/manga.model";
import { MangaCard } from "./manga-card";

// Swiper (column-based carousel – 1 column = 2 MangaCards stacked)
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Navigation, Autoplay } from "swiper/modules";
import type { Swiper as SwiperInstance } from "swiper";
import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/navigation";

const MOBILE_GRID_MAX_ITEMS = 12;
const HIGH_PRIORITY_IMAGES = 4;
const EAGER_IMAGES = 6;

interface Props {
  items: MangaType[];
  autoplayDelayMs?: number;
  spaceX?: number; // horizontal gap between columns
  spaceY?: number; // vertical gap inside a column between the two cards
}

export default function TopBannerMobileGrid({
  items,
  autoplayDelayMs = 3000,
  spaceX = 3,
  spaceY = 12,
}: Props) {
  // iOS detection – prefer native scroll (cssMode) to avoid text raster blur during transforms
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    return /iP(hone|od|ad)/.test(navigator.userAgent);
  }, []);
  // Cap dataset to mobile target (10 manga + 2 cosplay)
  const all = useMemo(() => (items || []).filter(Boolean).slice(0, MOBILE_GRID_MAX_ITEMS), [items]);

  // Group into columns: each column has 2 items (top, bottom)
  const columns = useMemo(() => {
    const out: MangaType[][] = [];
    for (let i = 0; i < all.length; i += 2) out.push(all.slice(i, i + 2));
    return out; // typically 5 columns for 10 items, 6 columns for 12, etc.
  }, [all]);

  const [mounted, setMounted] = useState(false);
  const [dragging, setDragging] = useState(false); // iOS: toggle blur while moving
  const swiperRef = useRef<SwiperInstance | null>(null);
  const resumeTimerRef = useRef<number | null>(null);

  const scheduleAutoplayResume = useCallback((swiper?: SwiperInstance) => {
    const instance = swiper ?? swiperRef.current;
    if (!instance || !instance.autoplay) return;
    instance.autoplay.stop();
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = window.setTimeout(() => {
      if (instance?.autoplay) {
        instance.autoplay.start();
      }
      resumeTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => () => {
    if (resumeTimerRef.current) window.clearTimeout(resumeTimerRef.current);
    swiperRef.current?.autoplay?.stop();
  }, []);
  useEffect(() => setMounted(true), []);

  const GridStyle = () => (
    <style>{`
        [data-mobile-hot-grid] {
          --hot-grid-gap-x: ${spaceX}px;
          --hot-grid-gap-y: ${spaceY}px;
          --hot-grid-col-width: calc((100% - var(--hot-grid-gap-x)) / 2);
          --hot-grid-card-height: calc(var(--hot-grid-col-width) * 1.5); /* poster 2:3 */
          --hot-grid-slide-height: calc(var(--hot-grid-card-height) * 2 + var(--hot-grid-gap-y));
        }
        @media (min-width: 640px) {
          [data-mobile-hot-grid] { --hot-grid-col-width: calc((100% - var(--hot-grid-gap-x)) / 3); }
        }
        @media (min-width: 768px) {
          [data-mobile-hot-grid] { --hot-grid-col-width: calc((100% - var(--hot-grid-gap-x)) / 4); }
        }
        [data-mobile-hot-grid] .hot-grid-slide { min-height: var(--hot-grid-slide-height); }
      `}</style>
  );

  const Skeleton = () => (
    <div className="relative -mx-2 overflow-hidden sm:mx-0" data-mobile-hot-grid>
      <div
        className="grid grid-cols-2"
        style={{ columnGap: spaceX, rowGap: spaceY }}
      >
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="hot-grid-slide flex flex-col" style={{ gap: spaceY }}>
            <div className="aspect-[2/3] w-full rounded-xl border border-white/10 bg-white/5 animate-pulse" />
            <div className="aspect-[2/3] w-full rounded-xl border border-white/10 bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <GridStyle />
    </div>
  );

  const renderCard = (m: MangaType, itemIdx: number) => {
    const isEager = itemIdx < EAGER_IMAGES;
    const fetchPriority = itemIdx < HIGH_PRIORITY_IMAGES ? "high" : isEager ? "auto" : "low";
    return (
      <div
        key={(m as any).id ?? (m as any)._id ?? itemIdx}
        className={"relative" + (isIOS && dragging ? " ios-reduce-blur" : "")}
      >
        <div
          className="ios-composite"
          style={{
            transform: "translateZ(0)",
            WebkitTransform: "translateZ(0)",
            backfaceVisibility: "hidden" as any,
            WebkitBackfaceVisibility: "hidden" as any,
            WebkitFontSmoothing: "antialiased" as any,
            willChange: "transform",
            contain: "paint",
            isolation: "isolate",
          }}
        >
          <MangaCard
            manga={m as any}
            hideBottomOverlay
            imgLoading={isEager ? "eager" : "lazy"}
            imgFetchPriority={fetchPriority}
          />
        </div>
      </div>
    );
  };

  const renderColumn = (col: MangaType[], cIdx: number) => (
    <div key={cIdx} className="hot-grid-slide flex flex-col" style={{ gap: spaceY }}>
      {col.map((m, i) => renderCard(m, cIdx * 2 + i))}
    </div>
  );

  if (columns.length === 0) {
    return <Skeleton />;
  }

  if (!mounted) {
    const ssrColumns = columns.slice(0, 2);
    return (
      <div className="relative -mx-2 overflow-hidden sm:mx-0" data-mobile-hot-grid>
        <div className="grid grid-cols-2" style={{ columnGap: spaceX, rowGap: spaceY }}>
          {ssrColumns.map(renderColumn)}
        </div>
        <GridStyle />
      </div>
    );
  }

  // Each slide = 1 column => 5 slides => 5 bullets. Autoplay moves 1 column.
  return (
    <div className="relative overflow-hidden -mx-2 sm:mx-0" data-mobile-hot-grid>
  {/* No extra keyframes: HOT badge uses static gradient (no shimmer) */}
      <Swiper
        onSwiper={(instance) => {
          swiperRef.current = instance;
        }}
        slidesPerView={2} // viewport shows 2 columns side-by-side (original behavior)
        centeredSlides={false}
        slidesPerGroup={1} // move exactly 1 column per interaction/autoplay
        spaceBetween={spaceX} // keep Swiper gap aligned with SSR grid sizing
        slidesOffsetBefore={0}
        slidesOffsetAfter={0}
        loop={true}
        cssMode={false}
        rewind={false}
        loopAdditionalSlides={Math.min(columns.length, 2)}
        watchSlidesProgress={true}
        onTouchStart={(swiper) => {
          if (isIOS) setDragging(true);
          scheduleAutoplayResume(swiper);
        }}
        onTouchEnd={(swiper) => {
          if (isIOS) setTimeout(() => setDragging(false), 60);
          scheduleAutoplayResume(swiper);
        }}
        onSliderMove={(swiper) => {
          if (isIOS) setDragging(true);
          scheduleAutoplayResume(swiper);
        }}
        onTransitionEnd={() => isIOS && setDragging(false)}
        onNavigationNext={(swiper) => scheduleAutoplayResume(swiper)}
        onNavigationPrev={(swiper) => scheduleAutoplayResume(swiper)}
        pagination={{ clickable: true }}
        navigation={true}
        autoplay={{
          delay: autoplayDelayMs,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        speed={500}
        resistanceRatio={0.85}
        touchStartPreventDefault={false}
        modules={[Pagination, Navigation, Autoplay]}
        className="swiper_columns"
      >
        {columns.map((col, cIdx) => (
          <SwiperSlide key={cIdx}>{renderColumn(col, cIdx)}</SwiperSlide>
        ))}
      </Swiper>
      <GridStyle />
      <style>{`
        /* Use Swiper CSS variables for arrow and bullets */
        .swiper_columns {
          --swiper-navigation-color: rgba(255,255,255,0.9); /* arrow icon white for contrast */
          --swiper-navigation-size: 18px; /* keep arrow modest size */
          --swiper-pagination-color: rgba(168,85,247,0.85); /* active bullet opacity +5% (from 0.80 to 0.85) */
          --swiper-pagination-bullet-inactive-color: rgba(168,85,247,1); /* base purple */
          --swiper-pagination-bullet-inactive-opacity: 0.30; /* inactive reduced by 10% (from 0.40 to 0.30) */
          overflow: hidden; /* prevent horizontal overflow on mobile */
          padding-bottom: 27px; /* reserve room for pagination dots inside (+5px) */
        }
        .swiper_columns, .swiper_columns .swiper-wrapper { width: 100%; max-width: 100%; }
        .swiper_columns .swiper-slide { box-sizing: border-box; }
        .swiper_columns .swiper-button-next, .swiper_columns .swiper-button-prev {
          width: 33px; /* half the previous touch area */
          height: 33px;
          background: rgba(0,0,0,0.4);
          backdrop-filter: blur(4px);
          border-radius: 12px;
          transform: translateY(-3px); /* nudge up */
        }

        /* Flush to the carousel edges (Swiper defaults to an inset). */
        .swiper_columns .swiper-button-prev { left: 0; }
        .swiper_columns .swiper-button-next { right: 0; }

        /* Mobile usability: expand tap hitbox without changing visuals/layout.
           Requirement: W x H = 66 x 99 (x2 width, x3 height vs 33px visual button). */
        @media (pointer: coarse) {
          .swiper_columns .swiper-button-prev:before {
            content: "";
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 66px;
            height: 99px;
            background: transparent;
          }
          .swiper_columns .swiper-button-next:before {
            content: "";
            position: absolute;
            right: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 66px;
            height: 99px;
            background: transparent;
          }
        }
        .swiper_columns .swiper-button-next:after, .swiper_columns .swiper-button-prev:after {
          font-size: 16px;
          font-weight: 800;
          text-shadow: 0 1px 3px rgba(0,0,0,0.45);
        }
        .swiper_columns .swiper-button-disabled { opacity: 0.35; }
        .swiper_columns .swiper-pagination {
          bottom: 6px;
          transform: none;
        }

        /* iOS Safari: minimize text paint delay during transforms */
        .swiper_columns .swiper-wrapper,
        .swiper_columns .swiper-slide {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
          will-change: transform;
        }
        .ios-composite, .ios-composite * {
          -webkit-font-smoothing: antialiased;
        }
        /* iOS: while dragging, reduce overlay blur to avoid text fade */
        .ios-reduce-blur .bg-gradient-to-t {
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
          background-image: linear-gradient(to top, rgba(0,0,0,0.95), rgba(0,0,0,0.90), transparent) !important;
        }
        /* Prepaint neighbors by keeping them visible to renderer */
        .swiper_columns .swiper-slide-prev,
        .swiper_columns .swiper-slide-next {
          contain: layout style paint;
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
          will-change: transform;
        }
      `}</style>
    </div>
  );
}
