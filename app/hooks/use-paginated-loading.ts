import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

interface PaginatedResponse<T> {
  data: T[];
  hasMore: boolean;
}

interface UsePaginatedLoadingProps<T> {
  endpoint: string;
  initialData: T[];
  limit?: number;
  queryParams?: Record<string, string | number>;
}

export function usePaginatedLoading<T>({
  endpoint,
  initialData,
  limit = 5,
  queryParams = {},
}: UsePaginatedLoadingProps<T>) {
  const [allData, setAllData] = useState<T[]>(initialData);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isReloading, setIsReloading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasLoadedInitial = useRef(false);

  const loadMoreFetcher = useFetcher<PaginatedResponse<T>>();
  const reloadFetcher = useFetcher<PaginatedResponse<T>>();
  const initialFetcher = useFetcher<PaginatedResponse<T>>();

  // Build query string from params
  const buildQueryString = useCallback(
    (page: number) => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...Object.fromEntries(
          Object.entries(queryParams).map(([key, value]) => [key, value.toString()]),
        ),
      });
      return `${endpoint}?${params.toString()}`;
    },
    [endpoint, limit, queryParams],
  );

  // Load more data
  const handleLoadMore = useCallback(() => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadMoreFetcher.load(buildQueryString(nextPage));
  }, [currentPage, buildQueryString]);

  // Reload latest data and reset state
  const handleReload = useCallback(() => {
    setIsReloading(true);
    reloadFetcher.load(buildQueryString(1));
  }, [buildQueryString]);

  // Handle load more response
  useEffect(() => {
    if (loadMoreFetcher.data?.data) {
      setAllData((prev) => [...prev, ...loadMoreFetcher.data!.data]);
      setHasMore(loadMoreFetcher.data!.hasMore);
    }
  }, [loadMoreFetcher.data]);

  // Handle reload response
  useEffect(() => {
    if (reloadFetcher.data?.data) {
      setAllData(reloadFetcher.data!.data);
      setCurrentPage(1);
      setHasMore(reloadFetcher.data!.hasMore);
      setIsReloading(false);
    }
  }, [reloadFetcher.data]);

  // Handle initial load response
  useEffect(() => {
    if (initialFetcher.data?.data) {
      setAllData(initialFetcher.data!.data);
      setCurrentPage(1);
      setHasMore(initialFetcher.data!.hasMore);
      setIsInitialLoading(false);
      hasLoadedInitial.current = true;
    }
  }, [initialFetcher.data]);

  // Load initial data if no initial data provided
  useEffect(() => {
    if (initialData.length === 0 && !hasLoadedInitial.current && isInitialLoading) {
      initialFetcher.load(buildQueryString(1));
      hasLoadedInitial.current = true;
    } else if (initialData.length > 0) {
      setIsInitialLoading(false);
      hasLoadedInitial.current = true;
    }
  }, [initialData.length, isInitialLoading, buildQueryString]);

  // Add new item to the top of the list
  const addNewItem = useCallback((item: T) => {
    setAllData((prev) => [item, ...prev]);
  }, []);

  // Update existing item
  const updateItem = useCallback((updatedItem: T, matchFn: (item: T) => boolean) => {
    setAllData((prev) => prev.map((item) => (matchFn(item) ? updatedItem : item)));
  }, []);

  // Remove item
  const removeItem = useCallback((matchFn: (item: T) => boolean) => {
    setAllData((prev) => prev.filter((item) => !matchFn(item)));
  }, []);

  return {
    allData,
    hasMore,
    isLoadingMore: loadMoreFetcher.state === "loading",
    isReloading: isReloading || reloadFetcher.state === "loading",
    isInitialLoading: isInitialLoading || initialFetcher.state === "loading",
    handleLoadMore,
    handleReload,
    addNewItem,
    updateItem,
    removeItem,
  };
}
