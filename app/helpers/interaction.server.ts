import { InteractionModel } from "~/database/models/interaction.model";

export type InteractionData = {
  story_id: string;
  type: "view" | "like" | "comment";
  user_id?: string;
};

/**
 * Ghi lại interaction của user với manga
 */
export const recordInteraction = async (data: InteractionData): Promise<void> => {
  try {
    await InteractionModel.create({
      story_id: data.story_id,
      type: data.type,
      user_id: data.user_id,
      created_at: new Date(),
    });

    console.info(`Đã ghi interaction: ${data.type} cho manga ${data.story_id}`);
  } catch (error) {
    console.error("Lỗi khi ghi interaction:", error);
    // Không throw error để không ảnh hưởng đến luồng chính
  }
};

/**
 * Ghi lại view cho manga (tự động khi user truy cập)
 */
export const recordView = async (storyId: string, userId?: string): Promise<void> => {
  await recordInteraction({
    story_id: storyId,
    type: "view",
    user_id: userId,
  });
};

/**
 * Ghi lại like cho manga
 */
export const recordLike = async (storyId: string, userId?: string): Promise<void> => {
  await recordInteraction({
    story_id: storyId,
    type: "like",
    user_id: userId,
  });
};

/**
 * Ghi lại comment cho manga
 */
export const recordComment = async (storyId: string, userId?: string): Promise<void> => {
  await recordInteraction({
    story_id: storyId,
    type: "comment",
    user_id: userId,
  });
};

/**
 * Lấy thống kê interactions cho một manga trong khoảng thời gian
 */
export const getMangaInteractionStats = async (
  storyId: string,
  startDate?: Date,
  endDate?: Date,
) => {
  try {
    const matchStage: any = { story_id: storyId };

    if (startDate || endDate) {
      matchStage.created_at = {};
      if (startDate) matchStage.created_at.$gte = startDate;
      if (endDate) matchStage.created_at.$lte = endDate;
    }

    const stats = await InteractionModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 },
        },
      },
    ]);

    // Chuyển đổi kết quả thành object dễ sử dụng
    const result = {
      views: 0,
      likes: 0,
      comments: 0,
    };

    stats.forEach((stat) => {
      if (stat._id === "view") result.views = stat.count;
      if (stat._id === "like") result.likes = stat.count;
      if (stat._id === "comment") result.comments = stat.count;
    });

    return result;
  } catch (error) {
    console.error("Lỗi khi lấy thống kê interactions:", error);
    throw error;
  }
};
