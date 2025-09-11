// app/components/common/WaifuMeta.tsx

type WaifuMetaProps = {
  /** T�n file ?nh tinh d� luu trong DB, v� d?:
   *  "mitsuri vinahentai.com-1756571970280-47bb08f5.webp"
   */
  filename?: string | null;
};

export default function WaifuMeta({ filename }: WaifuMetaProps) {
  if (!filename) return null;

  // ?nh tinh n?m trong /public/images/waifu/
  const url = `/images/waifu/${encodeURIComponent(filename)}`;

  return (
    <span className="text-txt-secondary inline-flex h-7 items-center gap-1 align-middle text-[12px] leading-none">
      <span className="text-txt-secondary/70">|</span>
      <span>Waifu:</span>

      {/* Mobile: nh? */}
      <span className="inline-flex h-6 items-center sm:hidden">
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
      <span className="hidden h-6 items-center sm:inline-flex">
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
