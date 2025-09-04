import { useEffect } from "react";

/**
 * Preload assets sau khi trang /waifu/summon/[id] dã load:
 * - Video: mobile -> /videos/summon.webm, desktop -> /videos/summon.mp4 (kh?p player)
 * - Background sau video: webp theo viewport (+ png fallback tùy ch?n)
 * - Card back (?nh chua l?t): webp theo viewport (+ png fallback tùy ch?n)
 * LUU Ý: KHÔNG preload ?nh waifu d?ng.
 */
export default function SummonAssetPreloader() {
  useEffect(() => {
    const onLoad = () => {
      // requestIdleCallback polyfill
      const ric: (cb: IdleRequestCallback) => number =
        // @ts-ignore
        window.requestIdleCallback || ((cb: IdleRequestCallback) => window.setTimeout(cb as any, 0));

      // Tôn tr?ng Data Saver
      // @ts-ignore
      if (navigator?.connection?.saveData) return;

      ric(async () => {
        try {
          const isMobile = window.matchMedia("(max-width: 640px)").matches;

          // ===== VIDEO: kh?p v?i SummonVideoPlayer hi?n t?i =====
          // Player dang: src={isMobile ? "/videos/summon.webm" : "/videos/summon.mp4"}  :contentReference[oaicite:2]{index=2}
          const VIDEO_TARGETS = isMobile
            ? [{ href: "/videos/summon.webm", type: "video/webm" }]
            : [{ href: "/videos/summon.mp4", type: "video/mp4" }];

          // ===== BACKGROUND sau khi video k?t thúc =====
          const BG_TARGETS = isMobile
            ? [{ href: "/videos/background.mobile.webp", as: "image" }]
            : [{ href: "/videos/background.webp", as: "image" }];
          // (tùy ch?n) PNG fallback:
          const BG_FALLBACK = [{ href: "/videos/background.png", as: "image" }];

          // ===== CARD BACK (?nh chua l?t) =====
          const CARD_TARGETS = isMobile
            ? [{ href: "/images/waifu/card.mobile.webp", as: "image" }]
            : [{ href: "/images/waifu/card.webp", as: "image" }];
          // (tùy ch?n) PNG fallback:
          const CARD_FALLBACK = [{ href: "/images/waifu/card.png", as: "image" }];

          // 1) Warm network cache b?ng <link rel="preload">
          const links: HTMLLinkElement[] = [];
          const addPreload = (href: string, as: "video" | "image", type?: string) => {
            const link = document.createElement("link");
            link.rel = "preload";
            link.as = as;
            link.href = href;
            if (type) link.type = type;
            // N?u có CORS: link.crossOrigin = "anonymous";
            document.head.appendChild(link);
            links.push(link);
          };

          for (const v of VIDEO_TARGETS) addPreload(v.href, "video", v.type);
          for (const i of BG_TARGETS) addPreload(i.href, "image");
          for (const i of CARD_TARGETS) addPreload(i.href, "image");
          // (tùy ch?n) fallback PNG — comment hai dòng du?i n?u mu?n ti?t ki?m bang thông
          for (const i of BG_FALLBACK) addPreload(i.href, "image");
          for (const i of CARD_FALLBACK) addPreload(i.href, "image");

          // 2) Decode s?n ?nh d? render mu?t khi chuy?n c?nh / m? overlay
          const decodeImage = async (src: string) => {
            const img = new Image();
            img.src = src;
            try {
              // @ts-ignore
              if (img.decode) await img.decode();
            } catch {
              // B? qua; ?nh v?n du?c warm cache ? network-layer
            }
          };

          await Promise.all([
            decodeImage(isMobile ? "/videos/background.mobile.webp" : "/videos/background.webp"),
            decodeImage(isMobile ? "/images/waifu/card.mobile.webp" : "/images/waifu/card.webp"),
          ]);

          // Cleanup khi unmount (không b?t bu?c)
          return () => {
            links.forEach((l) => l.parentNode?.removeChild(l));
          };
        } catch {
          // an toàn: không crash UI n?u preload fail
        }
      });
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });

    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
