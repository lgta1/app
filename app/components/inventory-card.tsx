import { useEffect, useState } from "react";

interface SummonCardProps {
  count: number;
  image: string;
  index: number;
  dropDelay?: number;
  className?: string;
  onClick?: () => void;
}

export function InventoryCard({
  count,
  image,
  index,
  dropDelay = 0,
  className,
  onClick,
}: SummonCardProps) {
  const [shouldAnimate, setShouldAnimate] = useState(false);

  // Trigger drop animation with delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldAnimate(true);
    }, dropDelay);

    return () => clearTimeout(timer);
  }, [dropDelay]);

  return (
    <div
      className={`relative aspect-2/3 w-[118px] cursor-pointer ${className} ${
        shouldAnimate ? "animate-card-drop" : "opacity-0"
      } `}
      onClick={onClick}
    >
      <div className="animate-card-reveal relative">
        {count > 1 && (
          <div className="absolute top-2 right-2 flex min-w-6 items-center justify-center gap-2.5 rounded-lg bg-black/30 p-1 backdrop-blur-[2px]">
            <div className="justify-center text-xs leading-none font-bold text-white">
              {count}
            </div>
          </div>
        )}
        <img
          src={image}
          alt={`Inventory card ${index + 1}`}
          className="aspect-2/3 w-full rounded-lg shadow-xl"
          draggable={false}
        />
      </div>
    </div>
  );
}
