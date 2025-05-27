import { LoadingSpinner } from "./loading-spinner";

interface InfinityLoadingTriggerProps {
  isAutoLoad: boolean;
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function InfinityLoadingTrigger({
  isAutoLoad,
  isLoading,
  hasMore,
  onLoadMore,
}: InfinityLoadingTriggerProps) {
  if (!hasMore) {
    return (
      <div className="mt-6 py-8 text-center">
        <p className="text-txt-secondary text-sm">Đã hiển thị tất cả truyện</p>
      </div>
    );
  }

  return (
    <div className="mt-6">
      {isAutoLoad ? (
        // Chế độ auto load - chỉ hiện loading spinner
        isLoading && <LoadingSpinner />
      ) : (
        // Chế độ manual load - hiện button hoặc loading
        <div className="flex flex-col items-center gap-4">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <button
              onClick={onLoadMore}
              className="flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-6 py-3 shadow-[0px_4px_9px_rgba(196,69,255,0.25)] transition-all hover:shadow-[0px_6px_12px_rgba(196,69,255,0.35)]"
            >
              <span className="text-center text-sm leading-tight font-semibold text-black">
                Tải thêm truyện
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
