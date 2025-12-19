import React from "react";
import { isDichGia } from "~/helpers/user.helper";

interface RoleBadgeProps {
  role?: string | null;
  className?: string;
  /** Optionally prepend something like "–" */
  labelPrefix?: string;
  /** Hide text label, keep only a decorative dot (future use) */
  hideLabel?: boolean;
}

/** Unified role badge (currently only DICHGIA). Expandable for ADMIN / MOD later. */
export default function RoleBadge({ role, className = "", labelPrefix = "", hideLabel = false }: RoleBadgeProps) {
  if (!role) return null;
  if (isDichGia(role)) {
    return (
      <span
        className={
          `${className} shrink-0 animate-[shine_3s_linear_infinite] bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] bg-clip-text text-transparent text-[12px] font-semibold`
        }
        aria-label="Dịch giả"
      >
        {hideLabel ? "" : `${labelPrefix} Dịch giả`}
      </span>
    );
  }
  return null;
}
