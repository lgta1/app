import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router-dom";
import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";

import { SearchItem } from "./header-search-item";

import { DEFAULT_SCOPE, SCOPE_OPTIONS, type SearchScope } from "~/utils/text-normalize";
import type { SmartSearchHit, SmartSearchResponse } from "~/types/search";

const RESULT_LIMIT = 10;
const SEARCH_DEBOUNCE_MS = 1000;
const SCOPE_STORAGE_KEY = "ww:search-scope";

export function MobileSearch() {
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<SmartSearchHit[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [scope, setScope] = useState<SearchScope>(DEFAULT_SCOPE);

  const fetcher = useFetcher<SmartSearchResponse>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const scopeRef = useRef<SearchScope>(DEFAULT_SCOPE);
  const trimmedQuery = query.trim();

  const resetResults = useCallback(() => {
    setResults([]);
    setHasMore(false);
    setIsOpen(false);
    setIsLoading(false);
    setOffset(0);
  }, []);

  useEffect(() => {
    scopeRef.current = scope;
  }, [scope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(SCOPE_STORAGE_KEY) as SearchScope | null;
    if (stored && SCOPE_OPTIONS.some((option) => option.value === stored)) {
      setScope(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SCOPE_STORAGE_KEY, scope);
  }, [scope]);

  const searchManga = useCallback(
    (searchQuery: string, nextOffset: number = 0, overrideScope?: SearchScope) => {
      const trimmedQuery = searchQuery.trim();
      if (!trimmedQuery) {
        resetResults();
        return;
      }

      const activeScope = overrideScope ?? scopeRef.current;
      setIsLoading(true);
      setIsOpen(true);
      const params = new URLSearchParams({
        q: trimmedQuery,
        scope: activeScope,
        limit: String(RESULT_LIMIT),
        offset: String(nextOffset),
      });
      fetcher.load(`/api/search?${params.toString()}`);
    },
    [fetcher, resetResults],
  );

  useEffect(() => {
    const data = fetcher.data;
    if (!data) return;
    if (data.scope !== scopeRef.current) {
      return;
    }

    // `/api/search` lowercases the query before calling `smartSearch`.
    // Keep the same normalization here so we don't apply results for a different query.
    if (data.resolvedQuery !== trimmedQuery.toLowerCase()) {
      return;
    }

    setHasMore(data.hasMore);
    setIsLoading(false);
    setOffset(data.nextOffset);

    if (data.requestedOffset === 0) {
      setResults(data.items);
    } else {
      setResults((prev) => {
        const existing = new Set(prev.map((item) => item.id));
        const merged = data.items.filter((item) => !existing.has(item.id));
        return [...prev, ...merged];
      });
    }

    if (data.items.length > 0 || Boolean(trimmedQuery)) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [fetcher.data, trimmedQuery]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (Boolean(trimmedQuery)) {
        searchManga(query, 0);
      } else {
        resetResults();
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, resetResults, searchManga, trimmedQuery]);

  const handleScroll = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !hasMore || isLoading || !trimmedQuery) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const scrollThreshold = scrollHeight - clientHeight - 10;

    if (scrollTop >= scrollThreshold) {
      searchManga(query, offset);
    }
  }, [hasMore, isLoading, offset, query, searchManga, trimmedQuery]);

  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (scrollElement) {
      scrollElement.addEventListener("scroll", handleScroll, { passive: true });
      return () => scrollElement.removeEventListener("scroll", handleScroll);
    }
  }, [handleScroll]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
    setQuery("");
    resetResults();
  };

  const handleInputFocus = () => {
    if (results.length > 0 && Boolean(trimmedQuery)) {
      setIsOpen(true);
    }
  };

  const handleScopeChange = (value: string) => {
    if (value === scope) return;
    const nextScope = value as SearchScope;
    setScope(nextScope);
    if (trimmedQuery) {
      searchManga(query, 0, nextScope);
    }
  };
  const shouldShowDropdown = Boolean(trimmedQuery) && (results.length > 0 || isLoading);

  return (
    <>
      {!isSearchOpen && (
        <button onClick={handleSearchOpen} className="flex items-center justify-center">
          <Search className="text-txt-primary h-6 w-6" />
        </button>
      )}

      {isSearchOpen && (
        <Popover.Root open={shouldShowDropdown && isOpen} onOpenChange={setIsOpen}>
          <div className="fixed inset-0 z-50 bg-[rgba(9,16,26,0.95)] backdrop-blur-sm">
            <div className="flex w-full items-center gap-2.5 p-2.5">
              <Popover.Trigger asChild>
                <div className="bg-bgc-layer2 flex flex-1 items-center justify-start gap-2 rounded-xl px-3 py-1.5">
                  <Search className="text-txt-secondary h-5 w-5 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Tìm truyện..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    className="text-txt-secondary placeholder:text-txt-secondary focus:text-txt-primary flex-1 bg-transparent leading-normal font-medium outline-none focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={handleSearchClose}
                    className="text-txt-secondary hover:text-txt-primary flex items-center justify-center rounded-lg p-1 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lav-500"
                    aria-label="Đóng tìm kiếm"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <select
                    aria-label="Lọc theo"
                    value={scope}
                    onChange={(event) => handleScopeChange(event.target.value)}
                    className="text-txt-secondary bg-bgc-layer1 rounded-lg border border-transparent px-2 py-1 text-xs font-semibold focus:border-lav-500 focus:outline-none"
                  >
                    {SCOPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </Popover.Trigger>
            </div>

            <Popover.Portal>
              <Popover.Content
                className="bg-bgc-layer1 border-bd-default data-[state=open]:data-[side=top]:animate-slideDownAndFade data-[state=open]:data-[side=right]:animate-slideLeftAndFade data-[state=open]:data-[side=bottom]:animate-slideUpAndFade data-[state=open]:data-[side=left]:animate-slideRightAndFade z-[99999] mx-4 max-h-[calc(100vh-120px)] w-[calc(100vw-32px)] overflow-hidden rounded-xl border shadow-lg will-change-[transform,opacity]"
                sideOffset={8}
                align="center"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div
                  ref={scrollRef}
                  className="scrollbar-thin scrollbar-thumb-bd-default scrollbar-track-transparent max-h-[calc(100vh-120px)] overflow-y-auto"
                >
                  {results.map((item, index) => (
                    <div key={item.id} onClick={handleSearchClose}>
                      <SearchItem result={item} isFirst={index === 0} />
                    </div>
                  ))}

                  {!hasMore && results.length > 0 && !isLoading && (
                    <div className="text-txt-secondary py-4 text-center text-sm">
                      Không còn kết quả
                    </div>
                  )}
                </div>
              </Popover.Content>
            </Popover.Portal>
          </div>
        </Popover.Root>
      )}
    </>
  );
}
