import { useCallback, useEffect, useRef, useState } from "react";

interface UsePaginationProps<T = any> {
  apiUrl: string;
  limit?: number;
  queryParams?: Record<string, string>;
  // SSR/initial hydration support to avoid first-load spinner
  initialData?: T[];
  initialPage?: number;
  initialTotalPages?: number;
  // If true, don't auto refetch page 1 immediately when mounting with initialData
  skipInitialFetch?: boolean;
}

interface PaginationApiResponse<T> {
  data: T[];
  totalPages: number;
  currentPage: number;
  success?: boolean;
  error?: string;
  [key: string]: any;
}

export function usePagination<T>({
  apiUrl,
  limit = 10,
  queryParams = {},
  initialData,
  initialPage = 1,
  initialTotalPages = 1,
  skipInitialFetch = !!initialData,
}: UsePaginationProps<T>) {
  const [data, setData] = useState<T[]>(initialData ?? []);
  const [currentPage, setCurrentPage] = useState(initialPage ?? 1);
  const [totalPages, setTotalPages] = useState(initialTotalPages ?? 1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [responseMeta, setResponseMeta] = useState<Record<string, any> | null>(null);
  const queryParamsRef = useRef<string>("");
  const didSkipInitialFetchRef = useRef<boolean>(false);
  const hasPendingRequestRef = useRef<boolean>(false);
  const inFlightAbort = useRef<AbortController | null>(null);

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

      // Cache-busting để tránh cache lạ trên một số thiết bị/proxy
      url.searchParams.set("_", Date.now().toString());

      // Return full href (absolute URL) so fetcher.load performs a network
      // request instead of treating the value as a route id and rewriting
      // it to `<routeId>.data` which some adblockers may target.
      return url.href;
    },
    [apiUrl, limit, queryParams],
  );

  const loadPage = useCallback(
    (page: number) => {
      if (isLoading) return;

      // Abort any in-flight request
      try { inFlightAbort.current?.abort(); } catch {}
      const ac = new AbortController();
      inFlightAbort.current = ac;

      hasPendingRequestRef.current = true;
      setIsLoading(true);
      setError(null);

      const href = buildUrl(page);
      fetch(href, { credentials: "include", signal: ac.signal, headers: { "X-Requested-With": "fetch" } })
        .then(async (res) => {
          let json: PaginationApiResponse<T> | null = null;
          try { json = (await res.json()) as PaginationApiResponse<T>; } catch { json = null; }
          if (!res.ok || !json) throw new Error((json as any)?.error || `HTTP ${res.status}`);
          if (json.success === false) throw new Error(json.error || "Có lỗi xảy ra");
          const { data: responseData, ...meta } = json as PaginationApiResponse<T> & Record<string, any>;
          setData(responseData || []);
          setTotalPages(meta.totalPages || 1);
          setResponseMeta(meta);
          setError(null);
        })
        .catch((e: any) => {
          if (e?.name === "AbortError") return;
          setError((prev) => prev ?? (e?.message || "Không thể tải dữ liệu"));
          setResponseMeta(null);
        })
        .finally(() => {
          if (inFlightAbort.current === ac) inFlightAbort.current = null;
          setIsLoading(false);
          hasPendingRequestRef.current = false;
        });
    },
    [isLoading, buildUrl],
  );

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages && page !== currentPage) {
        setCurrentPage(page);
        loadPage(page);
      }
    },
    [totalPages, loadPage, currentPage],
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

  // Switched to native fetch; no fetcher state to track

  // Timeout safety: if a request takes too long, stop spinner and show error
  useEffect(() => {
    if (!isLoading) return;
    const t = setTimeout(() => {
      setIsLoading(false);
      setError((prev: string | null) => prev ?? "Kết nối chậm, vui lòng thử lại");
    }, 10000);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Sync lại state khi initialData / initialPage thay đổi từ loader (ví dụ điều hướng ?page)
  useEffect(() => {
    setData(initialData ?? []);
    setCurrentPage(initialPage ?? 1);
    setTotalPages(initialTotalPages ?? 1);
  }, [initialData, initialPage, initialTotalPages]);

  // Bảo hiểm: tự động tải trang 1 lần đầu nếu chưa có dữ liệu và không bật skipInitialFetch
  useEffect(() => {
    if (!skipInitialFetch && !didSkipInitialFetchRef.current) {
      // tránh gọi trùng với effect queryParams: chỉ gọi nếu ref chưa set và chưa có dữ liệu
      if ((data?.length ?? 0) === 0 && !isLoading) {
        didSkipInitialFetchRef.current = true; // đánh dấu để không bị gọi 2 lần
        loadPage(1);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check if queryParams changed and reload from page 1
  useEffect(() => {
    const currentQueryParams = JSON.stringify(queryParams);
    if (queryParamsRef.current !== currentQueryParams) {
      queryParamsRef.current = currentQueryParams;
      // Nếu có initialData và muốn bỏ qua fetch đầu, chỉ đánh dấu đã skip 1 lần
      if (skipInitialFetch && !didSkipInitialFetchRef.current) {
        didSkipInitialFetchRef.current = true;
        // vẫn giữ currentPage=1, totalPages từ initial
        return;
      }

      setCurrentPage(1);
      // Load page 1 with new params
      setIsLoading(true);
      setError(null);
      hasPendingRequestRef.current = true;

      try { inFlightAbort.current?.abort(); } catch {}
      const ac = new AbortController();
      inFlightAbort.current = ac;

      const url = new URL(apiUrl, window.location.origin);
      url.searchParams.set("page", "1");
      url.searchParams.set("limit", limit.toString());
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value) {
          url.searchParams.set(key, value);
        }
      });
      url.searchParams.set("_", Date.now().toString());

      fetch(url.href, { credentials: "include", signal: ac.signal, headers: { "X-Requested-With": "fetch" } })
        .then(async (res) => {
          let json: PaginationApiResponse<T> | null = null;
          try { json = (await res.json()) as PaginationApiResponse<T>; } catch { json = null; }
          if (!res.ok || !json) throw new Error((json as any)?.error || `HTTP ${res.status}`);
          if (json.success === false) throw new Error(json.error || "Có lỗi xảy ra");
          const { data: responseData, ...meta } = json as PaginationApiResponse<T> & Record<string, any>;
          setData(responseData || []);
          setTotalPages(meta.totalPages || 1);
          setResponseMeta(meta);
          setError(null);
        })
        .catch((e: any) => {
          if (e?.name === "AbortError") return;
          setError((prev) => prev ?? (e?.message || "Không thể tải dữ liệu"));
          setResponseMeta(null);
        })
        .finally(() => {
          if (inFlightAbort.current === ac) inFlightAbort.current = null;
          setIsLoading(false);
          hasPendingRequestRef.current = false;
        });
    }
  }, [apiUrl, limit, queryParams, skipInitialFetch]);

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
    responseMeta,
  };
}
