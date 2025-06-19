import { useEffect, useState } from "react";
import { isMobile } from "react-device-detect";

interface SummonVideoPlayerProps {
  isPlaying: boolean;
  onVideoEnd: () => void;
}

export function SummonVideoPlayer({ isPlaying, onVideoEnd }: SummonVideoPlayerProps) {
  const [videoRef, setVideoRef] = useState<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Ngăn chặn scroll khi video đang phát
  useEffect(() => {
    if (isPlaying) {
      // Thêm class để ngăn scroll thay vì manipulate styles trực tiếp
      document.documentElement.classList.add("overflow-hidden");
      document.body.classList.add("overflow-hidden");

      // Cleanup khi component unmount hoặc video dừng
      return () => {
        document.documentElement.classList.remove("overflow-hidden");
        document.body.classList.remove("overflow-hidden");
      };
    }
  }, [isPlaying]);

  useEffect(() => {
    if (isPlaying && videoRef) {
      setIsLoading(true);
      videoRef.currentTime = 0;
      videoRef
        .play()
        .then(() => setIsLoading(false))
        .catch((error) => {
          console.error("Error playing video:", error);
          setIsLoading(false);
        });
    }
  }, [isPlaying, videoRef]);

  if (!isPlaying) return null;

  return (
    <div className="fixed inset-0 z-10 flex touch-none items-center justify-center bg-black">
      <video
        ref={setVideoRef}
        className="h-full w-full object-cover"
        src={isMobile ? "/videos/summon.webm" : "/videos/summon.mp4"}
        onEnded={onVideoEnd}
        onLoadStart={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        playsInline
        muted={false}
        autoPlay
        preload="auto"
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="h-16 w-16 animate-spin rounded-full border-b-2 border-white"></div>
        </div>
      )}
    </div>
  );
}
