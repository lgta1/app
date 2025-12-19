import { useEffect, useRef, useState } from "react";
import type { PropsWithChildren } from "react";

type LazyRenderProps = PropsWithChildren<{
  rootMargin?: string;
  threshold?: number | number[];
  placeholder?: React.ReactNode;
  once?: boolean; // unobserve after first visible
}>;

export default function LazyRender({
  children,
  rootMargin = "400px",
  threshold = 0,
  placeholder = null,
  once = true,
}: LazyRenderProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (visible) return; // already visible

    if (typeof IntersectionObserver === "undefined") {
      // fallback: render immediately on older environments
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) obs.disconnect();
            break;
          }
        }
      },
      { root: null, rootMargin, threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold, once, visible]);

  return <div ref={ref}>{visible ? children : placeholder}</div>;
}
