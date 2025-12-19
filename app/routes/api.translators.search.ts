// app/routes/api.translators.search.ts
import type { LoaderFunctionArgs } from "react-router";
import { TranslatorModel } from "~/database/models/translator.model";
import { slugify } from "~/utils/slug.utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (!q) return Response.json({ items: [] });
  const qSlug = slugify(q);
  const items = await TranslatorModel.find(
    { $or: [ { slug: { $regex: qSlug, $options: "i" } }, { name: { $regex: q, $options: "i" } } ] },
    { _id: 1, name: 1, slug: 1 },
  ).sort({ name: 1 }).limit(10).lean();
  return Response.json({ items: items.map((d) => ({ id: d._id.toString(), name: d.name, slug: d.slug })) });
}
