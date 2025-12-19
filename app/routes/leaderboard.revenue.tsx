import { redirect, type LoaderFunctionArgs } from "react-router";

export const loader = async (_: LoaderFunctionArgs) => {
  return redirect("/leaderboard/manga", { status: 301 });
};

export default function LeaderboardRevenueRedirect() {
  return null;
}
