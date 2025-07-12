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
    if (isPlaying) {
      setHasVideoEnded(false);
    }
  }, [isPlaying]);

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

  const handleSkipVideo = () => {
    if (videoRef) {
      // Seek video đến cuối
      videoRef.currentTime = videoRef.duration - 0.1; // Trừ 0.1s để trigger onEnded
    }
  };

  const handleVideoEnded = () => {
    setHasVideoEnded(true);
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
        <img
          src="/videos/background.png"
          alt="Background"
          className="h-full w-full object-cover"
        />
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
