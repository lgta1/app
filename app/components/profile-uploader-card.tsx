import { ArrowUpRight, User as UserIcon } from "lucide-react";
import { isDichGia } from "~/helpers/user.helper";

type Props = {
  displayName: string;
  avatarUrl: string | null;
  bio?: string;
  totalManga: number;
  level?: number;
  profileUrl: string;
  uploaderRole?: string | null;
};

export default function ProfileUploaderCard({
  displayName,
  avatarUrl,
  bio,
  totalManga,
  level,
  profileUrl,
  uploaderRole,
}: Props) {
  const hasBio = !!bio && bio.trim().length > 0;

  return (
    <div
      className="
        relative rounded-xl border border-white/8 bg-white/[.035]
        px-4 py-3 shadow-[0_4px_24px_-8px_rgba(0,0,0,.6)]
      "
    >
      {/* Link nhỏ góc phải */}
      <a
        href={profileUrl}
        className="absolute right-3 top-2 inline-flex items-center gap-1 text-[11px] text-white/70 hover:text-white/90 transition"
        aria-label="Xem trang cá nhân"
      >
        Xem trang cá nhân <ArrowUpRight className="h-3.5 w-3.5" />
      </a>

      {/* Hàng avatar + tên + info ngắn */}
      <div className="flex items-center gap-3 pr-24">
        {/* Avatar: dùng icon lucide khi chưa có ảnh hoặc lỗi ảnh */}
        <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#121826] ring-1 ring-purple-400/40 md:h-16 md:w-16">
          <UserIcon className="h-7 w-7 text-txt-primary md:h-8 md:w-8" />
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <a
              href={profileUrl}
              className="truncate text-[15px] font-semibold text-white hover:text-white/90"
              title={displayName}
            >
              {displayName}
            </a>
            {isDichGia(uploaderRole || "") && (
              <span
                className="ml-0.5 shrink-0 animate-[shine_3s_linear_infinite] bg-gradient-to-r from-[#C466FF] via-[#924DBF] to-[#C466FF] bg-clip-text text-transparent text-[15px] font-semibold"
              >
                – Dịch giả
              </span>
            )}
          </div>

          {/* Cấp + số truyện trên cùng 1 dòng, không icon */}
          <div className="mt-0.5 text-[12px] text-white/65">
            {typeof level === "number" ? `Cấp ${level}` : "Cấp —"} · {totalManga} truyện
          </div>
        </div>
      </div>

      {/* Bio: HIỂN THỊ TRẦN — không box, không nền, không viền, không shadow */}
      {hasBio && (
        <div className="mt-3">
          <p className="bg-transparent border-0 shadow-none p-0 m-0 text-[13px] leading-snug text-white/80 whitespace-pre-line">
            {bio}
          </p>
        </div>
      )}
    </div>
  );
}
