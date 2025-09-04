import { useEffect, useState } from "react";
import { getSelectedWaifu, buildWaifuStillUrl } from "~/helpers/waifu.helper";

export default function WaifuThumb({ w = 20, h = 30 }: { w?: number; h?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      const w = getSelectedWaifu();
      setSrc(buildWaifuStillUrl(w?.filename));
    };
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  if (!src) return null;

  return (
    <img
      src={src}
      alt="Waifu"
      loading="lazy"
      decoding="async"
      className="inline-block object-cover rounded-[3px] ring-1 ring-white/10"
      style={{ width: w, height: h }}
      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
    />
  );
}
