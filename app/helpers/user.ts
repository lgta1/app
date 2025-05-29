import { ROLES } from "~/constants/user";

export const isAdmin = (role: string) => {
  return [ROLES.ADMIN, ROLES.MOD].includes(role);
};
