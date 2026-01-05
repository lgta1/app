// app/routes/user.blacklist-tags.tsx
import { useMemo, useRef, useState, useEffect } from "react";
import { redirect, useActionData, useLoaderData, useNavigation } from "react-router-dom";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "react-router-dom";
import { Check, Tag, X } from "lucide-react";

import { requireLogin } from "@/services/auth.server";
import { getAllGenres } from "@/queries/genres.query";
import { UserModel } from "~/database/models/user.model";
import type { GenresType } from "~/database/models/genres.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Lọc thể loại không thích - WW" },
    { name: "description", content: "Chọn các thể loại bạn không muốn xem trong danh sách truyện." },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireLogin(request);
  const genres = await getAllGenres();
  const userDoc = await UserModel.findById(user.id).select("blacklistTags").lean();
  const blacklist = (userDoc?.blacklistTags || []) as string[];
  return { genres, blacklist };
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireLogin(request);
  const formData = await request.formData();
  const raw = String(formData.get("blacklist") || "[]");
  let list: string[] = [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) list = parsed.map((s) => String(s).trim().toLowerCase());
  } catch {}
  // Deduplicate and trim
  const uniq = Array.from(new Set(list.filter(Boolean)));
  await UserModel.findByIdAndUpdate(user.id, { $set: { blacklistTags: uniq } });
  return redirect("/user/blacklist-tags");
}

// VN fold (same as MangaCreate)
const foldVN = (s: string) =>
  (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]+/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();

export default function BlacklistTagsPage() {
  const { genres, blacklist } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [selected, setSelected] = useState<string[]>(Array.isArray(blacklist) ? blacklist.slice() : []);
  const [q, setQ] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  // Persist immediately for client-side effects (MangaCard overlay) before redirect completes
  const persistLocal = (arr: string[]) => {
    try {
      localStorage.setItem("vh_blacklist_tags", JSON.stringify(arr));
    } catch {}
  };

  useEffect(() => {
    // Ensure we have latest from loader when navigated back
    setSelected(Array.isArray(blacklist) ? blacklist.slice() : []);
  }, [blacklist]);

  const sortedGenres: GenresType[] = useMemo(() => {
    const list = Array.isArray(genres) ? genres.slice() : [];
    const uniq = new Map<string, GenresType>();
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

  const tokens: string[] = useMemo(
    () => foldVN(q).split(/[\s,]+/).filter(Boolean) as string[],
    [q]
  );

  const filtered = useMemo(() => {
    if (!tokens.length) return sortedGenres;
    const onlySingleLetters = tokens.every((t: string) => /^[a-z]$/.test(t));
    if (onlySingleLetters) {
      const L = new Set(tokens.map((t: string) => t.toUpperCase()));
      return sortedGenres.filter((g: GenresType) => L.has((foldVN(g.name)[0] || "#").toUpperCase()));
    }
    return sortedGenres.filter((g: GenresType) => {
      const hay = `${foldVN(g.name)} ${(g.slug || "").toLowerCase()}`;
      return tokens.some((t: string) => hay.includes(t));
    });
  }, [sortedGenres, tokens]);

  const AZ = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const grouped = useMemo(() => {
    const map: Record<string, GenresType[]> = {};
    for (const g of filtered) {
      const first = (foldVN(g.name)[0] || "#").toUpperCase();
      const key = AZ.includes(first) ? first : "#";
      (map[key] ||= []).push(g);
    }
    const out: Array<[string, GenresType[]]> = [];
    if (map["#"]?.length) out.push(["#", map["#"]]);
    for (const L of AZ) if (map[L]?.length) out.push([L, map[L]]);
    return out;
  }, [filtered]);

  const toggle = (slug: string) => {
    setSelected((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      return next;
    });
  };

  const handleSave = () => {
    persistLocal(selected);
    formRef.current?.requestSubmit();
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6">
      <h1 className="text-txt-primary font-sans text-2xl leading-9 font-semibold">Lọc thể loại không thích</h1>

      {/* Current selection chips */}
      <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-4 shadow-lg">
        <div className="mb-3 text-sm text-txt-secondary">Các thể loại hiện đang bị ẩn:</div>
        <div className="flex flex-wrap gap-2">
          {selected.length === 0 && (
            <span className="text-xs text-txt-secondary">Chưa có thể loại nào.</span>
          )}
          {selected.map((slug) => (
            <span key={slug} className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs text-txt-primary">
              <span>{slug}</span>
              <button
                type="button"
                className="rounded-full bg-white/10 p-0.5 hover:bg-white/20"
                onClick={() => toggle(slug)}
                aria-label={`Xóa ${slug}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Genre selection grid */}
      <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-4 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <Tag className="text-txt-secondary h-4 w-4" />
          <div className="text-txt-primary font-sans text-base font-semibold">Chọn thể loại để ẩn</div>
        </div>
        <div className="mb-3 text-xs text-txt-secondary">Gõ a,b,c để lọc theo chữ đầu; hoặc nhập nhiều từ khóa để tìm nhanh (vd: manhwa color series).</div>

        <label className="relative mb-4 block w-full max-w-[360px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Có thể nhập nhiều từ khóa cùng lúc để tìm (vd: manhwa color series)"
            className="w-full rounded-md border border-bd-default bg-bgc-layer2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>

        <div className="max-h-[420px] overflow-y-auto rounded-lg border border-white/10 p-3 pr-1 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
          <div className="space-y-4">
            {grouped.map(([letter, items]) => (
              <div key={letter}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="text-sm font-bold text-txt-focus">{letter}</div>
                  <div className="h-px flex-1 bg-bd-default/60" />
                </div>

                <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                  {items.map((genre) => {
                    const checked = selected.includes(genre.slug);
                    return (
                      <label key={genre.slug} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 select-none hover:bg-white/5">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(genre.slug)}
                            className="bg-bgc-layer2 border-bd-default checked:bg-lav-500 checked:border-lav-500 h-4 w-4 cursor-pointer appearance-none rounded border"
                          />
                          {checked && (
                            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                              <Check className="text-txt-primary h-3 w-3" />
                            </div>
                          )}
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

            {grouped.length === 0 && (
              <div className="text-sm text-txt-secondary">Không có thể loại phù hợp.</div>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <form ref={formRef} method="post">
        <input type="hidden" name="blacklist" value={JSON.stringify(selected)} readOnly />
        <div className="flex items-center justify-end gap-3">
          <a href="/" className="rounded-xl border border-bd-default px-4 py-2 text-sm font-medium text-txt-primary">Hủy</a>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-2.5 text-sm font-semibold text-black shadow-lg disabled:opacity-50"
          >
            {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </div>
  );
}
