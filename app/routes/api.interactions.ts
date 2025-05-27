import type { ActionFunctionArgs } from "react-router";

import { type InteractionData, recordInteraction } from "~/helpers/interaction.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (request.method !== "POST") {
      return Response.json({ error: "Chỉ chấp nhận POST method" }, { status: 405 });
    }

    const formData = await request.formData();
    const storyId = formData.get("story_id") as string;
    const type = formData.get("type") as string;
    const userId = formData.get("user_id") as string | null;

    // Validate required fields
    if (!storyId || !type) {
      return Response.json({ error: "story_id và type là bắt buộc" }, { status: 400 });
    }

    // Validate interaction type
    if (!["view", "like", "comment"].includes(type)) {
      return Response.json(
        { error: "type chỉ chấp nhận: view, like, comment" },
        { status: 400 },
      );
    }

    // Validate story ID
    if (storyId.length !== 24) {
      return Response.json({ error: "story_id không hợp lệ" }, { status: 400 });
    }

    const interactionData: InteractionData = {
      story_id: storyId,
      type: type as "view" | "like" | "comment",
      user_id: userId || undefined,
    };

    await recordInteraction(interactionData);

    return Response.json({
      success: true,
      message: `Đã ghi lại ${type} cho manga ${storyId}`,
    });
  } catch (error) {
    console.error("Lỗi API interactions:", error);
    return Response.json({ error: "Lỗi server khi ghi interaction" }, { status: 500 });
  }
}
