import { Heart } from "lucide-react";

export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transform">
          <Heart className="text-lav-500 h-4 w-4 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
