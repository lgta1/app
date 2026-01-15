import type { LoaderFunctionArgs } from "react-router-dom";

import { requireLogin } from "@/services/auth.server";

import { UserModel } from "~/database/models/user.model";
import { UserFollowMangaModel } from "~/database/models/user-follow-manga.model";
import { UserReadChapterModel } from "~/database/models/user-read-chapter.model";
import { getMaxExp } from "~/helpers/user-level.helper";
import { getUserWaifuInventoryCollection } from "~/.server/queries/user-waifu-inventory.query";
import { rewriteLegacyCdnUrl } from "~/.server/utils/cdn-url";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

export async function loader({ request }: LoaderFunctionArgs) {
  const userSession = await requireLogin(request);
  const userData = await UserModel.findById(userSession.id)
    .select("name avatar createdAt level exp gold bio exp mangasCount faction gender currentWaifu")
    .populate("currentWaifu")
    .lean();

  if (userData && typeof (userData as any).avatar === "string") {
    (userData as any).avatar = rewriteLegacyCdnUrl((userData as any).avatar);
  }

  try {
    const cw: any = (userData as any)?.currentWaifu;
    if (cw && typeof cw === "object") {
      const nextImg = normalizeWaifuImageUrl(cw.image);
      if (nextImg) cw.image = nextImg;
    }
  } catch {
    // ignore
  }

  const maxExp = userData?.level === 9 ? "Tối đa" : getMaxExp(userData?.level || 1);

  const chaptersRead = await UserReadChapterModel.countDocuments({ userId: userSession.id });
  const mangasFollowing = await UserFollowMangaModel.countDocuments({ userId: userSession.id });

  const inv = await getUserWaifuInventoryCollection(userSession.id);
  const waifuCollection = Array.isArray(inv?.waifuCollection) ? inv.waifuCollection : [];
  const waifuCount = Number(inv?.waifuCount || 0);

  return {
    ...(userData as any),
    waifuCollection,
    waifuCount,
    chaptersRead,
    mangasFollowing,
    maxExp,
  };
}
