// app/routes/api.translators.create.ts
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import mongoose from "mongoose";

import { TranslatorModel } from "~/database/models/translator.model";

function toSlug(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRegExp(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function normalizeName(raw: string) { return raw.trim().replace(/\s+/g, " "); }

async function ensureUniqueSlug(base: string) {
  let slug = base || "translator";
  let i = 2;
  // eslint-disable-next-line no-constant-condition
  while (await TranslatorModel.exists({ slug })) {
    slug = `${base}-${i++}`;
    if (i > 200) { slug = `${base}-${Date.now()}`; break; }
  }
  return slug;
}

function toClient(doc: any) { return { id: String(doc._id ?? doc.id), name: String(doc.name), slug: String(doc.slug) }; }

export async function action({ request }: ActionFunctionArgs) {
  try {
    if (mongoose.connection.readyState === 0) {
      // await mongoose.connect(process.env.MONGODB_URI!);
    }
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    let rawName = "";
    if (ct.includes("application/json")) { let body:any=null; try{ body=await request.json(); } catch{ return new Response(JSON.stringify({ error: "INVALID_JSON" }), { status: 400, headers: { "content-type": "application/json" } }); } rawName = (body?.name ?? "").toString(); }
    else { const form = await request.formData(); rawName = (form.get("name") ?? "").toString(); }

    const name = normalizeName(rawName);
    if (!name) return new Response(JSON.stringify({ error: "NAME_REQUIRED" }), { status: 422, headers: { "content-type": "application/json" } });
    if (name.length < 2 || name.length > 80) return new Response(JSON.stringify({ error: "INVALID_LENGTH" }), { status: 422, headers: { "content-type": "application/json" } });
    if (/[\u0000-\u001f]/.test(name)) return new Response(JSON.stringify({ error: "INVALID_CHAR" }), { status: 422, headers: { "content-type": "application/json" } });

    const existing = await TranslatorModel.findOne({ name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") } });
    if (existing) return new Response(JSON.stringify({ translator: toClient(existing) }), { status: 409, headers: { "content-type": "application/json" } });

    const base = toSlug(name); if (!base) return new Response(JSON.stringify({ error: "INVALID_NAME" }), { status: 422, headers: { "content-type": "application/json" } });
    const slug = await ensureUniqueSlug(base);
    const created = await TranslatorModel.create({ name, slug });
    return new Response(JSON.stringify({ translator: toClient(created) }), { status: 201, headers: { "content-type": "application/json" } });
  } catch (err) {
    console.error("[api.translators.create] error:", err);
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), { status: 500, headers: { "content-type": "application/json" } });
  }
}

export async function loader(_args: LoaderFunctionArgs) { return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405 }); }
