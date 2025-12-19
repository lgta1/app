import { getLeaderboardModel, type LeaderboardPeriod } from "~/.server/services/leaderboard.svc";
import { getLeaderboard } from "~/.server/queries/leaderboad.query";

export async function loader({ request }: any) {
  const url = new URL(request.url);
  const period = (url.searchParams.get("period") as LeaderboardPeriod) || "daily";

  // Token nội bộ để tránh lộ public
  const token =
    request.headers.get("x-internal-job-token") ||
    url.searchParams.get("token");

  if (!token || token !== process.env.INTERNAL_JOB_TOKEN) {
    return Response.json({ success: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    const Model = getLeaderboardModel(period);
    const [rawTop, rawCount] = await Promise.all([
      Model.find({})
        .sort({ score: -1 })
        .select(
          "score rank story_id views_in_period likes_in_period comments_in_period calculated_at",
        )
        .limit(10)
        .lean(),
      Model.countDocuments({}),
    ]);

    const mapped = await getLeaderboard(period);

    return Response.json({
      success: true,
      period,
      rawCount,
      rawTop,
      mappedCount: mapped.length,
      mappedTitles: mapped.map((m: any) => ({ id: (m as any)._id || (m as any).id, title: (m as any).title })),
    });
  } catch (err: any) {
    console.error("[debug.leaderboard] error", err);
    return Response.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
