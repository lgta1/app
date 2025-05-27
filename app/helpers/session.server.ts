import { createCookieSessionStorage, redirect, type Session } from "react-router";

import { ENV } from "~/configs/env.config";

const USER_SESSION_KEY = "userId";

type User = { id: string; username: string; password: string };

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

export async function getUserId(request: Request): Promise<User["id"] | undefined> {
  const session = await getUserSession(request);
  const userId = session.get(USER_SESSION_KEY);
  return userId;
}

export async function createUserSession({
  request,
  userId,
  remember = true,
  redirectUrl = "/",
}: {
  request: Request;
  userId: string;
  remember: boolean;
  redirectUrl?: string;
}) {
  const session = await getUserSession(request);
  session.set(USER_SESSION_KEY, userId);
  return redirect(redirectUrl, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: remember
          ? 60 * 60 * 24 * 7 // 7 days
          : undefined,
      }),
    },
  });
}
