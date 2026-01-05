import {
  useEffect,
  useMemo,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
} from "react";
import { TopBannerItem } from "./top-banner-item";
import type { MangaType } from "~/database/models/manga.model";

/** Handle cho parent điều khiển nút trái/phải */
export type TopBannerHandle = {
  getScroller(): HTMLElement | null;
  getStep(): number;
  next(): void;
  prev(): void;
};

function TopBannerBase(
  { bannerItems }: { bannerItems: MangaType[] },
  ref: React.Ref<TopBannerHandle | null>,
) {
  // Refs for two possible modes; we'll use track-based true-infinite mode
  const scrollerRef = useRef<HTMLDivElement>(null); // legacy scroll mode (not used in track mode)
  const containerRef = useRef<HTMLDivElement>(null); // overflow-hidden container
  const trackRef = useRef<HTMLDivElement>(null); // flex track moves via transform

  const GAP = 12; // reduced to 75% of previous 16px
  const IDLE_MS = 3000; // pause autoplay for 3s after any interaction

  // Chỉ lọc null/undefined; KHÔNG khử trùng lặp ở client để tránh co danh sách do khác biệt id/_id
  const items = useMemo(() => (bannerItems ?? []).filter(Boolean), [bannerItems]);
  const len = items.length;

  // Số lượng bản ghi gốc
  const baseLen = len;

  // Kích thước card: cố định bằng CSS để SSR đã ổn định (5 cột desktop, gap = 16px)
  // width = calc((100% - 4*16px) / 5) và aspect-ratio = 2/3 → không cần JS đo

  // Đo step thực từ DOM (tránh sai số snap/zoom/sub-pixel)
  const domStepRef = useRef(0);
  const measureStep = () => {
    const tr = trackRef.current;
    if (!tr) return;
    const kids = tr.children as unknown as HTMLElement[];
    if (kids && kids.length >= 2) {
      const s = Math.abs(
        (kids[1] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft,
      );
      if (s > 0) domStepRef.current = s;
    }
  };
  const stepSize = () => domStepRef.current || (260 + GAP);

  useEffect(() => {
    setTimeout(measureStep, 0);
  }, [items.length]);

  // Dev debug: expose danh sách HOT ra window để xem nhanh trong Console
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      (window as any).__HOT_BANNER__ = items.map((m: any) => ({
        id: m?.id ?? m?._id ?? null,
        title: m?.title ?? m?.name ?? null,
      }));
      if (localStorage.getItem("debug_hot") === "1") {
        // eslint-disable-next-line no-console
        console.log("[HOT] items", (window as any).__HOT_BANNER__);
      }
    } catch {
      /* noop */
    }
  }, [items]);

  // Điều khiển cuộn 1 bước, khoá khi đang animate
  const animatingRef = useRef(false);
  // Trạng thái kéo chuột (desktop)
  const draggingRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartTxRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [baseLen]);

  // Track-based slide next/prev (true infinite)
  const setTrackTransition = (on: boolean) => {
    const tr = trackRef.current;
    if (!tr) return;
    tr.style.transition = on ? "transform 450ms cubic-bezier(0.22, 0.61, 0.36, 1)" : "none";
  };

  const slideNext = () => {
    const tr = trackRef.current;
    if (!tr || animatingRef.current || baseLen < 2) return;
    const s = stepSize();
    if (s <= 0) return;
    animatingRef.current = true;
    setTrackTransition(true);
    // force reflow trước khi đổi transform để transition luôn mượt
    void tr.offsetHeight;
    requestAnimationFrame(() => {
      tr.style.transform = `translateX(-${s}px)`;
    });
    let ended = false;
    const onEnd = () => {
      if (ended) return; ended = true;
      tr.removeEventListener("transitionend", onEnd as any);
      // move first to end
      const first = tr.firstElementChild;
      if (first) tr.appendChild(first);
      setTrackTransition(false);
      tr.style.transform = `translateX(0px)`;
      animatingRef.current = false;
        setActiveIndex((prev) => (prev + 1) % Math.max(1, baseLen));
    };
    tr.addEventListener("transitionend", onEnd as any, { once: true } as any);
    window.setTimeout(onEnd, 800);
  };

  const slidePrev = () => {
    const tr = trackRef.current;
    if (!tr || animatingRef.current || baseLen < 2) return;
    const s = stepSize();
    if (s <= 0) return;
    animatingRef.current = true;
    setTrackTransition(false);
    // move last to front
    const last = tr.lastElementChild;
    if (last) tr.insertBefore(last, tr.firstElementChild);
    tr.style.transform = `translateX(-${s}px)`;
    requestAnimationFrame(() => {
      setTrackTransition(true);
      // force reflow
      void tr.offsetHeight;
      tr.style.transform = `translateX(0px)`;
    });
    let ended = false;
    const onEnd = () => {
      if (ended) return; ended = true;
      tr.removeEventListener("transitionend", onEnd as any);
      setTrackTransition(false);
      tr.style.transform = `translateX(0px)`;
      animatingRef.current = false;
        setActiveIndex((prev) => (prev - 1 + Math.max(1, baseLen)) % Math.max(1, baseLen));
    };
    tr.addEventListener("transitionend", onEnd as any, { once: true } as any);
    window.setTimeout(onEnd, 800);
  };

  // Idle trong vùng hot: nếu 2s không có thao tác trong scroller → next 1 ô
  const idleTimerRef = useRef<number | null>(null);
  const hoverIdleTimerRef = useRef<number | null>(null);

  const clearIdle = () => {
    if (idleTimerRef.current != null) {
      window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
    if (hoverIdleTimerRef.current != null) {
      window.clearTimeout(hoverIdleTimerRef.current);
      hoverIdleTimerRef.current = null;
    }
  };

  const armIdle = () => {
    clearIdle();
    if (len < 2) return; // ít hơn 2 thì khỏi chạy
    idleTimerRef.current = window.setTimeout(() => {
      if (animatingRef.current) { armIdle(); return; }
      slideNext();
      armIdle();
    }, IDLE_MS);
  };

  // Gắn listener trong vùng hot để điều khiển kéo và idle
  useEffect(() => {
    const cont = containerRef.current;
    const tr = trackRef.current;
    if (!cont || !tr) return;

    const startInteraction = () => { clearIdle(); };

    const ro = new ResizeObserver(() => {
      // chỉ đo lại bước dịch khi container thay đổi
      setTimeout(measureStep, 0);
    });
    ro.observe(cont);

    // Kéo chuột trực tiếp (không cần double-click)
    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // chỉ nhận chuột trái
      startInteraction();
      draggingRef.current = true;
      cont.classList.add("select-none");
      cont.style.cursor = "grabbing";
      setTrackTransition(false);
      dragStartXRef.current = e.pageX - cont.offsetLeft;
      const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(tr.style.transform || "");
      dragStartTxRef.current = m ? parseFloat(m[1]) : 0;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) {
        // Không kéo: dừng autoplay và lên lịch tự chạy lại sau khi ngừng di chuyển
        clearIdle();
        hoverIdleTimerRef.current && window.clearTimeout(hoverIdleTimerRef.current);
        hoverIdleTimerRef.current = window.setTimeout(() => {
          if (!draggingRef.current) armIdle();
        }, 1200);
        return;
      }
      const x = e.pageX - cont.offsetLeft;
      const dx = x - dragStartXRef.current;
      tr.style.transform = `translateX(${dragStartTxRef.current + dx}px)`;
    };
    const onUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      cont.classList.remove("select-none");
      cont.style.cursor = "";
      const s = stepSize();
      const m = /translateX\((-?\d+(?:\.\d+)?)px\)/.exec(tr.style.transform || "");
      const tx = m ? parseFloat(m[1]) : 0;
      const THRESHOLD = 0.4;
      if (Math.abs(tx) > THRESHOLD * s) {
        if (tx < 0) slideNext(); else slidePrev();
      } else {
        setTrackTransition(true);
        tr.style.transform = `translateX(0px)`;
        const t = window.setTimeout(() => setTrackTransition(false), 500);
        window.setTimeout(() => window.clearTimeout(t), 600);
      }
      // khởi động lại idle sau khi kết thúc thao tác
      armIdle();
    };

    const onMouseEnter = () => { clearIdle(); };
    const onMouseLeave = () => { armIdle(); };

    cont.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    cont.addEventListener("mousemove", () => {
      clearIdle();
      hoverIdleTimerRef.current && window.clearTimeout(hoverIdleTimerRef.current);
      hoverIdleTimerRef.current = window.setTimeout(() => {
        if (!draggingRef.current) armIdle();
      }, 1200);
    });
    cont.addEventListener("wheel", () => {
      clearIdle();
      hoverIdleTimerRef.current && window.clearTimeout(hoverIdleTimerRef.current);
      hoverIdleTimerRef.current = window.setTimeout(() => {
        if (!draggingRef.current) armIdle();
      }, 1200);
    }, { passive: true } as any);
    cont.addEventListener("mouseenter", onMouseEnter);
    cont.addEventListener("mouseleave", onMouseLeave);

    // start idle autoplay
    armIdle();

    return () => {
      clearIdle();
      ro.disconnect();
      cont.removeEventListener("mousedown", onDown as any);
      window.removeEventListener("mousemove", onMove as any);
      window.removeEventListener("mouseup", onUp as any);
      cont.removeEventListener("mousemove", () => clearIdle() as any);
      cont.removeEventListener("wheel", () => clearIdle() as any);
      cont.removeEventListener("mouseenter", onMouseEnter as any);
      cont.removeEventListener("mouseleave", onMouseLeave as any);
    };
  }, [baseLen]);

  // No scroll debounce needed in track mode

  // Expose handle cho nút bấm ở parent
  useImperativeHandle(
    ref,
    (): TopBannerHandle => ({
      getScroller: () => containerRef.current,
      getStep: () => stepSize(),
      next: () => {
        clearIdle();
        slideNext();
        armIdle(); // sau khi bấm, đếm lại 2s
      },
      prev: () => {
        clearIdle();
        slidePrev();
        armIdle();
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [len],
  );

  if (!baseLen) return null;

  // ========== MARQUEE MODE (CSS-only animation, 2 groups) ==========
  // Áp dụng kỹ thuật trong video: 2 nhóm giống hệt, animate dịch trái 0 -> -100% trên mỗi nhóm,
  // container overflow hidden nên cảm giác cuộn vô hạn, không giật.
  // Dùng chế độ scroller để hỗ trợ nút prev/next như desktop, vẫn loop vô hạn và auto-step giống mobile
  const MARQUEE = false;
  if (MARQUEE) {
  // Thiết lập tốc độ: dừng 2.5s và trượt chậm hơn (≈ 0.75 tốc độ hiện tại)
  const holdSec = 2.0; // dừng 2.0s ở mỗi ô (khớp mobile autoplay)
  const moveSec = 0.5; // mỗi ô trượt ~0.5s (khớp mobile transition)
    const totalDurationSec = Math.max(4, baseLen * (holdSec + moveSec));

    // Tạo keyframes theo số ô để có điểm dừng tại từng vị trí
    useEffect(() => {
      if (typeof document === "undefined") return;
      const name = `tb-marquee-steps-${baseLen}-${holdSec}-${moveSec}`.replace(/\./g, "_");
      const styleId = `style-${name}`;
      if (!document.getElementById(styleId)) {
        const holdPct = (holdSec / (holdSec + moveSec)) * 100; // % trong một bước dành cho dừng
        let css = `@keyframes ${name} {`;
        for (let i = 0; i < baseLen; i++) {
          const startPct = (i / baseLen) * 100;
          const holdEndPct = ((i + holdSec / (holdSec + moveSec)) / baseLen) * 100;
          const nextPct = ((i + 1) / baseLen) * 100;
          const shiftStart = (i / baseLen) * 100;
          const shiftNext = ((i + 1) / baseLen) * 100;
          css += `${startPct}% { transform: translateX(-${shiftStart}%); }`;
          css += `${holdEndPct}% { transform: translateX(-${shiftStart}%); }`;
          css += `${nextPct}% { transform: translateX(-${shiftNext}%); }`;
        }
        // đảm bảo mốc 100% về -100%
        css += `100% { transform: translateX(-100%); } }`;

        // Thêm rule pause on hover
        css += `.tb-marquee:hover .tb-group { animation-play-state: paused !important; }`;

        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = css;
        document.head.appendChild(style);
      }
    }, [baseLen]);

    const groupStyle = {
      display: "flex",
      alignItems: "stretch",
      gap: `${GAP}px`,
      paddingRight: `${GAP}px`, // bù khoảng cách thẻ cuối để khớp 100%
      willChange: "transform",
    } as any;

    const cardStyle = {
      width: "calc((100% - 64px)/5)",
      aspectRatio: "2 / 3",
      flex: "0 0 auto",
    } as any;

    return (
      <div className="relative w-full" data-hot-banner="1" data-count={baseLen}>
        <div className="tb-marquee overflow-hidden w-full">
          <div className="flex" aria-live="off" aria-roledescription="carousel">
            <div className="tb-group" style={{ ...groupStyle, animation: `tb-marquee-steps-${baseLen}-${holdSec}-${moveSec}`.replace(/\./g, "_") + ` ${totalDurationSec}s linear infinite` }}>
              {items.map((m, i) => (
                <div key={`${(m as any).id ?? (m as any)._id ?? "x"}-A-${i}`} className="shrink-0" style={cardStyle}>
                  <TopBannerItem manga={m as any} className="h-full w-full" />
                </div>
              ))}
            </div>
            <div className="tb-group" aria-hidden style={{ ...groupStyle, animation: `tb-marquee-steps-${baseLen}-${holdSec}-${moveSec}`.replace(/\./g, "_") + ` ${totalDurationSec}s linear infinite` }}>
              {items.map((m, i) => (
                <div key={`${(m as any).id ?? (m as any)._id ?? "x"}-B-${i}`} className="shrink-0" style={cardStyle}>
                  <TopBannerItem manga={m as any} className="h-full w-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full" data-hot-banner="1" data-count={baseLen}>
      <style>{`
        [data-hot-banner="1"] { --tb-gap: 12px; --tb-cols: 3; }
        @media (min-width: 1024px) {
          [data-hot-banner="1"] { --tb-cols: 5; }
        }
      `}</style>
      <div ref={containerRef} className="overflow-hidden w-full pb-2">
        <div ref={trackRef} className="flex gap-3" style={{ willChange: "transform" }}>
          {items.map((m: MangaType, i: number) => (
            <div
              key={`${(m as any).id ?? (m as any)._id ?? "x"}-${i}`}
              className="shrink-0"
              style={{ width: "calc((100% - (var(--tb-cols) - 1) * var(--tb-gap)) / var(--tb-cols))" }}
            >
              <TopBannerItem manga={m as any} className="w-full" />
            </div>
          ))}
        </div>
      </div>
      {baseLen > 0 ? (
        <div className="mt-3 hidden lg:flex items-center justify-center gap-2" aria-hidden="true">
          {items.map((_, idx) => {
            const isActive = idx === (activeIndex % baseLen);
            return (
              <span
                key={idx}
                className={`h-2 w-2 rounded-full ${isActive ? "bg-lav-500" : "bg-white/25"}`}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

const TopBanner = forwardRef<TopBannerHandle, { bannerItems: MangaType[] }>(TopBannerBase);

export default TopBanner;
export { TopBanner };
