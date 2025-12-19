import React from "react";
import type { MangaType } from "~/database/models/manga.model";
import { MangaCard } from "./manga-card";

export function TopBannerItem({
  manga,
  className,
  variant = "default",
}: {
  manga: MangaType;
  className?: string;
  /**
   * default: desktop banner size
   * compact: keep for API compat (unused in desktop), same visuals
   */
  variant?: "default" | "compact";
}) {
  const isCompact = variant === "compact";

  return (
    <div className={className ? `relative ${className}` : "relative"}>
      {/* Unified HOT badge (desktop): red shimmer 4s, matching time badge */}
      <div className="pointer-events-none absolute top-2 left-2 z-20">
        <style>{`@keyframes shimmer-red { 0% { background-position: 0% 0; } 100% { background-position: 200% 0; } }`}</style>
        <span
          className="inline-flex select-none rounded-full px-2 py-0.5 text-sm font-semibold text-white shadow-[0_1px_6px_rgba(0,0,0,0.55)]"
          style={{
            backgroundImage:
              "linear-gradient(100deg, rgba(244,63,94,0.35) 0%, rgba(244,63,94,0.95) 20%, rgba(244,63,94,0.35) 40%, rgba(244,63,94,0.95) 60%, rgba(244,63,94,0.35) 80%)",
            backgroundSize: "200% 100%",
            animation: "shimmer-red 4s linear infinite",
            border: "1px solid rgba(248,113,113,0.45)",
          }}
        >
          Hot
        </span>
      </div>
      {/* The MangaCard provides the unified visual; use bannerDesktop variant here */}
      <MangaCard manga={manga as any} variant="bannerDesktop" />
    </div>
  );
}

export default TopBannerItem;
