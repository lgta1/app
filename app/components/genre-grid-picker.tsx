import { useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";

import type { GenresType } from "~/database/models/genres.model";
import { stripDiacritics } from "~/utils/text-normalize";

type GenreLite = Pick<GenresType, "slug" | "name">;

export interface GenreGridPickerProps {
  genres: GenreLite[];
  selectedSlugs: ReadonlyArray<string> | ReadonlySet<string>;
  onToggle: (slug: string) => void;
  placeholder?: string;
  helperText?: ReactNode;
  showLetterNav?: boolean;
  maxHeightClassName?: string;
  gridClassName?: string;
  panelClassName?: string;
}

const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const foldVN = (value: string) => stripDiacritics(value || "").toLowerCase();

function toSet(values: ReadonlyArray<string> | ReadonlySet<string>): ReadonlySet<string> {
  return values instanceof Set ? values : new Set(values);
}

export function GenreGridPicker({
  genres,
  selectedSlugs,
  onToggle,
  placeholder = "Có thể nhập nhiều từ khóa cùng lúc để tìm",
  helperText,
  showLetterNav = true,
  maxHeightClassName = "max-h-[360px]",
  gridClassName = "grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3",
  panelClassName = "overflow-y-auto rounded-lg border border-white/10 p-3 pr-1 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]",
}: GenreGridPickerProps) {
  const [genreQuery, setGenreQuery] = useState("");

  const selected = useMemo(() => toSet(selectedSlugs), [selectedSlugs]);

  const sortedGenres: GenreLite[] = useMemo(() => {
    const list = Array.isArray(genres) ? genres.slice() : [];
    const uniq = new Map<string, GenreLite>();
    for (const g of list) {
      if (!g?.slug || !g?.name) continue;
      if (!uniq.has(g.slug)) uniq.set(g.slug, g);
    }

    return Array.from(uniq.values()).sort((a, b) => {
      const aa = foldVN(a.name);
      const bb = foldVN(b.name);
      if (aa < bb) return -1;
      if (aa > bb) return 1;
      return 0;
    });
  }, [genres]);

  const tokens: string[] = useMemo(() => {
    return foldVN(genreQuery).split(/[\s,]+/).filter(Boolean);
  }, [genreQuery]);

  const filtered: GenreLite[] = useMemo(() => {
    if (!tokens.length) return sortedGenres;

    const onlySingleLetters = tokens.every((t) => /^[a-z]$/.test(t));
    if (onlySingleLetters) {
      const letters = new Set(tokens.map((t) => t.toUpperCase()));
      return sortedGenres.filter((g) => letters.has((foldVN(g.name)[0] || "#").toUpperCase()));
    }

    return sortedGenres.filter((g) => {
      const hay = `${foldVN(g.name)} ${(g.slug || "").toLowerCase()}`;
      return tokens.some((t) => hay.includes(t));
    });
  }, [sortedGenres, tokens]);

  const groupedGenres = useMemo(() => {
    const map: Record<string, GenreLite[]> = {};
    for (const g of filtered) {
      const first = (foldVN(g.name)[0] || "#").toUpperCase();
      const key = AZ.includes(first) ? first : "#";
      (map[key] ||= []).push(g);
    }
    const out: Array<[string, GenreLite[]]> = [];
    if (map["#"]?.length) out.push(["#", map["#"]]);
    for (const letter of AZ) if (map[letter]?.length) out.push([letter, map[letter]]);
    return out;
  }, [filtered]);

  const setLetterFilter = (letter: string) => {
    setGenreQuery(letter.toLowerCase());
  };

  return (
    <div className="flex w-full flex-col gap-3">
      {helperText ? <div className="text-txt-secondary text-xs">{helperText}</div> : null}

      <label className="relative w-full max-w-[360px]">
        <input
          value={genreQuery}
          onChange={(e) => setGenreQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-md border border-bd-default bg-bgc-layer2 px-3 py-2 text-base outline-none focus:ring-2 focus:ring-primary/40 md:text-sm"
        />
      </label>

      {showLetterNav ? (
        <div className="flex max-w-full flex-wrap gap-1">
          {AZ.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => setLetterFilter(letter)}
              className="rounded-md border border-bd-default/60 bg-bgc-layer2 px-2 py-1 text-[11px] font-semibold text-txt-secondary hover:text-txt-primary"
            >
              {letter}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`${maxHeightClassName} ${panelClassName}`}>
        <div className="space-y-4">
          {groupedGenres.map(([letter, items]) => (
            <div key={letter}>
              <div className="mb-2 flex items-center gap-2">
                <div className="text-sm font-bold text-txt-focus">{letter}</div>
                <div className="h-px flex-1 bg-bd-default/60" />
              </div>

              <div className={gridClassName}>
                {items.map((genre) => {
                  const checked = selected.has(genre.slug);
                  return (
                    <label
                      key={genre.slug}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 select-none hover:bg-white/5"
                    >
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggle(genre.slug)}
                          className="bg-bgc-layer2 border-bd-default checked:bg-lav-500 checked:border-lav-500 h-4 w-4 cursor-pointer appearance-none rounded border"
                        />
                        {checked ? (
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <Check className="text-txt-primary h-3 w-3" />
                          </div>
                        ) : null}
                      </div>

                      <span className="text-txt-primary line-clamp-1 font-sans text-xs font-medium">
                        <span className="font-bold">{genre.name.slice(0, 1)}</span>
                        {genre.name.slice(1)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          {groupedGenres.length === 0 ? (
            <div className="text-sm text-txt-secondary">Không có thể loại phù hợp.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
