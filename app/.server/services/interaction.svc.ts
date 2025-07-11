import { InteractionModel } from "~/database/models/interaction.model";
import { MangaModel } from "~/database/models/manga.model";

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
  await MangaModel.findByIdAndUpdate(storyId, {
    $inc: { viewNumber: 1 },
  });

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
