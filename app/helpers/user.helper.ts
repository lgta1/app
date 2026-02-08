import type { ClientSession } from "mongoose";

import { ROLES } from "~/constants/user";
import { MANGA_STATUS } from "~/constants/manga";
import type { UserType } from "~/database/models/user.model";
import { UserWaifuModel } from "~/database/models/user-waifu";

export const isAdmin = (role: string) => {
  return [ROLES.ADMIN, ROLES.MOD].includes(role);
};

export const isDichGia = (role: string) => role === ROLES.DICHGIA;

// Bulk permission: admin OR (dichgia & owner)
export const canBulkDownloadChapters = (
  role: string,
  isOwner: boolean,
) => {
  return isAdmin(role) || (isDichGia(role) && isOwner);
};

export const getTitleImgPath = (user: UserType) => {
  if (user.level === 4) {
    return `/images/title/0/cap4forall.webp`;
  }

  if (user.level > 9) {
    return `/images/title/${user.faction}/9.webp`;
  }

  if (user.faction === 0) {
    if (user.level <= 3) {
      return `/images/title/0/${user.level}_${user.gender}.webp`;
    }
    return `/images/title/0/${user.level}.webp`;
  } else if (user.faction === 1) {
    return `/images/title/1/${user.level}.webp`;
  }
};

/**
 * NOTE: Đổi hành vi theo yêu cầu:
 * - Nếu user chưa có ảnh upload thật sự → TRẢ VỀ CHUỖI RỖNG ("")
 * - Không còn fallback theo genders ở helper này nữa.
 *   (UI sẽ tự hiển thị icon lucide-react khi src rỗng.)
 */
export const getAvatarPath = (user: UserType) => {
  const raw = user?.avatar as unknown as string | undefined | null;
  if (!raw) return "";
  if (raw === "null" || raw === "undefined") return "";
  return String(raw);
};

/**
 * Cleanup lịch sử summon cho user, chỉ giữ lại 50 bản ghi gần nhất
 * @param userId - ID của user cần cleanup
 * @param maxRecords - Số lượng bản ghi tối đa (mặc định 50)
 */
export const cleanupUserSummonHistory = async (
  userId: string,
  maxRecords: number = 50,
  session?: ClientSession,
) => {
  try {
    // Đếm số bản ghi hiện tại cho user này
    const countQuery = UserWaifuModel.countDocuments({ userId });
    if (session) countQuery.session(session);
    const count = await countQuery;

    // Nếu vượt quá giới hạn, xóa các bản ghi cũ nhất
    if (count > maxRecords) {
      const recordsToDelete = count - maxRecords;

      // Lấy danh sách các bản ghi cũ nhất để xóa
      const oldestQuery = UserWaifuModel.find({ userId })
        .sort({ createdAt: 1 })
        .limit(recordsToDelete)
        .select("_id")
        .lean();
      if (session) oldestQuery.session(session);
      const oldestRecords = await oldestQuery;

      if (oldestRecords.length > 0) {
        const idsToDelete = oldestRecords
          .filter((record) => record.waifuStars <= 2)
          .map((record) => record._id);
        const deleteQuery = UserWaifuModel.deleteMany({ _id: { $in: idsToDelete } });
        if (session) deleteQuery.session(session);
        await deleteQuery;
      }
    }
  } catch (error) {
    console.error("Error cleaning up user summon history:", error);
  }
};
