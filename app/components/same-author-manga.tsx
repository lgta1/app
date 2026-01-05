import React from "react";
import { Link } from "react-router-dom";
import { User } from "lucide-react";
import type { MangaType } from "~/database/models/manga.model";
import { buildMangaUrl } from "~/utils/manga-url.utils";

export function SameAuthorManga({ items }: { items: MangaType[] }) {
  if (!items || items.length === 0) return null;
  const list = items.slice(0, 5);
  const truncate = (s: string, n: number) => (s?.length > n ? s.slice(0, n).trimEnd() + "…" : s);
  const THUMB_SCALE = 1.4;
  const THUMB_W = 56 * THUMB_SCALE;

  return (
    <section className="mt-8">
      <div className="flex items-center gap-3">
        <User className="h-4 w-4 text-lav-500" />
        <h2 className="text-txt-primary text-xl font-semibold uppercase">cùng tác giả</h2>
      </div>

      {/* Vertical list with wrapper like Recommended */}
      <div className="mt-4 bg-bgc-layer1 border-bd-default rounded-2xl border p-4">
        <div className="space-y-5">
          {list.map((m) => (
            <Link
              key={(m as any).id ?? (m as any)._id}
              to={buildMangaUrl(m as any)}
              className="flex items-start gap-4 rounded-lg transition-colors hover:bg-white/5 p-2 -m-2"
            >
              <div
                className="aspect-[2/3] shrink-0 overflow-hidden rounded-lg bg-black/20"
                style={{ width: THUMB_W }}
              >
                <img
                  src={(m as any).poster || (m as any).cover || (m as any).thumbnail || (m as any).image}
                  alt={(m as any).title}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-txt-primary text-base font-semibold">
                  <span className="hidden lg:inline">{truncate((m as any).title ?? "", 32)}</span>
                  <span className="lg:hidden truncate inline-block max-w-full align-bottom">{(m as any).title}</span>
                </div>
                {Boolean((m as any).description) && (
                  <div className="text-txt-secondary mt-1 line-clamp-2 text-sm">
                    {(m as any).description}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}