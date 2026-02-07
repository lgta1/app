import React from "react";
import type { MangaType } from "~/database/models/manga.model";
import { MangaCard } from "./manga-card";

export function TopBannerItem({
  manga,
  className,
  variant = "default",
  imgLoading,
  imgFetchPriority,
}: {
  manga: MangaType;
  className?: string;
  /**
   * default: desktop banner size
   * compact: keep for API compat (unused in desktop), same visuals
   */
  variant?: "default" | "compact";
  imgLoading?: "lazy" | "eager" | "auto";
  imgFetchPriority?: "high" | "low" | "auto";
}) {
  const isCompact = variant === "compact";

  return (
    <div className={className ? `relative ${className}` : "relative"}>
      {/* The MangaCard provides the unified visual; use bannerDesktop variant here */}
      <MangaCard
        manga={manga as any}
        variant="bannerDesktop"
        cornerHotBadge
        imgLoading={imgLoading}
        imgFetchPriority={imgFetchPriority}
      />
    </div>
  );
}

export default TopBannerItem;
