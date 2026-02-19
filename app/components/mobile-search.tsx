import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search, X } from "lucide-react";

const SEARCH_PATH = "/search";

export function MobileSearch() {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const queryFromUrl = new URLSearchParams(location.search).get("q") ?? "";
  const [query, setQuery] = useState(queryFromUrl);
  const [isPurpleTone, setIsPurpleTone] = useState(false);

  useEffect(() => {
    setQuery(queryFromUrl);
  }, [queryFromUrl]);

  const trimmedQuery = query.trim();
  const searchHref = trimmedQuery ? `${SEARCH_PATH}?q=${encodeURIComponent(trimmedQuery)}` : SEARCH_PATH;

  useEffect(() => {
    if (!trimmedQuery) return;
    const timer = setInterval(() => {
      setIsPurpleTone((prev) => !prev);
    }, 420);
    return () => clearInterval(timer);
  }, [trimmedQuery]);

  useEffect(() => {
    if (!trimmedQuery) {
      setIsPurpleTone(false);
    }
  }, [trimmedQuery]);

  const handleSearchOpen = () => {
    setIsSearchOpen(true);
  };

  const handleSearchClose = () => {
    setIsSearchOpen(false);
  };

  const handleGoSearch = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    window.location.href = trimmed ? `${SEARCH_PATH}?q=${encodeURIComponent(trimmed)}` : SEARCH_PATH;
    setIsSearchOpen(false);
  };

  const handleEnterSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    window.location.href = searchHref;
    setIsSearchOpen(false);
  };

  const iconClassName = trimmedQuery
    ? isPurpleTone
      ? "text-[#C084FC] animate-pulse"
      : "text-txt-secondary animate-pulse"
    : "text-txt-secondary";

  return (
    <>
      {!isSearchOpen && (
        <button onClick={handleSearchOpen} className="flex items-center justify-center">
          <Search className="text-txt-primary h-6 w-6" />
        </button>
      )}

      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-[rgba(9,16,26,0.95)] backdrop-blur-sm">
          <div className="flex w-full items-center gap-2.5 p-2.5">
            <div className="bg-bgc-layer2 flex flex-1 items-center justify-start gap-2 rounded-xl px-3 py-1.5">
              <a
                href={searchHref}
                onClick={handleGoSearch}
                className={`hover:text-txt-primary flex h-5 w-5 flex-shrink-0 items-center justify-center transition-colors ${iconClassName}`}
                aria-label="Tìm kiếm"
              >
                <Search className="h-5 w-5" />
              </a>
              <input
                type="text"
                placeholder="Tìm truyện..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={handleEnterSearch}
                className="text-txt-secondary placeholder:text-txt-secondary focus:text-txt-primary flex-1 bg-transparent leading-normal font-medium outline-none focus:outline-none"
                autoFocus
              />
              <button
                type="button"
                onClick={handleSearchClose}
                className="text-txt-secondary hover:text-txt-primary flex items-center justify-center rounded-lg p-1 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-lav-500"
                aria-label="Đóng tìm kiếm"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
