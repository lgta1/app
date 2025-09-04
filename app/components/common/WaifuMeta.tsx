// app/components/common/WaifuMeta.tsx
type WaifuMetaProps = {
  /** Tên file ?nh tinh dã luu trong DB */
  filename?: string | null;
  /** Chi?u cao ?nh (px). Ví d?: 40 cho top-level, 32 cho reply */
  height?: number;
};

export default function WaifuMeta({ filename, height = 28 }: WaifuMetaProps) {
  if (!filename) return null;
  const url = `/images/waifu/${encodeURIComponent(filename)}`;

  return (
    <span
      className="inline-flex items-center gap-1 leading-none align-middle text-[12px] text-txt-secondary"
      style={{ height }}
    >
      <span className="text-txt-secondary/70">|</span>
      <span>Waifu:</span>

      <span className="inline-flex items-center" style={{ height }}>
        <img
          src={url}
          alt="Waifu"
          className="w-auto rounded-[2px]"
          style={{ height }}
          loading="lazy"
          decoding="async"
          onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        />
      </span>
    </span>
  );
}
