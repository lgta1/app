// app/components/common/WaifuMeta.tsx

type WaifuMetaProps = {
  /** Tên file ?nh tinh dã luu trong DB, ví d?:
   *  "mitsuri vinahentai.com-1756571970280-47bb08f5.webp"
   */
  filename?: string | null;
};

export default function WaifuMeta({ filename }: WaifuMetaProps) {
  if (!filename) return null;

  // ?nh tinh n?m trong /public/images/waifu/
  const url = `/images/waifu/${encodeURIComponent(filename)}`;

  return (
    <span className="inline-flex items-center gap-1 h-7 leading-none align-middle text-[12px] text-txt-secondary">
      <span className="text-txt-secondary/70">|</span>
      <span>Waifu:</span>

      {/* Mobile: nh? */}
      <span className="sm:hidden inline-flex items-center h-6">
        <img
          src={url}
          alt="Waifu"
          width={16}
          height={24}
          className="h-6 w-auto rounded-[2px]"
          loading="lazy"
          decoding="async"
        />
      </span>

      {/* Desktop: l?n hon */}
      <span className="hidden sm:inline-flex items-center h-6">
        <img
          src={url}
          alt="Waifu"
          width={20}
          height={30}
          className="h-7 w-auto rounded-[2px]"
          loading="lazy"
          decoding="async"
        />
      </span>
    </span>
  );
}
