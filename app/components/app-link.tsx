import type { AnchorHTMLAttributes, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

function isIOSLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPhone/iPad/iPod
  if (/iP(hone|od|ad)/.test(ua)) return true;
  // iPadOS 13+ reports as Macintosh but has touch points
  if (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1) return true;
  return false;
}

export type AppLinkProps = {
  to: string;
  className?: string;
  children: ReactNode;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;

// Use SPA navigation on non-iOS, but fall back to native <a> navigation on iOS
// to avoid intermittent Link tap issues (hover emulation / WebKit hit-testing).
export function AppLink({ to, className, children, onClick, ...rest }: AppLinkProps) {
  const navigate = useNavigate();
  const ios = isIOSLike();

  return (
    <a
      href={to}
      className={className}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented) return;

        // Always let iOS do native navigation (more reliable).
        if (ios) return;

        // Respect new-tab / modifiers.
        const anyEvent = e as any;
        if (anyEvent.metaKey || anyEvent.altKey || anyEvent.ctrlKey || anyEvent.shiftKey) return;
        if ((anyEvent.button ?? 0) !== 0) return;
        if (rest.target && rest.target !== "_self") return;

        e.preventDefault();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
