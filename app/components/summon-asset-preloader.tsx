import { useEffect } from "react";

/**
 * Preload assets sau khi trang /waifu/summon/[id] d  load:
 * - Video: mobile -> /videos/summon.webm, desktop -> /videos/summon.mp4 (kh?p player)
 * - Background sau video: webp theo viewport (+ png fallback t y ch?n)
 * - Card back (?nh chua l?t): webp theo viewport (+ png fallback t y ch?n)
 * LUU  : KH NG preload ?nh waifu d?ng.
 */
export default function SummonAssetPreloader() {
  useEffect(() => {
    // requestIdleCallback polyfill
    const ric: (cb: IdleRequestCallback) => number =
      // @ts-ignore
      window.requestIdleCallback ||
      ((cb: IdleRequestCallback) => window.setTimeout(cb as any, 0));

    // Tôn trọng Data Saver
    // @ts-ignore
    if (navigator?.connection?.saveData) return;

    try {
      const isMobile = window.matchMedia("(max-width: 640px)").matches;
      const VIDEO_TARGET = isMobile
        ? { href: "/videos/summon.webm", type: "video/webm" }
        : { href: "/videos/summon.mp4", type: "video/mp4" };

      // 1) Preload VIDEO NGAY khi component mount (không chờ idle)
      const videoLink = document.createElement("link");
      videoLink.rel = "preload";
      videoLink.as = "video";
      videoLink.href = VIDEO_TARGET.href;
      videoLink.type = VIDEO_TARGET.type;
      document.head.appendChild(videoLink);

      // 2) Phần IMAGE (background, card) để sau load + idle để tránh tranh băng thông
      const onLoad = () => {
        ric(async () => {
          try {
            const BG_TARGETS = isMobile
              ? [{ href: "/videos/background.mobile.webp", as: "image" }]
              : [{ href: "/videos/background.webp", as: "image" }];
            const BG_FALLBACK = [{ href: "/videos/background.png", as: "image" }];
            const CARD_TARGETS = isMobile
              ? [{ href: "/images/waifu/card.mobile.webp", as: "image" }]
              : [{ href: "/images/waifu/card.webp", as: "image" }];
            const CARD_FALLBACK = [{ href: "/images/waifu/card.png", as: "image" }];

            const links: HTMLLinkElement[] = [];
            const addPreload = (href: string, as: "image") => {
              const link = document.createElement("link");
              link.rel = "preload";
              link.as = as;
              link.href = href;
              document.head.appendChild(link);
              links.push(link);
            };

            for (const i of BG_TARGETS) addPreload(i.href, "image");
            for (const i of CARD_TARGETS) addPreload(i.href, "image");
            for (const i of BG_FALLBACK) addPreload(i.href, "image");
            for (const i of CARD_FALLBACK) addPreload(i.href, "image");

            const decodeImage = async (src: string) => {
              const img = new Image();
              img.src = src;
              try {
                // @ts-ignore
                if (img.decode) await img.decode();
              } catch {}
            };

            await Promise.all([
              decodeImage(
                isMobile ? "/videos/background.mobile.webp" : "/videos/background.webp",
              ),
              decodeImage(
                isMobile ? "/images/waifu/card.mobile.webp" : "/images/waifu/card.webp",
              ),
            ]);

            // Cleanup khi unmount (không bắt buộc)
            return () => {
              links.forEach((l) => l.parentNode?.removeChild(l));
            };
          } catch {}
        });
      };

      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });

      return () => {
        window.removeEventListener("load", onLoad);
        videoLink.parentNode?.removeChild(videoLink);
      };
    } catch {}
  }, []);

  return null;
}
