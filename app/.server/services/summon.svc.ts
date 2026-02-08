import Promise from "bluebird";
import type { ClientSession } from "mongoose";

import { grantWaifu } from "@/services/waifu-inventory.svc";

import { getUserSession, setUserDataToSession } from "./session.svc";

import { GIFT_MILESTONES } from "~/constants/summon";
import { type BannerType } from "~/database/models/banner.model";
import { type PityCumulativeType } from "~/database/models/pity-cumulative.model";
import { UserModel, type UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { WaifuModel } from "~/database/models/waifu.model";
import { BusinessError } from "~/helpers/errors.helper";
import { cleanupUserSummonHistory } from "~/helpers/user.helper";
import { updateUserExp } from "~/helpers/user-level.helper";
import { normalizeWaifuImageUrl } from "~/.server/utils/waifu-image";

const RATE_UP_PERCENT = 55;

type SummonOptions = {
  session?: ClientSession;
};

const getExpValue = (star: number) => {
  if (star === 1) return 5;
  if (star === 2) return 10;
  return 0;
};


export const summon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  request?: Request,
  options: SummonOptions = {},
) => {
  const { session } = options;
  const bannerIdStr =
    (banner as any)?._id?.toString?.() ?? (banner as any)?.id?.toString?.() ?? "";
  if (!bannerIdStr) throw new BusinessError("Thiếu bannerId");

  let reachedMilestone: number | false = false;
  let updatedSession = null;

  if (banner.isRateUp) {
    const userFullQuery = UserModel.findOneAndUpdate(
      { _id: user.id },
      { $inc: { summonCount: 1 } },
      { new: true },
    );
    if (session) userFullQuery.session(session);
    const userFull = await userFullQuery.lean();
    reachedMilestone = await checkEligibleGift(userFull?.summonCount ?? 0);
  }

  //   Get item star
  let itemStar = 1;
  {
    const r = Math.random() * 100;
    for (let i = 0; i < cum.rates.length; i++) {
      if (r < cum.rates[i]) {
        itemStar = i + 1;
        break;
      }
    }
  }

  //   Get item exp
  if (itemStar < 3) {
    const expValue = getExpValue(itemStar);

    // Lấy thông tin user hiện tại trước khi update
    const currentUserForExpQuery = UserModel.findById(user.id);
    if (session) currentUserForExpQuery.session(session);
    const currentUserForExp = await currentUserForExpQuery.lean();
    if (!currentUserForExp) {
      throw new BusinessError("Không tìm thấy thông tin người dùng");
    }

    const { newExp, newLevel, didLevelUp } = updateUserExp(
      currentUserForExp as UserType,
      expValue,
    );

    if (didLevelUp) {
      // Nếu level up, cập nhật exp (reset theo level) và level
      await UserModel.updateOne(
        { _id: user.id },
        { $set: { exp: newExp, level: newLevel } },
        session ? { session } : undefined,
      );

      // Cập nhật session nếu có request
      if (request) {
        const session = await getUserSession(request);
        const updatedUser = { ...user, level: newLevel, exp: newExp };
        setUserDataToSession(session, updatedUser);
        updatedSession = session;
      }
    } else {
      // Nếu không level up, chỉ tăng exp (in-level)
      await UserModel.updateOne(
        { _id: user.id },
        { $inc: { exp: expValue } },
        session ? { session } : undefined,
      );
    }

    const expItemQuery = WaifuModel.findOne({
      $or: [{ stars: itemStar }, { stars: String(itemStar) }],
    });
    if (session) expItemQuery.session(session);
    const expItem = await expItemQuery.lean();
    if (!expItem) {
      throw new BusinessError("Thiếu vật phẩm EXP 1-2 sao trong admin");
    }
    const expItemResolved: any = expItem;

    try {
      const nextImg = normalizeWaifuImageUrl((expItemResolved as any)?.image);
      if (nextImg) (expItemResolved as any).image = nextImg;
    } catch {}

    if (typeof (expItemResolved as any).image === "string") {
      const nextImg = normalizeWaifuImageUrl((expItemResolved as any).image);
      if (nextImg) (expItemResolved as any).image = nextImg;
    }

    await cleanupUserSummonHistory(user.id, 50, session);

    // Debug: log exp item created
    try {
      // eslint-disable-next-line no-console
      console.log(
        `[summon.svc] creating EXP item for user=${user.id} expItemId=${expItemResolved?.id ?? expItemResolved?._id?.toString?.()} name=${expItemResolved?.name}`,
      );
    } catch {}

    const expItemId =
      (expItemResolved as any)?.id ?? (expItemResolved as any)?._id?.toString?.();
    if (!expItemId) throw new BusinessError("Thiếu ID vật phẩm EXP");

    if (session) {
      await UserWaifuModel.create(
        [
          {
            bannerId: bannerIdStr,
            userId: user.id,
            waifuId: expItemId,
            waifuName: expItemResolved?.name,
            waifuStars: expItemResolved?.stars,
          },
        ],
        { session },
      );
    } else {
      await UserWaifuModel.create({
        bannerId: bannerIdStr,
        userId: user.id,
        waifuId: expItemId,
        waifuName: expItemResolved?.name,
        waifuStars: expItemResolved?.stars,
      });
    }

    return {
      type: "exp",
      itemStar,
      item: expItemResolved,
      expValue,
      updatedSession,
      milestoneReached: reachedMilestone || null,
    };
  }

  //   Get item waifu
  let waifu;
  if (banner?.isRateUp && Math.random() * 100 < RATE_UP_PERCENT) {
    const waifuRateUpList = banner.waifuList.filter((waifu) => waifu.stars === itemStar);
    if (waifuRateUpList.length > 0) {
      waifu = waifuRateUpList[Math.floor(Math.random() * waifuRateUpList.length)];
    }
  }
  if (!waifu) {
    const waifuCountQuery = WaifuModel.countDocuments({ stars: itemStar });
    if (session) waifuCountQuery.session(session);
    const waifuCount = await waifuCountQuery;
    const waifuIndex = Math.floor(Math.random() * waifuCount);
    const waifuQuery = WaifuModel.findOne({ stars: itemStar }).skip(waifuIndex);
    if (session) waifuQuery.session(session);
    waifu = await waifuQuery.lean();
  }

  try {
    const nextImg = normalizeWaifuImageUrl((waifu as any)?.image);
    if (waifu && nextImg) (waifu as any).image = nextImg;
  } catch {}

  if (waifu && typeof (waifu as any).image === "string") {
    const nextImg = normalizeWaifuImageUrl((waifu as any).image);
    if (nextImg) (waifu as any).image = nextImg;
  }

  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  await cleanupUserSummonHistory(user.id, 50, session);

  const waifuIdStr =
    (waifu as any)?._id?.toString?.() ?? (waifu as any)?.id ?? "";
  if (!waifuIdStr) throw new BusinessError("Thiếu waifuId");

  await grantWaifu({
    userId: user.id,
    bannerId: bannerIdStr,
    waifuId: waifuIdStr,
    waifuName: (waifu as any)?.name,
    waifuStars: (waifu as any)?.stars,
    session,
  });

  return {
    type: "waifu",
    itemStar,
    item: waifu,
    updatedSession,
    milestoneReached: reachedMilestone || null,
  };
};

const summonForcedWaifuStar = async (
  user: UserType,
  banner: BannerType,
  itemStar: number,
  request?: Request,
  options: SummonOptions = {},
) => {
  const { session } = options;
  const bannerIdStr =
    (banner as any)?._id?.toString?.() ?? (banner as any)?.id?.toString?.() ?? "";
  if (!bannerIdStr) throw new BusinessError("Thiếu bannerId");
  if (itemStar < 3) throw new BusinessError("Forced waifu phải từ 3 sao trở lên");

  let reachedMilestone: number | false = false;
  let updatedSession = null;

  if (banner.isRateUp) {
    const userFullQuery = UserModel.findOneAndUpdate(
      { _id: user.id },
      { $inc: { summonCount: 1 } },
      { new: true },
    );
    if (session) userFullQuery.session(session);
    const userFull = await userFullQuery.lean();
    reachedMilestone = await checkEligibleGift(userFull?.summonCount ?? 0);
  }

  let waifu: any = null;

  // Rate-up selection (still applies, but fixed star)
  if (banner?.isRateUp && Math.random() * 100 < RATE_UP_PERCENT) {
    const waifuRateUpList = (banner.waifuList || []).filter((w: any) => w.stars === itemStar);
    if (waifuRateUpList.length > 0) {
      waifu = waifuRateUpList[Math.floor(Math.random() * waifuRateUpList.length)];
    }
  }

  // Global pool fallback
  if (!waifu) {
    const waifuCountQuery = WaifuModel.countDocuments({ stars: itemStar });
    if (session) waifuCountQuery.session(session);
    const waifuCount = await waifuCountQuery;
    if (waifuCount <= 0) throw new BusinessError("Không tìm thấy waifu phù hợp");
    const waifuIndex = Math.floor(Math.random() * waifuCount);
    const waifuQuery = WaifuModel.findOne({ stars: itemStar }).skip(waifuIndex);
    if (session) waifuQuery.session(session);
    waifu = await waifuQuery.lean();
  }

  try {
    const nextImg = normalizeWaifuImageUrl((waifu as any)?.image);
    if (waifu && nextImg) (waifu as any).image = nextImg;
  } catch {}

  if (waifu && typeof (waifu as any).image === "string") {
    const nextImg = normalizeWaifuImageUrl((waifu as any).image);
    if (nextImg) (waifu as any).image = nextImg;
  }

  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  await cleanupUserSummonHistory(user.id, 50, session);

  await grantWaifu({
    userId: user.id,
    bannerId: bannerIdStr,
    waifuId: (waifu as any)?.id ?? (waifu as any)?._id?.toString?.() ?? "",
    waifuName: (waifu as any)?.name,
    waifuStars: (waifu as any)?.stars,
    session,
  });

  return {
    type: "waifu",
    itemStar,
    item: waifu,
    updatedSession,
    milestoneReached: reachedMilestone || null,
  };
};

// Guaranteed summon used by milestone claim: one free roll, forced star, affects summonCount and can chain milestones
export const summonGuaranteedWaifu = async (
  user: UserType,
  banner: BannerType,
  starWanted: number,
  options: SummonOptions = {},
) => {
  const { session } = options;
  try {
    // eslint-disable-next-line no-console
    console.log(`[summonGuaranteedWaifu] start user=${user.id} banner=${banner.id} star=${starWanted}`);
  } catch {}
  // Increase summonCount like a real summon (accept chain milestone behavior)
  const userFullQuery = UserModel.findOneAndUpdate(
    { _id: user.id },
    { $inc: { summonCount: 1 } },
    { new: true },
  );
  if (session) userFullQuery.session(session);
  const userFull = await userFullQuery.lean();

  // Pick waifu by forced stars
  // 1) Ưu tiên danh sách banner nếu có (đảm bảo đúng theme sự kiện)
  let waifu: any = null;
  try {
    const candidates = (banner?.waifuList || []).filter((w: any) => Number(w?.stars) === Number(starWanted));
    if (candidates.length > 0) {
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      const chosenId = (chosen as any)?.id?.toString?.() ?? (chosen as any)?.id;
      if (chosenId) {
        waifu = await WaifuModel.findById(chosenId).lean();
      }
    }
  } catch {}

  // 2) Fallback global pool nếu banner rỗng hoặc waifu bị thiếu
  if (!waifu) {
    const waifuCountQuery = WaifuModel.countDocuments({ stars: starWanted });
    if (session) waifuCountQuery.session(session);
    const waifuCount = await waifuCountQuery;
    if (waifuCount <= 0) throw new BusinessError("Không tìm thấy waifu phù hợp");
    const waifuPoolQuery = WaifuModel.find({ stars: starWanted })
      .select(["_id", "name", "image", "stars"]).limit(50);
    if (session) waifuPoolQuery.session(session);
    const waifuPool = await waifuPoolQuery.lean();
    if (!waifuPool || waifuPool.length === 0) throw new BusinessError("Không tìm thấy waifu phù hợp");
    waifu = waifuPool[Math.floor(Math.random() * waifuPool.length)];
  }
  if (!waifu) throw new BusinessError("Không tìm thấy waifu");

  try {
    // eslint-disable-next-line no-console
    console.log(`[summonGuaranteedWaifu] picked waifu id=${(waifu as any)?._id?.toString() ?? (waifu as any)?.id} name=${waifu?.name}`);
  } catch {}

  const waifuIdStr = (waifu as any)?._id?.toString?.() ?? (waifu as any)?.id;
  if (!waifuIdStr) throw new BusinessError("Thiếu mã waifu");

  await cleanupUserSummonHistory(user.id, 50, session);

  const bannerIdStr = (banner as any)?._id?.toString?.() ?? (banner as any)?.id;
  if (!bannerIdStr) throw new BusinessError("Thiếu bannerId");

  await grantWaifu({
    userId: user.id,
    bannerId: bannerIdStr,
    waifuId: waifuIdStr,
    waifuName: waifu.name,
    waifuStars: waifu.stars,
    session,
  });

  // Check if new milestone reached due to this free roll
  const reachedMilestone = await (async () => {
    const sc = (userFull?.summonCount ?? 0);
    const milestone = GIFT_MILESTONES.find((m: number) => m === sc);
    return milestone || null;
  })();

  return {
    type: "waifu" as const,
    itemStar: starWanted,
    item: waifu,
    milestoneReached: reachedMilestone,
    createdUserWaifuId: null,
  };
};

export const multiSummon = async (
  user: UserType,
  banner: BannerType,
  cum: PityCumulativeType,
  count: number,
  request?: Request,
  options: SummonOptions = {},
) => {
  const summonResults: any[] = [];

  // Special offer for 10-roll (cost 9): guarantee exactly one 3★ waifu in a random position.
  if (count === 10) {
    const guaranteedIndex = Math.floor(Math.random() * 10);
    for (let i = 0; i < 10; i++) {
      const result =
        i === guaranteedIndex
          ? await summonForcedWaifuStar(user, banner, 3, request, options)
          : await summon(user, banner, cum, request, options);
      summonResults.push(result);
    }
  } else {
    const summons = Array(count).fill(null);
    await Promise.each(summons, async () => {
      const result = await summon(user, banner, cum, request, options);
      summonResults.push(result);
    });
  }

  // Tìm session đã được update (nếu có)
  const updatedSession =
    summonResults.findLast((result) => result.updatedSession)?.updatedSession || null;

  return {
    items: summonResults,
    updatedSession,
  };
};

const checkEligibleGift = async (currentSummonCount: number) => {
  const summonCount = currentSummonCount;
  const milestone = GIFT_MILESTONES.find((milestone: number) => milestone === summonCount);
  if (milestone) {
    return milestone;
  }
  return false;
};
