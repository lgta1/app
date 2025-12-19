import type { LoaderFunctionArgs } from "react-router";
import { getLeaderboard } from "~/.server/queries/leaderboad.query";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const periodParam = (url.searchParams.get("period") || "weekly").toLowerCase();
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") || 5)));

  const period = (periodParam === "daily" || periodParam === "weekly" || periodParam === "monthly")
    ? (periodParam as "daily" | "weekly" | "monthly")
    : "weekly";

  try {
    const all = await getLeaderboard(period);
    const start = (page - 1) * limit;
    const end = start + limit;
    const data = (all || []).slice(start, end);
    const total = (all || []).length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return Response.json({ success: true, period, page, limit, total, totalPages, data });
  } catch (err: any) {
    return Response.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
