import { useEffect, useState } from "react";

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
}

export function SummonCard({
  item,
  index,
  size = "medium",
  isRevealed = false,
  onReveal,
  forceReveal = false,
  dropDelay = 0,
}: SummonCardProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [localIsRevealed, setLocalIsRevealed] = useState(isRevealed);
  const [isHovering, setIsHovering] = useState(false);
  const [shouldAnimate, setShouldAnimate] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, dropDelay);
    return () => clearTimeout(timer);
  }, [dropDelay]);

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

  return (
    <div
      className={`relative cursor-pointer ${sizeClasses[size]} ${
        shouldAnimate ? "animate-card-drop" : "opacity-0"
      } ${
        shouldAnimate && isHovering && !localIsRevealed && !isFlipping
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
        </div>
      )}

      {/* Card front (mặt thật waifu) */}
      {localIsRevealed && (
        <div className="animate-card-reveal absolute inset-0">
          <img
            src={item.item.image}
            alt={`Summon result ${index + 1}`}
            className="h-full w-full rounded-lg shadow-xl"
            draggable={false}
          />
        </div>
      )}
    </div>
  );
}
