import { Link } from "react-router";

import type { UserType } from "~/database/models/user.model";
import { getAvatarPath, getTitleImgPath } from "~/helpers/user.helper";

export default function RatingItemUser({
  user,
  index,
}: {
  user: UserType;
  index: number;
}) {
  const color =
    (index === 1 && "text-[#FFE133]") ||
    (index === 2 && "text-[#5BD8FA]") ||
    (index === 3 && "text-[#FF7158]") ||
    "text-txt-primary";
  return (
    <Link to={`/profile/${user.id}`} className="flex items-center gap-3 p-3">
      <span className={`w-5 text-center text-base font-semibold ${color}`}>{index}</span>
      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded">
        <img
          src={getAvatarPath(user)}
          alt={user.name}
          className="h-full w-full object-cover"
        />
      </div>
      <div className="flex-1 space-y-1">
        <h3 className="text-txt-primary text-base leading-6 font-semibold">
          {user.name}
        </h3>
        <div className="flex items-center justify-between gap-4">
          {user && <img src={getTitleImgPath(user)} alt="Title" className="h-6 w-28" />}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 backdrop-blur-md">
              <div className="relative h-5 w-6">
                <img
                  src="/images/icons/gold-icon.png"
                  alt="gold"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-txt-primary text-xs font-medium">
                {user.gold.toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
