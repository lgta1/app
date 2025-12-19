import { requireLogin } from "@/services/auth.server";
import { GIFT_MILESTONES, MILESTONE_REWARDS, type MilestoneThreshold } from "~/constants/summon";

export async function action({ request }: { request: Request }) {
  const user = await requireLogin(request);
  const formData = await request.formData();
  const milestoneStr = formData.get("milestone") as string;
  const bannerId = formData.get("bannerId") as string | null;

  const milestone = Number(milestoneStr) as MilestoneThreshold;
  if (!GIFT_MILESTONES.includes(milestone)) {
    return Response.json({ success: false, message: "Mốc không hợp lệ" }, { status: 400 });
  }
  if (!bannerId) {
    return Response.json({ success: false, message: "Thiếu bannerId" }, { status: 400 });
  }

  try {
  // Delegate to awardMilestone service (now uses guaranteed summon for waifu milestones)
  const { awardMilestone } = await import("@/services/milestone.svc");
    const result = await awardMilestone({ userId: user.id, milestone, bannerId, request });

    if (!result.success) {
      return Response.json({ success: false, message: result.message || "Không thể nhận thưởng" }, { status: 400 });
    }

    const reward = MILESTONE_REWARDS[milestone];
    const headers: Record<string, string> = {};
    if (result.data?.sessionCookie) headers["Set-Cookie"] = result.data.sessionCookie;

    return Response.json(
      {
        success: true,
        message: result.message,
        data: { gold: result.data?.gold ?? 0, milestone, waifu: result.data?.waifu ?? null },
      },
      { headers },
    );
  } catch (err: any) {
    // Log server-side error for debugging and return a controlled JSON error
    // eslint-disable-next-line no-console
    console.error("[POST /api/waifu/milestone-claim] error:", err);
    const message = err?.message || "Unexpected Server Error";
    return Response.json({ success: false, message }, { status: 500 });
  }
}
