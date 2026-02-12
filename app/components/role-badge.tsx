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
    const label = hideLabel ? "" : `${labelPrefix} Dịch giả`;
    return (
      <span
        className={
          `${className} shrink-0 translator-shine`
        }
        aria-label="Dịch giả"
        data-text={label}
      >
        {label}
      </span>
    );
  }
  return null;
}
