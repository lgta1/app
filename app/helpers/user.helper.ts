import { ROLES } from "~/constants/user";
import type { UserType } from "~/database/models/user.model";

export const isAdmin = (role: string) => {
  return [ROLES.ADMIN, ROLES.MOD].includes(role);
};

export const getTitleImgPath = (user: UserType) => {
  if (user.faction === 0) {
    if (user.level <= 3) {
      return `/images/title/0/${user.level}_${user.gender}.png`;
    }
    return `/images/title/0/${user.level}.png`;
  } else if (user.faction === 1) {
    return `/images/title/1/${user.level}.png`;
  }
};
