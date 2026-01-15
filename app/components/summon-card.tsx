import { useEffect, useState } from "react";

const CARD_BACK_4S_WEBP = new URL("../hooks/card vang.webp", import.meta.url).href;
const CARD_BACK_5S_WEBP = new URL("../hooks/card 5s.webp", import.meta.url).href;

interface SummonItem {
  type: "waifu";
  itemStar: number;
  item: {
    image: string;
  };
}

interface SummonCardProps {
  item: SummonItem;
  index: number;
  size?: "medium" | "large";
  isRevealed?: boolean;
  onReveal?: (index: number) => void;
  forceReveal?: boolean;
  dropDelay?: number;
  disableDropAnimation?: boolean; // mới: tắt hiệu ứng rơi/hover/idle, hiển thị ngay
  runId?: number | null;
}

export function SummonCard({
  item,
  index,
  size = "medium",
  isRevealed = false,
  onReveal,
  forceReveal = false,
  dropDelay = 0,
  disableDropAnimation = false,
  runId,
}: SummonCardProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [localIsRevealed, setLocalIsRevealed] = useState(isRevealed);
  const [isHovering, setIsHovering] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    if (disableDropAnimation) {
      // Không animate: hiển thị ngay, không áp dụng class animate-card-*
      setShouldAnimate(false);
      return;
    }
    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, dropDelay);
    return () => clearTimeout(timer);
  }, [dropDelay, disableDropAnimation]);

  useEffect(() => {
    if (forceReveal && !localIsRevealed) {
      setIsFlipping(true);
      setTimeout(() => {
        setLocalIsRevealed(true);
        setIsFlipping(false);
        onReveal?.(index);
      }, 400);
    }
  }, [forceReveal, localIsRevealed, index, onReveal]);

  useEffect(() => {
    setLocalIsRevealed(isRevealed);
  }, [isRevealed]);

  const handleCardClick = () => {
    if (isFlipping || localIsRevealed) return;
    setIsFlipping(true);
    setTimeout(() => {
      setLocalIsRevealed(true);
      setIsFlipping(false);
      onReveal?.(index);
    }, 300);
  };

  const sizeClasses = {
    medium: "aspect-2/3 w-22 sm:w-26 lg:w-[160px] xl:w-[220px] 2xl:w-[250px]",
    large: "aspect-2/3 w-48 lg:w-[300px]",
  };

  // Manage image src to allow cache-busting / retries when image fails intermittently
  // Use card back as a safe fallback so we don't 404 when placeholder missing
  const FALLBACK_IMAGE = "/images/waifu/card.png";
  const [imgSrc, setImgSrc] = useState<string>(item.item.image || FALLBACK_IMAGE);
  const [errorCount, setErrorCount] = useState(0);

  const specialCardBackSrc =
    item?.itemStar >= 5 ? CARD_BACK_5S_WEBP : item?.itemStar === 4 ? CARD_BACK_4S_WEBP : null;

  useEffect(() => {
    // Reset src when item or runId changes
    setImgSrc(item.item.image || FALLBACK_IMAGE);
    setErrorCount(0);
  }, [item.item.image, runId]);

  return (
    <div
      className={`relative cursor-pointer ${sizeClasses[size]} ${
        disableDropAnimation
          ? ""
          : shouldAnimate
            ? "animate-card-drop"
            : "opacity-0"
      } ${
        disableDropAnimation
          ? ""
          : shouldAnimate && isHovering && !localIsRevealed && !isFlipping
            ? "animate-card-hover"
            : shouldAnimate && !localIsRevealed && !isFlipping
              ? "animate-card-idle"
              : ""
      }`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Card back (mặt sấp) */}
      {!localIsRevealed && (
        <div className={`absolute inset-0 ${isFlipping ? "animate-card-flip" : ""}`}>
          {specialCardBackSrc ? (
            <img
              src={specialCardBackSrc}
              alt={item?.itemStar >= 5 ? "Card back 5 stars" : "Card back 4 stars"}
              className="h-full w-full rounded-lg shadow-xl"
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <picture>
              {/* Mobile ưu tiên */}
              <source
                media="(max-width: 640px)"
                type="image/webp"
                srcSet="/images/waifu/card.mobile.webp"
              />
              {/* Desktop */}
              <source type="image/webp" srcSet="/images/waifu/card.webp" />
              {/* Fallback */}
              <img
                src="/images/waifu/card.png"
                alt="Card back"
                className="h-full w-full rounded-lg shadow-xl"
                draggable={false}
                loading="lazy"
                decoding="async"
              />
            </picture>
          )}
        </div>
      )}

      {/* Card front (mặt thật waifu) */}
      {localIsRevealed && (
        <div className="animate-card-reveal absolute inset-0">
          <img
            key={`${runId ?? "r0"}-${index}-${errorCount}`}
            src={imgSrc}
            alt={`Summon result ${index + 1}`}
            className="h-full w-full rounded-lg shadow-xl"
            draggable={false}
            loading="eager"
            decoding="async"
            onError={() => {
              // Retry up to 2 times with a small backoff and cache-busting query param
              const base = item.item.image || FALLBACK_IMAGE;
              if (errorCount < 2 && item.item.image) {
                setErrorCount((c: number) => c + 1);
                const cb = runId ? `_r=${runId}` : `_r=${Date.now()}`;
                const sep = base.includes("?") ? "&" : "?";
                const newSrc = `${item.item.image}${sep}${cb}`;
                // small backoff so not all retries fire exactly at once
                setTimeout(() => setImgSrc(newSrc), 150 * (errorCount + 1));
              } else {
                // final fallback to placeholder (if not already)
                if (imgSrc !== FALLBACK_IMAGE) setImgSrc(FALLBACK_IMAGE);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}
