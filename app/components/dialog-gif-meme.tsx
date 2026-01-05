import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

interface GifMemeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  trigger?: React.ReactNode;
  // Optional override for base CDN path
  baseUrl?: string; // e.g. https://cdn.vinahentai.xyz/gif-meme
}

const DEFAULT_BASE =
  ((import.meta as any)?.env?.VITE_CDN_BASE as string | undefined)
    ? `${(import.meta as any).env.VITE_CDN_BASE}/gif-meme`
    : ((globalThis as any)?.process?.env?.CDN_BASE as string | undefined)
      ? `${(globalThis as any).process.env.CDN_BASE}/gif-meme`
      : "https://cdn.vinahentai.xyz/gif-meme";

export default function GifMemeDialog({
  isOpen,
  onClose,
  onSelect,
  trigger,
  baseUrl = DEFAULT_BASE,
}: GifMemeDialogProps) {
  // try multiple extensions if one fails (e.g., webp -> gif -> png -> jpg)
  const buildCandidates = (fullPath: string): string[] => {
    const idx = fullPath.lastIndexOf(".");
    if (idx <= 0) return [fullPath];
    const ext = fullPath.slice(idx + 1).toLowerCase();
    const base = fullPath.slice(0, idx);
    const orderByExt: Record<string, string[]> = {
      // Không ép định dạng: ưu tiên giữ nguyên đuôi gốc, sau đó thử các biến thể phổ biến
      webp: ["webp", "gif", "png", "jpg", "jpeg"],
      gif: ["gif", "webp", "png", "jpg", "jpeg"],
      png: ["png", "webp", "gif", "jpg", "jpeg"],
      jpg: ["jpg", "jpeg", "webp", "gif", "png"],
      jpeg: ["jpeg", "jpg", "webp", "gif", "png"],
    };
    const order = orderByExt[ext] ?? [ext, "gif", "png", "jpg", "jpeg"];
    return order.map((e) => `${base}.${e}`);
  };

  const SmartImg = ({ path, className, alt }: { path: string; className?: string; alt?: string }) => {
    const candidates = useMemo(() => buildCandidates(path), [path]);
    const [idx, setIdx] = useState(0);
    const [failed, setFailed] = useState(false);
    const src = safeJoin(baseUrl.replace(/\/$/, ""), candidates[idx]);
    if (failed) return null;
    return (
      <img
        src={src}
        alt={alt ?? path}
        className={className}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (idx < candidates.length - 1) setIdx((i) => i + 1);
          else setFailed(true);
        }}
      />
    );
  };
  // Hardcoded fallback groups (when no manifest/groups listing is available)
  const HARDCODED_GROUPS: Array<{ id: string; title: string; thumb?: string; items: string[] }> = [
    {
      id: "blue-archive",
      title: "blue archive",
      thumb: "blue archive/0bl-thumnail.gif",
      items: [
        "blue archive/0bl-thumnail.gif",
        "blue archive/bl1.gif",
        "blue archive/bl10.gif",
        "blue archive/bl11.gif",
        "blue archive/bl2.gif",
        "blue archive/bl3.gif",
        "blue archive/bl4.gif",
        "blue archive/bl9.gif",
      ],
    },
    {
      id: "cat-gif",
      title: "cat gif",
      thumb: "cat gif/0-cat-thumnail.webp",
      items: [
        "cat gif/0-cat-thumnail.webp",
        "cat gif/cat10.gif",
        "cat gif/cat11.gif",
        "cat gif/cat12.gif",
        "cat gif/cat13.webp",
        "cat gif/cat14.webp",
        "cat gif/cat15.gif",
        "cat gif/cat2.jpg",
        "cat gif/cat3.gif",
        "cat gif/cat4.gif",
        "cat gif/cat5.gif",
        "cat gif/cat6.gif",
        "cat gif/cat7.gif",
        "cat gif/cat8.gif",
        "cat gif/cat9.gif",
      ],
    },
    {
      id: "doro-gif",
      title: "doro gif",
      thumb: "doro gif/doro0.gif",
      items: [
        "doro gif/doro0.gif",
        "doro gif/doro1.gif",
        "doro gif/doro11.gif",
        "doro gif/doro13.gif",
        "doro gif/doro14.gif",
        "doro gif/doro15.webp",
        "doro gif/doro16.webp",
        "doro gif/doro17.gif",
        "doro gif/doro18.gif",
        "doro gif/doro19.gif",
        "doro gif/doro2.gif",
        "doro gif/doro21.gif",
        "doro gif/doro22.gif",
        "doro gif/doro3.gif",
        "doro gif/doro4.gif",
        "doro gif/doro5.1.gif",
        "doro gif/doro5.gif",
        "doro gif/doro6.gif",
        "doro gif/doro9.gif",
      ],
    },
    {
      id: "genshin",
      title: "genshin",
      thumb: "genshin/0gi-thumnail.gif",
      items: [
        "genshin/0gi-thumnail.gif",
        "genshin/gi10.gif",
        "genshin/gi11.gif",
        "genshin/gi12.gif",
        "genshin/gi13.gif",
        "genshin/gi14.gif",
        "genshin/gi15.gif",
        "genshin/gi16.gif",
        "genshin/gi17.gif",
        "genshin/gi2.gif",
        "genshin/gi3.png",
        "genshin/gi4.png",
        "genshin/gi5.gif",
        "genshin/gi6.gif",
        "genshin/gi7.gif",
        "genshin/gi8.gif",
        "genshin/gi9.gif",
      ],
    },
    {
      id: "khac",
      title: "khac",
      thumb: "khac/0k-thumnail.gif",
      items: [
        "khac/0k-thumnail.gif",
        "khac/inunaka-akari.gif",
        "khac/k10.gif",
        "khac/k11.gif",
        "khac/k12.gif",
        "khac/k13.gif",
        "khac/k2.gif",
        "khac/k3.gif",
        "khac/k4.gif",
        "khac/k6.gif",
        "khac/k8.gif",
        "khac/k9.png",
      ],
    },
    {
      id: "peter",
      title: "peter",
      thumb: "peter/0pt-thumnail.jpg",
      items: [
        "peter/0pt-thumnail.jpg",
        "peter/pt2.webp",
        "peter/pt3.webp",
        "peter/pt4.webp",
        "peter/pt5.webp",
        "peter/pt6.webp",
        "peter/pt7.jpg",
      ],
    },
    {
      id: "troll",
      title: "troll",
      thumb: "troll/0troll-thumnail.png",
      items: [
        "troll/0troll-thumnail.png",
        "troll/troll_10.png",
        "troll/troll_101.png",
        "troll/troll_11.png",
        "troll/troll_12.png",
        "troll/troll_13.png",
        "troll/troll_14.png",
        "troll/troll_15.png",
        "troll/troll_2.png",
        "troll/troll_20.png",
        "troll/troll_22.png",
        "troll/troll_26.png",
        "troll/troll_3.png",
        "troll/troll_31.png",
        "troll/troll_32.png",
        "troll/troll_33.png",
        "troll/troll_36.png",
        "troll/troll_38.png",
        "troll/troll_39.png",
        "troll/troll_4.png",
        "troll/troll_42.png",
        "troll/troll_44.png",
        "troll/troll_45.png",
        "troll/troll_47.png",
        "troll/troll_48.png",
        "troll/troll_49.png",
        "troll/troll_5.png",
        "troll/troll_51.png",
        "troll/troll_52.png",
        "troll/troll_57.png",
        "troll/troll_58.png",
        "troll/troll_6.png",
        "troll/troll_60.png",
        "troll/troll_64.png",
        "troll/troll_65.png",
        "troll/troll_66.png",
        "troll/troll_68.png",
        "troll/troll_7.png",
        "troll/troll_71.png",
        "troll/troll_72.png",
        "troll/troll_74.png",
        "troll/troll_75.png",
        "troll/troll_76.png",
        "troll/troll_77.png",
        "troll/troll_79.png",
        "troll/troll_8.png",
        "troll/troll_80.png",
        "troll/troll_82.png",
        "troll/troll_83.png",
        "troll/troll_87.png",
        "troll/troll_88.png",
        "troll/troll_9.png",
      ],
    },
    {
      id: "xxx",
      title: "xxx",
      thumb: "xxx/0xxx-thumnail.gif",
      items: [
        "xxx/0xxx-thumnail.gif",
        "xxx/xxx2.webp",
        "xxx/xxx3.gif",
        "xxx/xxx4.gif",
        "xxx/xxx5.webp",
        "xxx/xxx6.webp",
      ],
    },
  ];

  // Flat list (legacy) + grouped model
  const [files, setFiles] = useState<string[]>([]); // legacy support
  const [groups, setGroups] = useState<Array<{ id: string; title: string; thumb?: string; items: string[] }>>([]);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Manifest fetch removed per new requirement; using app-defined groups only.

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setError(null);
    // Use app-defined groups only
    setGroups(HARDCODED_GROUPS);
    setActiveGroupId(HARDCODED_GROUPS[0]?.id || null);
    setLoading(false);
  }, [isOpen]);

  // Provide unified list of items based on active group
  const currentItems = useMemo(() => {
    if (groups.length) {
      const group = groups.find((g) => g.id === activeGroupId) || groups[0];
      return group ? group.items : [];
    }
    return files;
  }, [groups, files, activeGroupId]);

  // Policy: only GIF for động; chặn .webp trong picker để tránh webp động lỗi
  // (jpg/png vẫn cho phép cho ảnh tĩnh)
  // Không lọc định dạng theo yêu cầu mới
  const filtered = currentItems;

  // Safe URL join that preserves path separators while encoding segments
  const safeJoin = (base: string, path: string) => {
    const b = base.replace(/\/$/, "");
    const parts = path.split("/").map((p) => encodeURIComponent(p));
    return `${b}/${parts.join('/')}`;
  };

  const handlePick = (filename: string) => {
    const url = safeJoin(baseUrl, filename);
    onSelect(url);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onClose}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}

      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/50" />

        <Dialog.Content className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] fixed top-[50%] left-[50%] z-50 translate-x-[-50%] translate-y-[-50%]">
          <div className="bg-bgc-layer1 border-bd-default flex max-h-[90vh] w-[320px] flex-col gap-4 overflow-hidden rounded-2xl border p-4 sm:w-[520px] sm:gap-4 sm:p-5 md:w-[720px]">
            <div className="flex items-center justify-between">
              <Dialog.Title className="text-txt-primary font-sans text-lg font-semibold sm:text-xl">
                Chọn GIF meme
              </Dialog.Title>
              <button
                onClick={onClose}
                className="text-txt-secondary hover:text-txt-primary rounded-md px-2 py-1"
              >
                Đóng
              </button>
            </div>

            {/* Search removed per requirement */}

            {/* Group selector */}
            {groups.length > 0 && (
              <div className="flex gap-2 overflow-x-auto rounded-lg border border-bd-default p-2">
                {groups.map((g) => {
                  const isActive = g.id === activeGroupId;
                  const displayThumb = g.thumb ?? (g.items.find((p) => /thumnail|thumbnail/i.test(p)) || g.items[0]);
                  return (
                    <button
                      key={g.id}
                      onClick={() => setActiveGroupId(g.id)}
                      className={`group relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-md border text-[10px] font-medium transition-colors ${isActive ? 'border-lav-500 ring-2 ring-lav-500' : 'border-bd-default hover:border-lav-400'}`}
                      title={g.title}
                    >
                      {displayThumb ? (
                        <SmartImg
                          path={displayThumb}
                          alt={g.title}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="min-h-[180px] flex-1 overflow-auto rounded-lg border border-bd-default p-2">
              {loading ? (
                <div className="py-10 text-center text-sm text-txt-secondary">Đang tải…</div>
              ) : error ? (
                <div className="py-10 text-center text-sm text-red-500">{error}</div>
              ) : filtered.length === 0 ? (
                <div className="py-10 text-center text-sm text-txt-secondary">Không có GIF phù hợp</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                  {filtered.map((f) => (
                    <button
                      key={f}
                      onClick={() => handlePick(f)}
                      className="group relative aspect-square overflow-hidden rounded-md border border-bd-default"
                      title={f}
                    >
                      <SmartImg
                        path={f}
                        alt={f}
                        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Help hint removed per production requirement */}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
