// app/components/author-select.tsx
import * as React from "react";

export type AuthorLite = {
  id: string;
  name: string;
  slug: string;
  avatarUrl?: string | null;
};

type Props = {
  initialAuthors?: AuthorLite[];
  onChange?: (authors: AuthorLite[], orderIds: string[]) => void;
  placeholder?: string;
};

type SearchItem = AuthorLite & { _isNew?: boolean };

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 10;

/** Chuẩn hoá 1 object bất kỳ thành AuthorLite (chịu mọi schema phổ biến) */
function normalizeEntity(obj: any): AuthorLite | null {
  if (!obj || typeof obj !== "object") return null;
  const id = obj.id ?? obj._id ?? obj.value ?? null;
  const name = obj.name ?? obj.title ?? obj.label ?? null;
  const slugRaw =
    obj.slug ??
    (typeof name === "string"
      ? name
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase()
          .trim()
          .replace(/\s+/g, "-")
          .replace(/[^a-z0-9\-]/g, "")
      : "");
  if (!id || !name) return null;
  return {
    id: String(id),
    name: String(name),
    slug: String(slugRaw),
    avatarUrl: obj.avatarUrl ?? obj.avatar ?? null,
  };
}

/** Lấy Author từ nhiều kiểu response của API create */
function pickAuthorFromCreateResponse(data: any): AuthorLite | null {
  const candidates: any[] = [];

  // các chỗ thường gặp
  if (data?.author) candidates.push(data.author);
  if (data?.data?.author) candidates.push(data.data.author);
  if (data?.data) candidates.push(data.data);
  if (data?.item) candidates.push(data.item);
  if (Array.isArray(data?.items)) candidates.push(...data.items);
  candidates.push(data);

  for (const c of candidates) {
    const norm = normalizeEntity(c);
    if (norm) return norm;
  }
  return null;
}

/** Lấy mảng kết quả search từ nhiều kiểu response: {items:[]}, [], {data:[]}, ... */
function extractSearchArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export default function AuthorSelect({
  initialAuthors = [],
  onChange,
  placeholder = "Thêm tác giả…",
}: Props) {
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [highlightIndex, setHighlightIndex] = React.useState<number>(-1);
  const [selected, setSelected] = React.useState<AuthorLite[]>(initialAuthors);

  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const dragIndexRef = React.useRef<number | null>(null);

  // báo về cha
  React.useEffect(() => {
    onChange?.(
      selected,
      selected.map((a) => a.id),
    );
  }, [selected, onChange]);

  // click ngoài để đóng dropdown
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!dropdownRef.current) return;
      if (
        !dropdownRef.current.contains(e.target as Node) &&
        e.target !== inputRef.current
      ) {
        setOpen(false);
        setHighlightIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // tìm kiếm có debounce
  React.useEffect(() => {
    if (!query || query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      setHighlightIndex(-1);
      if (abortRef.current) abortRef.current.abort();
      return;
    }

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/authors/search?q=${encodeURIComponent(query.trim())}&limit=${MAX_RESULTS}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setError(`Lỗi tìm kiếm (${res.status})`);
          setResults([]);
        } else {
          const data = await res.json();
          const arr = extractSearchArray(data);
          const items: AuthorLite[] = arr
            .map(normalizeEntity)
            .filter(Boolean) as AuthorLite[];

          // lọc bớt đã chọn
          const chosenIds = new Set(selected.map((s) => s.id));
          const filtered = items.filter((i) => !chosenIds.has(i.id));

          // ✅ LUÔN đặt "Tạo tác giả ..." ở TOP
          const createOption: SearchItem = {
            id: "__new__",
            name: query.trim(),
            slug: "",
            avatarUrl: null,
            _isNew: true,
          };
          const list = [createOption, ...filtered].slice(0, MAX_RESULTS);

          setResults(list);
          setOpen(true);
          setHighlightIndex(0);
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setError("Không thể kết nối search");
          setResults([]);
        }
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(t);
      controller.abort();
    };
  }, [query, selected]);

  function addAuthor(item: SearchItem) {
    if (item._isNew) {
      quickCreate(item.name);
      return;
    }
    if (selected.find((s) => s.id === item.id)) return;
    const next = [
      ...selected,
      {
        id: item.id,
        name: item.name,
        slug: item.slug,
        avatarUrl: item.avatarUrl ?? null,
      },
    ];
    setSelected(next);
    setQuery("");
    setResults([]);
    setOpen(false);
    setHighlightIndex(-1);
    inputRef.current?.focus();
  }

  async function quickCreate(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length < 2) {
      setError("Tên quá ngắn (≥ 2 ký tự).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/authors/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      // chấp nhận cả 201/409; server có thể trả {author}, {data:{author}}, {_id,name}, ...
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        setError("Phản hồi không đúng định dạng (không phải JSON).");
        return;
      }
      const author = pickAuthorFromCreateResponse(data);

      if (!author) {
        setError("Phản hồi không đúng định dạng");
        return;
      }
      if (selected.find((s) => s.id === author.id)) {
        setQuery("");
        setResults([]);
        setOpen(false);
        setHighlightIndex(-1);
        return;
      }
      setSelected((prev) => [...prev, author]);
      setQuery("");
      setResults([]);
      setOpen(false);
      setHighlightIndex(-1);
      inputRef.current?.focus();
    } catch (e) {
      setError("Không thể tạo tác giả");
    } finally {
      setLoading(false);
    }
  }

  function removeAuthor(id: string) {
    setSelected((prev) => prev.filter((s) => s.id !== id));
    inputRef.current?.focus();
  }

  // Drag & drop reorder
  function onDragStart(e: React.DragEvent<HTMLButtonElement>, index: number) {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent<HTMLButtonElement>, dropIndex: number) {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from == null || from === dropIndex) return;
    setSelected((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => (results.length === 0 ? -1 : (i + 1) % results.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) =>
        results.length === 0 ? -1 : (i - 1 + results.length) % results.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (highlightIndex >= 0 && results[highlightIndex]) {
        addAuthor(results[highlightIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setHighlightIndex(-1);
    }
  }

  // --- UI (dark-friendly) ---
  return (
    <div className="w-full" ref={dropdownRef}>
      {/* Selected tags */}
      <div className="mb-2 flex flex-wrap gap-2">
        {selected.map((a, idx) => (
          <button
            key={a.id}
            draggable
            onDragStart={(e) => onDragStart(e, idx)}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, idx)}
            className="group border-bd-default bg-bgc-layer2 text-txt-primary hover:bg-bgc-layer1 flex cursor-move items-center gap-2 rounded-full border px-3 py-1 text-sm"
            title="Kéo để đổi thứ tự"
            type="button"
          >
            {a.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.avatarUrl}
                alt={a.name}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : (
              <span className="bg-bgc-layer1 text-txt-secondary flex h-5 w-5 items-center justify-center rounded-full text-[10px]">
                {a.name.charAt(0).toUpperCase()}
              </span>
            )}
            <span>{a.name}</span>
            <span
              onClick={() => removeAuthor(a.id)}
              className="bg-bgc-layer1 text-txt-secondary hover:bg-error-error ml-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-full transition-colors hover:text-white"
              title="Bỏ gắn"
            >
              ×
            </span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setOpen(true);
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="border-bd-default bg-bgc-layer2 text-txt-secondary focus:border-lav-500 focus:text-txt-primary w-full rounded-xl border px-3 py-2.5 font-sans text-base focus:outline-none"
        />
        {loading && (
          <div className="text-txt-secondary absolute top-2 right-2 text-xs">…</div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-error-error/40 bg-error-error/10 text-error-error mt-2 rounded-lg border px-3 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="border-bd-default bg-bgc-layer1 mt-1 w-full overflow-hidden rounded-xl border shadow-lg">
          <ul className="max-h-64 overflow-auto">
            {results.map((item, i) => (
              <li
                key={item._isNew ? "__new__" : item.id}
                className={`cursor-pointer px-3 py-2 text-sm ${
                  i === highlightIndex ? "bg-bgc-layer2" : "bg-bgc-layer1"
                } hover:bg-bgc-layer2 text-txt-primary`}
                onMouseEnter={() => setHighlightIndex(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => addAuthor(item)}
                title={item._isNew ? `Tạo tác giả "${item.name}"` : item.name}
              >
                {item._isNew ? (
                  <span>
                    ➕ Tạo tác giả <strong>“{item.name}”</strong>
                  </span>
                ) : (
                  <span>{item.name}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
