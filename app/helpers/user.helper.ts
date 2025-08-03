import { ROLES } from "~/constants/user";
import type { UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";

export const isAdmin = (role: string) => {
  return [ROLES.ADMIN, ROLES.MOD].includes(role);
};

export const getTitleImgPath = (user: UserType) => {
  if (user.level > 9) {
    return `/images/title/${user.faction}/9.png`;
  }

  if (user.faction === 0) {
    if (user.level <= 3) {
      return `/images/title/0/${user.level}_${user.gender}.png`;
    }
    return `/images/title/0/${user.level}.png`;
  } else if (user.faction === 1) {
    return `/images/title/1/${user.level}.png`;
  }
};

// ... existing code ...

/**
 * Cleanup lịch sử summon cho user, chỉ giữ lại 50 bản ghi gần nhất
 * @param userId - ID của user cần cleanup
 * @param maxRecords - Số lượng bản ghi tối đa (mặc định 50)
 */
export const cleanupUserSummonHistory = async (
  userId: string,
  maxRecords: number = 50,
) => {
  try {
    // Đếm số bản ghi hiện tại cho user này
    const count = await UserWaifuModel.countDocuments({ userId });

    // Nếu vượt quá giới hạn, xóa các bản ghi cũ nhất
    if (count > maxRecords) {
      const recordsToDelete = count - maxRecords;

      // Lấy danh sách các bản ghi cũ nhất để xóa
      const oldestRecords = await UserWaifuModel.find({ userId })
        .sort({ createdAt: 1 })
        .limit(recordsToDelete)
        .select("_id")
        .lean();

      if (oldestRecords.length > 0) {
        const idsToDelete = oldestRecords
          .filter((record) => record.waifuStars <= 2)
          .map((record) => record._id);
        await UserWaifuModel.deleteMany({ _id: { $in: idsToDelete } });
      }
    }
  } catch (error) {
    console.error("Error cleaning up user summon history:", error);
  }
};
