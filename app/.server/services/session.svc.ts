import { createCookieSessionStorage, redirect, type Session } from "react-router";

import { ENV } from "~/configs/env.config";
import type { UserType } from "~/database/models/user.model";

const USER_SESSION_KEY = "userId";
const USER_INFO_SESSION_KEY = "userInfo";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secrets: [ENV.SESSION.SECRET],
    path: "/",
    httpOnly: true,
    secure: ENV.NODE_ENV === "production",
  },
});

export const destroySession = async (session: Session) => {
  return await sessionStorage.destroySession(session);
};

export const getUserSession = async (request: Request) => {
  return await sessionStorage.getSession(request.headers.get("Cookie"));
};

export async function getUserId(request: Request): Promise<UserType["id"] | undefined> {
  const session = await getUserSession(request);
  const userId = session.get(USER_SESSION_KEY);
  return userId;
}

export async function getUserInfoFromSession(
  request: Request,
): Promise<UserType | undefined> {
  const session = await getUserSession(request);
  const userInfo = session.get(USER_INFO_SESSION_KEY);
  return userInfo;
}

export const setUserDataToSession = (session: Session, user: UserType) => {
  session.set(USER_SESSION_KEY, user.id);

  session.set(USER_INFO_SESSION_KEY, {
    name: user.name,
    email: user.email,
    faction: user.faction,
    gender: user.gender,
    role: user.role,
    level: user.level,
  });
};

export async function createUserSession({
  request,
  remember = true,
  redirectUrl = "/",
  user,
}: {
  request: Request;
  remember: boolean;
  redirectUrl?: string;
  user: UserType;
}) {
  const session = await getUserSession(request);

  setUserDataToSession(session, user);

  return redirect(redirectUrl, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        httpOnly: true,
        secure: false,
        // secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: remember
          ? 60 * 60 * 24 * 7 // 7 days
          : undefined,
      }),
    },
  });
}
