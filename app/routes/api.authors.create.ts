// app/routes/api.authors.create.ts
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import mongoose from "mongoose";

import { AuthorModel } from "~/database/models/author.model";

function toSlug(name: string) {
  const normalized = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu Latin
    .toLowerCase()
    .trim();

  const sanitized = normalized
    .replace(/[^\p{Letter}\p{Number}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (sanitized) return sanitized;
  // Fallback: keep original characters (including CJK) but replace spaces with dashes
  const fallback = name.trim().replace(/\s+/g, "-");
  return fallback || "author";
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeName(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

async function ensureUniqueSlug(base: string) {
  let slug = base || "author";
  let i = 2;
  // dùng exists để nhanh
  // eslint-disable-next-line no-constant-condition
  while (await AuthorModel.exists({ slug })) {
    slug = `${base}-${i++}`;
    if (i > 200) {
      slug = `${base}-${Date.now()}`;
      break;
    }
  }
  return slug;
}

function toClientAuthor(doc: any) {
  return {
    id: String(doc._id ?? doc.id),
    name: String(doc.name),
    slug: String(doc.slug),
    avatarUrl: doc.avatarUrl ?? null,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Nếu app bạn cần login để tạo author thì bật dòng dưới:
    // await requireLogin(request);

    // Kết nối DB nếu app bạn không connect toàn cục (giữ như cũ)
    if (mongoose.connection.readyState === 0) {
      // await mongoose.connect(process.env.MONGODB_URI!);
    }

    // --- Đọc input: hỗ trợ cả JSON và form-data ---
    const ct = (request.headers.get("content-type") || "").toLowerCase();
    let rawName = "";

    if (ct.includes("application/json")) {
      // JSON
      let body: any = null;
      try {
        body = await request.json();
      } catch {
        return new Response(JSON.stringify({ error: "INVALID_JSON" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      rawName = (body?.name ?? "").toString();
    } else {
      // form-data (giữ tương thích với code cũ)
      const form = await request.formData();
      rawName = (form.get("name") ?? "").toString();
    }

    // --- Validate & chuẩn hoá ---
    const name = normalizeName(rawName);
    if (!name) {
      return new Response(JSON.stringify({ error: "NAME_REQUIRED" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }
    if (name.length < 2 || name.length > 80) {
      return new Response(JSON.stringify({ error: "INVALID_LENGTH" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }
    if (/[\u0000-\u001f]/.test(name)) {
      return new Response(JSON.stringify({ error: "INVALID_CHAR" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }

    // --- Tìm trùng tên (case-insensitive) ---
    const existing = await AuthorModel.findOne({
      name: { $regex: new RegExp(`^${escapeRegExp(name)}$`, "i") },
    });

    if (existing) {
      // 409 – đã tồn tại → trả author để UI gắn luôn
      return new Response(JSON.stringify({ author: toClientAuthor(existing) }), {
        status: 409,
        headers: { "content-type": "application/json" },
      });
    }

    // --- Tạo slug duy nhất ---
    const base = toSlug(name);
    if (!base) {
      return new Response(JSON.stringify({ error: "INVALID_NAME" }), {
        status: 422,
        headers: { "content-type": "application/json" },
      });
    }
    const slug = await ensureUniqueSlug(base);

    // --- Tạo mới ---
    const created = await AuthorModel.create({
      name,
      slug,
      avatarUrl: null,
      // createdBy: userId (nếu bạn có requireLogin, thêm vào đây)
    });

    return new Response(JSON.stringify({ author: toClientAuthor(created) }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("[api.authors.create] error:", err);
    return new Response(JSON.stringify({ error: "SERVER_ERROR" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

// Chặn GET vào file create
export async function loader(_args: LoaderFunctionArgs) {
  return new Response(JSON.stringify({ error: "METHOD_NOT_ALLOWED" }), { status: 405 });
}
