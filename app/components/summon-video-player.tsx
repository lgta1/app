import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";
import { SkipForward } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";

interface SummonVideoPlayerProps {
  isPlaying: boolean;
  onVideoEnd: () => void;
}

export function SummonVideoPlayer({ isPlaying, onVideoEnd }: SummonVideoPlayerProps) {
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasVideoEnded, setHasVideoEnded] = useState(false);

  useEffect(() => {
    if (isPlaying) setHasVideoEnded(false);
  }, [isPlaying]);

  // Ngăn scroll khi video đang phát
  useEffect(() => {
    if (!isPlaying) return;
    document.documentElement.classList.add("overflow-hidden");
    document.body.classList.add("overflow-hidden");
    return () => {
      document.documentElement.classList.remove("overflow-hidden");
      document.body.classList.remove("overflow-hidden");
    };
  }, [isPlaying]);

  useEffect(() => {
    if (!(isPlaying && videoRef)) return;
    setIsLoading(true);
    videoRef.currentTime = 0;
    videoRef
      .play()
      .then(() => setIsLoading(false))
      .catch((error) => {
        console.error("Error playing video:", error);
        setIsLoading(false);
      });
  }, [isPlaying, videoRef]);

  const handleSkipVideo = () => {
    if (!videoRef) return;
    videoRef.currentTime = Math.max(0, videoRef.duration - 0.1); // trigger onEnded
  };

  const handleVideoEnded = () => {
    setHasVideoEnded(true);
    setIsLoading(false);
    onVideoEnd();
  };

  if (!isPlaying) return null;

  return (
    <div className="fixed inset-0 z-10 flex touch-none items-center justify-center bg-black">
      {/* Skip button - chỉ hiện khi video chưa ended */}
      {!hasVideoEnded && (
        <div className="absolute top-2 right-2 z-10 lg:top-4 lg:right-4">
          <button
            onClick={handleSkipVideo}
            className="to-lav-500 flex cursor-pointer items-center justify-center gap-1 rounded-xl bg-gradient-to-b from-[#DD94FF] px-3 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-colors hover:from-[#e3a8ff]"
          >
            <SkipForward className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Hiển thị video hoặc background image */}
      {hasVideoEnded ? (
        // ⬇️ Quan trọng: cho <picture> full màn hình, tránh viền đen
        <picture className="absolute inset-0 block h-full w-full">
          {/* Mobile ưu tiên bản nhẹ */}
          <source
            media="(max-width: 640px)"
            type="image/webp"
            srcSet="/videos/background.mobile.webp"
          />
          {/* Desktop WebP */}
          <source type="image/webp" srcSet="/videos/background.webp" />
          {/* Fallback PNG */}
          <img
            src="/videos/background.png"
            alt="summon background"
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </picture>
      ) : (
        <video
          ref={setVideoRef}
          className="h-full w-full object-cover"
          src={isMobile ? "/videos/summon.webm" : "/videos/summon.mp4"}
          onEnded={handleVideoEnded}
          onLoadStart={() => setIsLoading(true)}
          onCanPlay={() => setIsLoading(false)}
          playsInline
          muted={false}
          autoPlay
          preload="auto"
        />
      )}

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <LoadingSpinner />
        </div>
      )}
    </div>
  );
}
