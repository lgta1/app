import { Link } from "react-router-dom";
import { User as UserIcon } from "lucide-react";

import type { UserWaifuLeaderboardType } from "~/database/models/user-waifu-leaderboard.model";
import { getTitleImgPath } from "~/helpers/user.helper";

interface LeaderboardTopUserWaifuProps {
  leaderboard: UserWaifuLeaderboardType;
  gradientStyle: string;
  borderColor: string;
  shadowColor: string;
}

export function LeaderboardTopUserWaifu({
  leaderboard,
  gradientStyle,
  borderColor,
  shadowColor,
}: LeaderboardTopUserWaifuProps) {
  const avatarUrl = leaderboard.userAvatar;
  const showIcon = !avatarUrl;

  return (
    <Link
      to={`/profile/${leaderboard.userId}`}
      className={`p-4 ${gradientStyle} rounded-2xl ${shadowColor} outline-1 outline-offset-[-1px] ${borderColor} flex items-start justify-start gap-4 backdrop-blur`}
    >
      <div className="flex w-72 flex-row items-center justify-start gap-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-gradient-to-b from-gray-900/0 to-gray-900 flex items-center justify-center">
          {showIcon ? (
            <UserIcon className="h-10 w-10 text-txt-primary" />
          ) : (
            <img
              src={avatarUrl}
              alt={leaderboard.userName}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          )}
        </div>

        <div className="inline-flex w-44 flex-col items-start justify-start gap-2">
          <div className="flex flex-col items-start justify-start gap-1">
            <div className="text-txt-primary justify-center font-sans text-base leading-normal font-semibold">
              {leaderboard.userName}
            </div>

            {leaderboard && (
              // Badge: giữ tỉ lệ gốc, mobile x2 / desktop x1.5 – không nở khung
              <span className="relative inline-flex h-6 overflow-visible">
                <img
                  src={getTitleImgPath({
                    level: leaderboard.userLevel,
                    faction: leaderboard.userFaction,
                    gender: leaderboard.userGender,
                  } as any)}
                  alt="Title"
                  className="block h-full w-auto object-contain"
                  style={{
                    transform: "scale(2)",            // mobile mặc định
                    transformOrigin: "center",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
                <style>
                  {`
                    @media (min-width: 1024px) {
                      .relative.inline-flex.h-6.overflow-visible img {
                        transform: scale(1.5);
                      }
                    }
                  `}
                </style>
              </span>
            )}
          </div>

          <div className="inline-flex flex-row items-start justify-between gap-1 self-stretch">
            <div className="inline-flex flex-col items-start justify-start gap-1">
              <div className="text-txt-secondary justify-center font-sans text-xs leading-none font-medium">
                Tổng số Waifu
              </div>
              <div className="text-txt-primary justify-center font-sans text-base leading-normal font-medium">
                {leaderboard.totalWaifu}
              </div>
            </div>
            <div className="inline-flex flex-col items-start justify-start gap-1">
              <div className="text-txt-secondary justify-center font-sans text-xs leading-none font-medium">
                Waifu 5 sao
              </div>
              <div className="text-txt-primary justify-center font-sans text-base leading-normal font-medium">
                {leaderboard.totalWaifu5Stars}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}