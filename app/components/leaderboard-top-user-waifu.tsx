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
  return (
    <div
      className={`p-4 ${gradientStyle} rounded-2xl ${shadowColor} outline-1 outline-offset-[-1px] ${borderColor} flex items-start justify-start gap-4 backdrop-blur`}
    >
      <div className="flex w-72 flex-row items-center justify-start gap-4">
        <div className="relative h-24 w-24 flex-shrink-0 overflow-hidden rounded bg-gradient-to-b from-gray-900/0 to-gray-900">
          <img
            src={leaderboard.userAvatar}
            alt={leaderboard.userName}
            className="h-full w-full object-cover"
          />
        </div>
        <div className="inline-flex w-44 flex-col items-start justify-start gap-2">
          <div className="flex flex-col items-start justify-start gap-1">
            <div className="text-txt-primary justify-center font-sans text-base leading-normal font-semibold">
              {leaderboard.userName}
            </div>
            {leaderboard && (
              <img
                src={getTitleImgPath({
                  level: leaderboard.userLevel,
                  faction: leaderboard.userFaction,
                  gender: leaderboard.userGender,
                } as any)}
                alt="Title"
                className="h-6 w-28"
              />
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
    </div>
  );
}
