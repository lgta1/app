import { useEffect, useState } from "react";

interface InventoryCardProps {
  count?: number;
  image?: string;
  imageUrl?: string;
  index?: number;
  dropDelay?: number;
  className?: string;
  onClick?: () => void;
  status?: "active" | "inactive";
  name?: string;
}

export function InventoryCard({
  count = 0,
  image,
  imageUrl,
  index = 0,
  dropDelay = 0,
  className,
  onClick,
  status,
}: InventoryCardProps) {
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
          src={image || imageUrl || ""}
          alt={`Inventory card ${index + 1}`}
          className="aspect-2/3 w-full rounded-lg shadow-xl"
          draggable={false}
        />

        {status === "active" && (
          <div className="absolute inset-0 rounded-lg ring-2 ring-lav-500" />
        )}
      </div>
    </div>
  );
}
