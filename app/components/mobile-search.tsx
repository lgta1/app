import { useCallback, useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";
import * as Popover from "@radix-ui/react-popover";
import { Search, X } from "lucide-react";

import { SearchItem } from "./header-search-item";

import { LoadingSpinner } from "~/components/loading-spinner";
import type { MangaType } from "~/database/models/manga.model";

interface SearchResponse {
  manga: MangaType[];
  hasMore: boolean;
  nextPage: number;
  total: number;
}

export function MobileSearch() {
  const [query, setQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [results, setResults] = useState<MangaType[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fetcher = useFetcher<SearchResponse>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const searchManga = useCallback(
    (searchQuery: string, pageNum: number = 1) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setIsOpen(false);
        setHasMore(false);
        return;
      }

      setIsLoading(true);
      fetcher.load(
        `/api/manga/search?q=${encodeURIComponent(searchQuery)}&page=${pageNum}&limit=10`,
      );
    },
    [fetcher],
  );

  useEffect(() => {
    if (fetcher.data) {
      const data = fetcher.data;

      if (page === 1) {
        setResults(data.manga);
      } else {
        setResults((prev) => [...prev, ...data.manga]);
      }

      setHasMore(data.hasMore);
      setIsLoading(false);

      if (data.manga.length > 0 || Boolean(query.trim())) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  }, [fetcher.data, page, query]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (Boolean(query.trim())) {
        setPage(1);
        setResults([]);
        setHasMore(false);
        searchManga(query, 1);
      } else {
        setResults([]);
        setIsOpen(false);
        setHasMore(false);
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleScroll = useCallback(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement || !hasMore || isLoading || !query.trim()) {
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = scrollElement;
    const scrollThreshold = scrollHeight - clientHeight - 10;

    if (scrollTop >= scrollThreshold) {
      const nextPage = page + 1;
      setPage(nextPage);
      searchManga(query, nextPage);
    }
  }, [hasMore, isLoading, page, query, searchManga]);

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
    setResults([]);
    setIsOpen(false);
    setHasMore(false);
    setIsLoading(false);
  };

  const handleInputFocus = () => {
    if (results.length > 0 && Boolean(query.trim())) {
      setIsOpen(true);
    }
  };

  const shouldShowDropdown = Boolean(query.trim()) && (results.length > 0 || isLoading);

  return (
    <>
      {/* Search Icon */}
      {!isSearchOpen && (
        <button onClick={handleSearchOpen} className="flex items-center justify-center">
          <Search className="text-txt-primary h-6 w-6" />
        </button>
      )}

      {/* Search Overlay */}
      {isSearchOpen && (
        <Popover.Root open={shouldShowDropdown && isOpen} onOpenChange={setIsOpen}>
          <div className="fixed inset-0 z-50 bg-[rgba(9,16,26,0.95)] backdrop-blur-sm">
            {/* Header với search input */}
            <div className="flex w-full items-center gap-3 p-2.5">
              <Popover.Trigger asChild>
                <div className="bg-bgc-layer2 flex flex-1 items-center justify-start gap-2 rounded-xl px-3 py-1.5">
                  <Search className="text-txt-secondary h-5 w-5 flex-shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder="Tìm truyện"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={handleInputFocus}
                    className="text-txt-secondary placeholder:text-txt-secondary focus:text-txt-primary flex-1 bg-transparent leading-normal font-medium outline-none focus:outline-none"
                  />
                </div>
              </Popover.Trigger>
              <button
                onClick={handleSearchClose}
                className="flex items-center justify-center p-1"
              >
                <X className="text-txt-primary h-6 w-6" />
              </button>
            </div>

            {/* Search Results */}
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
                  {results.map((manga, index) => (
                    <div key={manga.id} onClick={handleSearchClose}>
                      <SearchItem manga={manga} isFirst={index === 0} />
                    </div>
                  ))}

                  {isLoading && <LoadingSpinner />}

                  {!hasMore && results.length > 0 && !isLoading && (
                    <div className="text-txt-secondary py-4 text-center text-sm">
                      Không còn kết quả
                    </div>
                  )}

                  {results.length === 0 && query.trim() && !isLoading && (
                    <div className="text-txt-secondary py-8 text-center">
                      Không tìm thấy truyện nào
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
