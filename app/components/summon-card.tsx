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
}

export function SummonCard({
  item,
  index,
  size = "medium",
  isRevealed = false,
  onReveal,
  forceReveal = false,
}: SummonCardProps) {
  const [isFlipping, setIsFlipping] = useState(false);
  const [localIsRevealed, setLocalIsRevealed] = useState(isRevealed);
  const [isHovering, setIsHovering] = useState(false);
  // Update local state when external state changes
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

  // Size variants
  const sizeClasses = {
    medium: "aspect-2/3 w-22 sm:w-26 lg:w-[160px] xl:w-[220px] 2xl:w-[250px]",
    large: "aspect-2/3 w-48 lg:w-[300px]",
  };

  return (
    <div
      className={`relative cursor-pointer ${sizeClasses[size]} ${isHovering && !localIsRevealed && !isFlipping ? "animate-card-hover" : "animate-card-idle"}`}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Card back (mặt sấp) */}
      {!localIsRevealed && (
        <div className={`absolute inset-0 ${isFlipping ? "animate-card-flip" : ""}`}>
          <img
            src="/images/waifu/card.png"
            alt="Card back"
            className="h-full w-full rounded-lg shadow-xl"
            draggable={false}
          />
        </div>
      )}

      {/* Card front (mặt thật) */}
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
