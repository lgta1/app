import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search } from "lucide-react";

const SEARCH_PATH = "/search";

export function HeaderSearch() {
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

  const handleEnterSearch = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    window.location.href = searchHref;
  };

  const iconClassName = trimmedQuery
    ? isPurpleTone
      ? "text-[#C084FC] animate-pulse"
      : "text-txt-secondary animate-pulse"
    : "text-txt-secondary";

  const handleSearchClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const trimmed = query.trim();
    window.location.href = trimmed ? `${SEARCH_PATH}?q=${encodeURIComponent(trimmed)}` : SEARCH_PATH;
  };

  return (
    <div className="absolute left-1/2 flex w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 transform items-center gap-2 px-2 sm:max-w-[520px] sm:px-0 lg:gap-3">
      <div className="group bg-bgc-layer2 flex w-full items-center gap-2 rounded-xl px-3 py-1.5 sm:px-4">
        <a
          href={searchHref}
          onClick={handleSearchClick}
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
        />
      </div>

      <Link
        to={{ pathname: "/search/advanced", search: trimmedQuery ? `?q=${encodeURIComponent(trimmedQuery)}` : "" } as unknown as string}
        className="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-[#C084FC] bg-bgc-layer2/80 px-3 py-1.5 text-xs font-semibold text-[#E0B2FF] transition hover:bg-bgc-layer2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C084FC]"
        aria-label="Mở tìm kiếm nâng cao"
      >
        <Search className="h-4 w-4 text-[#C084FC]" strokeWidth={2.5} />
        <span>Nâng cao</span>
      </Link>
    </div>
  );
}
