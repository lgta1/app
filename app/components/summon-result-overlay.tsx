import { useEffect, useState } from "react";
import { CircleArrowOutUpRight, SkipForward } from "lucide-react";

import { SummonCard } from "./summon-card";

import "../styles/summon.css"; // desktop auto-fit & mobile styles

interface SummonItem {
  type: "waifu";
  itemStar: number;
  item: {
    image: string;
  };
}

interface SummonResultOverlayProps {
  isVisible: boolean;
  results: SummonItem[];
  onClose: () => void;
}

export function SummonResultOverlay({
  isVisible,
  results,
  onClose,
}: SummonResultOverlayProps) {
  const [revealedCards, setRevealedCards] = useState<Set<number>>(new Set());
  const [forceRevealAll, setForceRevealAll] = useState(false);

  // Reset state when new results are shown
  useEffect(() => {
    if (isVisible && results.length > 0) {
      setRevealedCards(new Set());
      setForceRevealAll(false);
    }
  }, [isVisible, results]);

  // Phát hiện F11 (fullscreen) để đổi cách canh dọc
  useEffect(() => {
    const updateFS = () => {
      const fs =
        Math.abs(window.innerHeight - screen.availHeight) <= 2 &&
        Math.abs(window.innerWidth - screen.availWidth) <= 2;
      document.body.setAttribute("data-fs", fs ? "1" : "0");
    };
    updateFS();
    window.addEventListener("resize", updateFS);
    window.addEventListener("fullscreenchange", updateFS);
    return () => {
      window.removeEventListener("resize", updateFS);
      window.removeEventListener("fullscreenchange", updateFS);
    };
  }, []);

  if (!isVisible || results.length === 0) {
    return null;
  }

  const handleCardReveal = (index: number) => {
    setRevealedCards((prev) => new Set([...prev, index]));
  };

  const handleRevealAll = () => {
    setForceRevealAll(true);
    setTimeout(() => setForceRevealAll(false), 1000);
  };

  const allCardsRevealed = revealedCards.size === results.length;

  const renderResults = () => {
    if (results.length === 1) {
      return (
        <div className="relative z-10 flex flex-col items-center">
          <SummonCard
            item={results[0]}
            index={0}
            size="large"
            isRevealed={revealedCards.has(0)}
            onReveal={handleCardReveal}
            forceReveal={forceRevealAll}
          />
        </div>
      );
    }

    const firstRow = results.slice(0, 5);
    const secondRow = results.slice(5, 10);

    // === MOBILE (3–4–3) + DESKTOP (5+5) ===
    return (
      <>
        {/* ===== MOBILE (3–4–3) ===== */}
        <div className="relative z-10 sm:hidden">
          {/* Hàng 1: 3 thẻ */}
          <div className="mb-3 flex items-center justify-center gap-3">
            {results.slice(0, 3).map((item, index) => (
              <SummonCard
                key={index}
                item={item}
                index={index}
                size="medium"
                isRevealed={revealedCards.has(index)}
                onReveal={handleCardReveal}
                forceReveal={forceRevealAll}
                dropDelay={index * 120}
              />
            ))}
          </div>

          {/* Hàng 2: 4 thẻ */}
          <div className="mb-3 flex items-center justify-center gap-3">
            {results.slice(3, 7).map((item, i) => {
              const index = 3 + i;
              return (
                <SummonCard
                  key={index}
                  item={item}
                  index={index}
                  size="medium"
                  isRevealed={revealedCards.has(index)}
                  onReveal={handleCardReveal}
                  forceReveal={forceRevealAll}
                  dropDelay={index * 120}
                />
              );
            })}
          </div>

          {/* Hàng 3: 3 thẻ */}
          <div className="flex items-center justify-center gap-3">
            {results.slice(7, 10).map((item, i) => {
              const index = 7 + i;
              return (
                <SummonCard
                  key={index}
                  item={item}
                  index={index}
                  size="medium"
                  isRevealed={revealedCards.has(index)}
                  onReveal={handleCardReveal}
                  forceReveal={forceRevealAll}
                  dropDelay={index * 120}
                />
              );
            })}
          </div>
        </div>

        {/* ===== DESKTOP (5+5, auto-fit) ===== */}
        <div className="summon-desktop-fit-wrap hidden sm:block">
          <div className="summon-desktop-fit">
            <div className="relative z-10 flex w-full max-w-7xl flex-col items-center gap-4 lg:gap-9 xl:gap-12 2xl:gap-16">
              {/* First row */}
              <div className="flex items-center justify-center gap-4 lg:gap-9 xl:gap-12 2xl:gap-16">
                {firstRow.map((item, index) => (
                  <SummonCard
                    key={index}
                    item={item}
                    index={index}
                    size="medium"
                    isRevealed={revealedCards.has(index)}
                    onReveal={handleCardReveal}
                    forceReveal={forceRevealAll}
                    dropDelay={index * 150}
                  />
                ))}
              </div>

              {/* Second row */}
              <div className="flex items-center justify-center gap-4 lg:gap-9 xl:gap-12 2xl:gap-16">
                {secondRow.map((item, index) => {
                  const idx = index + 5;
                  return (
                    <SummonCard
                      key={idx}
                      item={item}
                      index={idx}
                      size="medium"
                      isRevealed={revealedCards.has(idx)}
                      onReveal={handleCardReveal}
                      forceReveal={forceRevealAll}
                      dropDelay={idx * 150}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      {/* Background with radial gradient overlay */}
      <div className="absolute inset-0 from-transparent via-black/50 to-black" />

      {/* Action buttons */}
      <div className="absolute top-2 right-2 z-10 flex gap-3 lg:top-4 lg:right-4">
        {!allCardsRevealed && (
          <button
            onClick={handleRevealAll}
            className="to-lav-500 flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-3 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#e3a8ff]"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        )}

        {allCardsRevealed && (
          <button
            onClick={onClose}
            className="to-lav-500 flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-3 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#e3a8ff]"
          >
            <CircleArrowOutUpRight className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Results grid */}
      {renderResults()}
    </div>
  );
}
