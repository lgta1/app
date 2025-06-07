import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user";

interface LeaderboardTopUserProps {
  user: UserType;
  rank: number;
  gradientStyle: string;
  borderColor: string;
  shadowColor: string;
}

export function LeaderboardTopUser({
  user,
  rank,
  gradientStyle,
  borderColor,
  shadowColor,
}: LeaderboardTopUserProps) {
  return (
    <div
      className={`p-4 ${gradientStyle} rounded-2xl ${shadowColor} outline-1 outline-offset-[-1px] ${borderColor} flex items-start justify-start gap-4 backdrop-blur`}
    >
      <div className="flex items-center justify-start gap-4">
        <div className="relative h-24 w-24 overflow-hidden rounded bg-gradient-to-b from-gray-900/0 to-gray-900">
          <img src={user.avatar} alt={user.name} className="h-full w-full object-cover" />
        </div>
        <div className="inline-flex flex-col items-start justify-start gap-3">
          <div className="text-txt-primary w-44 justify-center text-base font-semibold">
            {user.name}
          </div>
          <div className="flex flex-col items-start justify-start gap-2 self-stretch">
            {user && <img src={getTitleImgPath(user)} alt="Title" className="h-7 w-28" />}
            <div className="inline-flex items-center justify-start gap-3 self-stretch">
              <div className="flex items-center justify-center gap-1.5 rounded-[32px] backdrop-blur-[3.40px]">
                <div className="relative h-5 w-6">
                  <img
                    src="/images/icons/gold-icon.png"
                    alt="gold"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-txt-primary justify-center text-xs font-medium">
                  {user.gold}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
