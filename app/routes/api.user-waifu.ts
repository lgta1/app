// app/routes/api.user-waifu.ts
import mongoose from "mongoose";

import { UserModel } from "~/database/models/user.model";

// POST /api/user-waifu
export async function action({ request }: { request: Request }) {
  try {
    const { userId, filename } = (await request.json()) as {
      userId?: string;
      filename?: string;
    };

    if (!userId || !filename) {
      return new Response(JSON.stringify({ error: "Missing userId or filename" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate ObjectId d? tr�nh CastError ? 500
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return new Response(JSON.stringify({ error: "Invalid userId format" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updated = await UserModel.findByIdAndUpdate(
      userId,
      { waifuFilename: filename },
      { new: true },
    );

    if (!updated) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        userId: updated.id,
        waifuFilename: updated.waifuFilename,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[POST /api/user-waifu] error:", err);
    return new Response(JSON.stringify({ error: "Internal Error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// GET /api/user-waifu (ping)
export async function loader() {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
