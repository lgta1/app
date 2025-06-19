import { useCallback, useEffect, useState } from "react";
import { useFetcher } from "react-router";

interface UsePaginationProps {
  apiUrl: string;
  limit?: number;
  queryParams?: Record<string, string>;
}

interface PaginationApiResponse<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
  success?: boolean;
  error?: string;
}

export function usePagination<T>({
  apiUrl,
  limit = 10,
  queryParams = {},
}: UsePaginationProps) {
  const [data, setData] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetcher = useFetcher<PaginationApiResponse<T>>();

  const buildUrl = useCallback(
    (page: number) => {
      const url = new URL(apiUrl, window.location.origin);
      url.searchParams.set("page", page.toString());
      url.searchParams.set("limit", limit.toString());

      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });

      return url.pathname + url.search;
    },
    [apiUrl, limit, queryParams],
  );

  const loadPage = useCallback(
    (page: number) => {
      if (isLoading || page === currentPage) return;

      setIsLoading(true);
      setError(null);
      fetcher.load(buildUrl(page));
    },
    [isLoading, currentPage, buildUrl, fetcher],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        loadPage(page);
      }
    },
    [totalPages, loadPage],
  );

  const nextPage = useCallback(() => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  }, [currentPage, totalPages, goToPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  }, [currentPage, goToPage]);

  const refresh = useCallback(() => {
    loadPage(currentPage);
  }, [currentPage, loadPage]);

  useEffect(() => {
    if (fetcher.data && fetcher.state === "idle") {
      const response = fetcher.data;

      if (response.success !== false) {
        setData(response.data || []);
        setTotalPages(response.totalPages || 1);
        setError(null);
      } else {
        setError(response.error || "Có lỗi xảy ra");
      }

      setIsLoading(false);
    }
  }, [fetcher.data, fetcher.state]);

  useEffect(() => {
    if (fetcher.state === "loading") {
      setIsLoading(true);
    }
  }, [fetcher.state]);

  useEffect(() => {
    loadPage(1);
    setCurrentPage(1);
  }, []);

  return {
    data,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
    nextPage,
    prevPage,
    refresh,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1,
  };
}
