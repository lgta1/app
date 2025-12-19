import { getUserSession, setUserDataToSession, commitUserSession } from "@/services/session.svc";
import { GIFT_MILESTONES, MILESTONE_REWARDS, type MilestoneThreshold } from "~/constants/summon";
import { UserModel, type UserType } from "~/database/models/user.model";
import type { BannerType } from "~/database/models/banner.model";
import { WaifuModel } from "~/database/models/waifu.model";
import { UserWaifuModel } from "~/database/models/user-waifu";
import { BusinessError } from "~/helpers/errors.helper";

export const awardMilestone = async (options: {
  userId: string;
  milestone: MilestoneThreshold;
  bannerId?: string | null;
  request?: Request;
}) => {
  const { userId, milestone, bannerId = null, request } = options;

  if (!GIFT_MILESTONES.includes(milestone)) {
    throw new BusinessError("Mốc không hợp lệ");
  }

  // Lấy thông tin user mới nhất
  const current = await UserModel.findById(userId).lean();
  if (!current) throw new BusinessError("Không tìm thấy người dùng");

  const alreadyClaimed = (current.claimedMilestones || []).includes(milestone);
  if (alreadyClaimed) {
    return { success: false, message: "Bạn đã nhận mốc này rồi" };
  }
  if ((current.summonCount || 0) < milestone) {
    return { success: false, message: "Chưa đủ lượt để nhận mốc" };
  }

  const reward = MILESTONE_REWARDS[milestone];
  const inc: Record<string, number> = { gold: reward.gold };

  const updated = await UserModel.findOneAndUpdate(
    { _id: userId, claimedMilestones: { $ne: milestone } },
    { $inc: inc, $addToSet: { claimedMilestones: milestone } },
    { new: true },
  ).lean();

  if (!updated) {
    return { success: false, message: "Không thể nhận thưởng, vui lòng thử lại" };
  }

  // Nếu thưởng có waifuStars thì thực hiện một lượt summon miễn phí đảm bảo đúng sao
  let bonusWaifu: any = null;
  if ("waifuStars" in reward) {
    try {
      const { summonGuaranteedWaifu } = await import("@/services/summon.svc");
      const banner = await (async (): Promise<BannerType> => {
        if (!bannerId) throw new BusinessError("Thiếu bannerId");
        const { BannerModel } = await import("~/database/models/banner.model");
        const found = await BannerModel.findById(bannerId).lean();
        if (!found) throw new BusinessError("Không tìm thấy banner");
        return { ...(found as BannerType), id: (found as any)?.id ?? (found as any)?._id?.toString?.() ?? String(bannerId) };
      })();

      const userForSummon: UserType = {
        ...(current as UserType),
        id:
          (current as any)?.id ??
          (current as any)?._id?.toString?.() ??
          String(userId),
      };

      const result = await summonGuaranteedWaifu(
        userForSummon,
        banner,
        reward.waifuStars,
      );
      bonusWaifu = result?.item
        ? { id: result.item.id, name: result.item.name, stars: result.item.stars, image: (result.item as any).image }
        : null;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("Guaranteed summon for milestone failed:", e);
    }
  }

  // Sau khi xử lý (bao gồm free summon nếu có), đồng bộ lại session một lần (nếu có request)
  let sessionCookie: string | null = null;
  if (request) {
    const session = await getUserSession(request);
    // Lấy lại user mới nhất để đảm bảo đồng bộ gold + summonCount
    const latest = await UserModel.findById(userId).lean();
    const prev = session.get("user") || {};
    setUserDataToSession(session, { ...prev, ...latest });
    sessionCookie = await commitUserSession(session);
  }

  return {
    success: true,
    message: `Nhận thưởng mốc ${milestone} thành công (+${reward.gold} Vàng)`,
    data: { gold: updated.gold, milestone, waifu: bonusWaifu, sessionCookie },
  };
};

export default awardMilestone;
