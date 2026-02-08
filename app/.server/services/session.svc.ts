import { createCookieSessionStorage, redirect, type Session } from "react-router";

import { ENV } from "@/configs/env.config";

import type { UserType } from "~/database/models/user.model";

const USER_INFO_SESSION_KEY = "userInfo";

// Per-request memoization to avoid duplicate DB hits when multiple layers
// call getUserInfoFromSession() during the same loader/action execution.
const userInfoRequestCache = new WeakMap<Request, Promise<UserType | undefined>>();

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__session",
    secrets: [ENV.SESSION.SECRET],
    path: "/",
    httpOnly: true,
    secure: ENV.IS_PRODUCTION,
    domain: ENV.COOKIE_DOMAIN,
  },
});

export const destroySession = async (session: Session) => {
  return await sessionStorage.destroySession(session);
};

export const getUserSession = async (request: Request) => {
  return await sessionStorage.getSession(request.headers.get("Cookie"));
};

export async function getUserInfoFromSession(
  request: Request,
): Promise<UserType | undefined> {
  const cached = userInfoRequestCache.get(request);
  if (cached) return cached;

  const promise = (async () => {
  const session = await getUserSession(request);
  const userInfo = session.get(USER_INFO_SESSION_KEY) as UserType | undefined;
  if (!userInfo?.id) return undefined;

  // IMPORTANT:
  // The session stores a snapshot of userInfo at login time.
  // If role changes in DB (e.g. grant translator/DICHGIA), the cookie remains stale
  // until user logs out/in again. To make role changes effective immediately,
  // we hydrate the session user from DB on each request and return a safe subset.
  try {
    const { UserModel } = await import("~/database/models/user.model");
    const fresh = await UserModel.findById(userInfo.id)
      .select("name email faction gender role level avatar isDeleted canSkipWatermark")
      .lean();

    if (!fresh || (fresh as any).isDeleted) return undefined;

    return {
      id: String((fresh as any).id ?? (fresh as any)._id ?? userInfo.id),
      name: (fresh as any).name,
      email: (fresh as any).email,
      faction: (fresh as any).faction,
      gender: (fresh as any).gender,
      role: (fresh as any).role,
      level: (fresh as any).level,
      avatar: (fresh as any).avatar,
      canSkipWatermark: Boolean((fresh as any).canSkipWatermark),
    } as UserType;
  } catch {
    // Fail open to the session snapshot (keeps app working if DB temporarily fails).
    return userInfo;
  }
  })();

  userInfoRequestCache.set(request, promise);
  return promise;
}

export const setUserDataToSession = (session: Session, user: UserType) => {
  // `UserModel.findOne(...).lean()` returns plain objects that often don't have
  // the virtual `id` field. Ensure we always persist a stable string id.
  const userId = String((user as unknown as { id?: unknown; _id?: unknown }).id ?? (user as unknown as { _id?: unknown })._id ?? "");

  session.set(USER_INFO_SESSION_KEY, {
    id: userId,
    name: user.name,
    email: user.email,
    faction: user.faction,
    gender: user.gender,
    role: user.role,
    level: user.level,
    avatar: user.avatar,
    canSkipWatermark: Boolean((user as any).canSkipWatermark),
  });
};

export const commitUserSession = async (session: Session, remember = true) => {
  return await sessionStorage.commitSession(session, {
    httpOnly: true,
    secure: ENV.IS_PRODUCTION,
    sameSite: "lax",
    domain: ENV.COOKIE_DOMAIN,
    maxAge: remember
      ? 60 * 60 * 24 * 7 // 7 days
      : undefined,
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

  return redirect(encodeURI(redirectUrl), {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session, {
        httpOnly: true,
        secure: ENV.IS_PRODUCTION,
        sameSite: "lax",
        domain: ENV.COOKIE_DOMAIN,
        maxAge: remember
          ? 60 * 60 * 24 * 7 // 7 days
          : undefined,
      }),
    },
  });
}
