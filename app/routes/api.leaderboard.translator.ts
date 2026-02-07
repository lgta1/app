import type { LoaderFunctionArgs } from "react-router";
import { getTranslatorLeaderboard } from "~/.server/queries/translator-leaderboard.query";
import type { TranslatorLeaderboardPeriod } from "~/.server/services/translator-leaderboard.svc";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const periodParam = (url.searchParams.get("period") || "weekly").toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") || 10)));

  const period: TranslatorLeaderboardPeriod =
    periodParam === "weekly" || periodParam === "monthly" || periodParam === "alltime"
      ? (periodParam as TranslatorLeaderboardPeriod)
      : "weekly";

  try {
    const all = await getTranslatorLeaderboard(period, 200);
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = (all || []).slice(start, end);
    const total = (all || []).length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return Response.json(
      { success: true, period, page, limit, total, totalPages, data },
      {
        headers: {
          "Cache-Control": "public, max-age=86400, s-maxage=86400",
        },
      },
    );
  } catch (err: any) {
    return Response.json(
      { success: false, error: String(err?.message || err) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
