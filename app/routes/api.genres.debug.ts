// app/routes/api.genres.debug.ts
import type { LoaderFunctionArgs } from "react-router";
import { json } from "~/utils/json.server";
import { GenresModel } from "~/database/models/genres.model";
import { getAllGenres } from "@/queries/genres.query";

export async function loader({}: LoaderFunctionArgs) {
  // RAW: đọc trực tiếp từ Mongoose model (không filter)
  let rawCount = 0;
  let rawDistinct = 0;
  let sample10: Array<{ slug: string; name?: string }> = [];

  try {
    rawCount = await GenresModel.countDocuments({});
    const distinct = await GenresModel.distinct("slug");
    rawDistinct = Array.isArray(distinct) ? distinct.length : 0;
    sample10 = await GenresModel.find({}, { _id: 0, slug: 1, name: 1 })
      .sort({ slug: 1 })
      .limit(10)
      .lean();
  } catch (e) {
    console.error("[api.genres.debug] RAW error:", e);
  }

  // APP: dùng service chính thức (không filter)
  let appList: any[] = [];
  try {
    appList = (await getAllGenres()) || [];
  } catch (e) {
    console.error("[api.genres.debug] APP error:", e);
  }

  return json({
    ok: true,
    raw: {
      count: rawCount,
      distinctSlugCount: rawDistinct,
      sample10,
    },
    app: {
      count: appList.length,
      first30Slugs: appList.slice(0, 30).map((g: any) => g?.slug),
    },
    env: {
      DB_NAME: process.env.DB_NAME || null,
    },
  });
}
