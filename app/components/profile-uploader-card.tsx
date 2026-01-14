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
      className="relative bg-bgc-layer1 border-bd-default rounded-2xl border px-4 py-3"
    >
      {/* Link nhỏ góc phải */}
      <a
        href={profileUrl}
        className="absolute right-3 top-2 inline-flex items-center gap-1 text-[11px] text-txt-secondary hover:text-txt-primary transition"
        aria-label="Xem trang cá nhân"
      >
        Xem trang cá nhân <ArrowUpRight className="h-3.5 w-3.5" />
      </a>

      {/* Hàng avatar + tên + info ngắn */}
      <div className="flex items-center gap-3 pr-24">
        {/* Avatar: dùng icon lucide khi chưa có ảnh hoặc lỗi ảnh */}
        <div className="border-bd-default bg-bgc-layer2 relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border md:h-16 md:w-16">
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
              className="text-txt-primary truncate text-[15px] font-semibold hover:opacity-90"
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
          <div className="text-txt-secondary mt-0.5 text-[12px]">
            {typeof level === "number" ? `Cấp ${level}` : "Cấp —"} · {totalManga} truyện
          </div>
        </div>
      </div>

      {/* Bio: HIỂN THỊ TRẦN — không box, không nền, không viền, không shadow */}
      {hasBio && (
        <div className="mt-3">
          <p className="text-txt-secondary bg-transparent border-0 shadow-none p-0 m-0 text-[13px] leading-snug whitespace-pre-line">
            {bio}
          </p>
        </div>
      )}
    </div>
  );
}
