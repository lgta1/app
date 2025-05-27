import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface UseInfinityLoadingProps<T> {
  initialData: T[];
  apiUrl: string;
  limit?: number;
  autoLoad?: boolean;
}

interface ApiResponse<T> {
  manga: T[];
  hasMore: boolean;
  nextPage: number;
}

export function useInfinityLoading<T>({
  initialData,
  apiUrl,
  limit = 10,
  autoLoad = true,
}: UseInfinityLoadingProps<T>) {
  const [data, setData] = useState<T[]>(initialData);
  const [currentPage, setCurrentPage] = useState(2); // Bắt đầu từ page 2 vì page 1 đã có sẵn
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement | null>(null);
  const fetcher = useFetcher<ApiResponse<T>>();

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    fetcher.load(`${apiUrl}?page=${currentPage}&limit=${limit}`);
  }, [currentPage, hasMore, isLoading, apiUrl, limit, fetcher]);

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const { manga, hasMore: newHasMore, nextPage } = fetcher.data;

      setData((prevData) => [...prevData, ...manga]);
      setHasMore(newHasMore);
      setCurrentPage(nextPage);
      setIsLoading(false);
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (!autoLoad) return;

    const currentLoadingRef = loadingRef.current;

    if (!currentLoadingRef) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: "100px",
      },
    );

    observerRef.current.observe(currentLoadingRef);

    return () => {
      if (observerRef.current && currentLoadingRef) {
        observerRef.current.unobserve(currentLoadingRef);
      }
    };
  }, [loadMore, hasMore, isLoading, autoLoad]);

  return {
    data,
    isLoading,
    hasMore,
    loadingRef,
    loadMore,
  };
}
