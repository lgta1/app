import { isMobile } from "react-device-detect";
import { Link } from "react-router-dom";
import { User as UserIcon, Eye } from "lucide-react";

export type TranslatorLeaderboardRow = {
  userId: string;
  userName: string;
  userAvatar?: string | null;
  totalViews: number;
  rank: number;
};

export default function RatingItemTranslator({
  row,
  index,
}: {
  row: TranslatorLeaderboardRow;
  index: number;
}) {
  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";

  const avatarUrl = row.userAvatar || "";
  const showIcon = !avatarUrl;

  const Wrapper: any = isMobile ? "a" : Link;
  const linkProps = isMobile ? { href: `/profile/${row.userId}` } : { to: `/profile/${row.userId}` };

  return (
    <Wrapper {...linkProps} className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>

      <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full bg-[#121826] flex items-center justify-center">
        {showIcon ? (
          <UserIcon className="h-7 w-7 text-txt-primary" />
        ) : (
          <img
            src={avatarUrl}
            alt={row.userName}
            className="absolute inset-0 h-full w-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
        )}
      </div>

      <div className="flex-1 space-y-1">
        <h3 className="text-txt-primary text-base leading-6 font-semibold">{row.userName}</h3>
        <div className="flex items-center gap-2 text-txt-secondary text-xs">
          <Eye className="h-3 w-3" />
          <span>{row.totalViews.toLocaleString("vi-VN")} lượt xem</span>
        </div>
      </div>
    </Wrapper>
  );
}
