// app/routes/api.reading-reward.ts
import type { ActionFunctionArgs } from "react-router";

import { createNotification } from "@/mutations/notification.mutation";
import { getUserInfoFromSession } from "@/services/session.svc";

import { ReadingRewardModel } from "~/database/models/reading-reward.model";
import { UserModel } from "~/database/models/user.model";
import mongoose from "mongoose";
import crypto from "node:crypto";

/* =========================
 * Config / Constants
 * ========================= */
const GOLD_REWARD_CHANCE = 0.20;          // 20%
const MAX_REWARD_PER_DAY = 9;            // tối đa 9 lần/ngày
const RATE_LIMIT_MS = 60_000;             // 1 phút
const IDEMPOTENCY_TTL_SECONDS = 300;      // 5 phút

const noStoreHeaders = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store, must-revalidate",
  "CDN-Cache-Control": "no-store",
  "Surrogate-Control": "no-store",
};

/* =========================
 * Helpers
 * ========================= */
function getTodayInVietnam(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function random01(): number {
  return crypto.randomInt(0, 1_000_000) / 1_000_000;
}

function json(body: any, init?: { status?: number; headers?: Record<string, string> }) {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { ...noStoreHeaders, ...(init?.headers ?? {}) },
  });
}

function fail(where: string, error: unknown, extra?: Record<string, any>, status = 500) {
  const err = error as any;
  const message = String(err?.message ?? err ?? "unknown_error");
  const stack = String(err?.stack ?? "");
  const payload = {
    success: false,
    code: "SERVER_ERROR",
    where,
    message,
    stack,
    ...((extra && Object.keys(extra).length) ? { extra } : {}),
  };
  console.error(`[reading-reward][${where}]`, { message, extra, stack });
  return json(payload, { status });
}

async function readIdempotency(key: string, userId: string) {
  try {
    const col = mongoose.connection.collection("idempotency");
    return await col.findOne({ key, userId });
  } catch {
    return null;
  }
}
async function writeIdempotency(key: string, userId: string, payload: any) {
  try {
    const col = mongoose.connection.collection("idempotency");
    try {
      await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: IDEMPOTENCY_TTL_SECONDS });
    } catch {}
    await col.insertOne({ key, userId, response: payload, createdAt: new Date() });
  } catch {}
}

/* =========================
 * Main Action
 * ========================= */
export async function action({ request }: ActionFunctionArgs) {
  const requestId = crypto.randomUUID();

  try {
    if (request.method !== "POST") {
      return json({ success: false, error: "method_not_allowed", requestId }, { status: 405 });
    }

    let user: any;
    try {
      user = await getUserInfoFromSession(request);
      if (!user) return json({ success: false, error: "Vui lòng đăng nhập", requestId }, { status: 401 });
    } catch (e) {
      return fail("getUserInfoFromSession", e, { requestId }, 500);
    }

    const rawUserId = user?.id ?? user?._id;
    const userIdQ: any = mongoose.isValidObjectId(String(rawUserId))
      ? new mongoose.Types.ObjectId(String(rawUserId))
      : String(rawUserId);

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (e) {
      return fail("parseFormData", e, { requestId }, 400);
    }

    const intent = formData.get("intent");
    if (intent !== "claim-reading-reward") {
      return json({ success: false, error: "Hành động không hợp lệ", requestId }, { status: 400 });
    }

    const idempotencyKey = (request.headers.get("x-idempotency-key") ?? formData.get("idempotencyKey")) as string | null;
    if (idempotencyKey) {
      try {
        const prev = await readIdempotency(idempotencyKey, String(userIdQ));
        if (prev?.response) {
          const resp = prev.response;
          return new Response(JSON.stringify({ ...resp.body, requestId, fromCache: true }), {
            status: resp.status ?? 200,
            headers: { ...noStoreHeaders, ...(resp.headers ?? {}) },
          });
        }
      } catch (e) {
        console.warn("[reading-reward][idempotency-read-failed]", e);
      }
    }

    const ua = request.headers.get("user-agent") || "";
    if (/bot|crawler|spider|crawling/i.test(ua)) {
      return json({ success: true, skipped: "bot", requestId });
    }

    const now = new Date();
    const today = getTodayInVietnam(now);
    const oneMinuteAgo = new Date(now.getTime() - RATE_LIMIT_MS);

    const isRewardGranted = random01() < GOLD_REWARD_CHANCE;
    const goldAmount = isRewardGranted ? (random01() < 0.01 ? 10 : 1) : 0;

    // === GATE (upsert:false) ===
    let passed: any = null;
    try {
      const filterGate = {
        userId: userIdQ,
        date: today,
        $and: [
          { $or: [{ rewardCount: { $lt: MAX_REWARD_PER_DAY } }, { rewardCount: { $exists: false } }] },
          { $or: [{ updatedAt: { $lt: oneMinuteAgo } }, { updatedAt: { $exists: false } }] },
        ],
      };

      const updateGate: any = {
        $set: { updatedAt: now },
        $setOnInsert: { userId: userIdQ, date: today, createdAt: now },
      };
      if (isRewardGranted) updateGate.$inc = { rewardCount: 1 };

      passed = await ReadingRewardModel.findOneAndUpdate(filterGate, updateGate, { new: true, upsert: false });
    } catch (e) {
      return fail("gate.findOneAndUpdate", e, { requestId, isRewardGranted, today }, 500);
    }

    const finalize = async (payload: { body: any; status: number; headers?: Record<string, string> }) => {
      const resp = { body: { ...payload.body, requestId }, status: payload.status, headers: { ...(payload.headers ?? {}) } };
      if (idempotencyKey) {
        try { await writeIdempotency(idempotencyKey, String(userIdQ), resp); } catch (e) {}
      }
      return new Response(JSON.stringify(resp.body), { status: resp.status, headers: { ...noStoreHeaders, ...resp.headers } });
    };

    if (!passed) {
      // === CREATE HÔM NAY (upsert:true) ===
      try {
        await ReadingRewardModel.findOneAndUpdate(
          { userId: userIdQ, date: today },
          {
            $setOnInsert: {
              userId: userIdQ,
              date: today,
              rewardCount: isRewardGranted ? 1 : 0,
              createdAt: now,
            },
            $set: { updatedAt: now },
          },
          { new: true, upsert: true }
        );
      } catch (e) {
        return fail("create-today.findOneAndUpdate", e, { requestId, today, isRewardGranted }, 500);
      }

      // ❌ BỎ thông báo MISS → chỉ xử lý khi trúng
      if (!isRewardGranted) return finalize({ body: { success: true, code: "SKIPPED" }, status: 200 });

      // === TRÚNG ===
      try {
        await UserModel.findByIdAndUpdate(userIdQ, { $inc: { gold: goldAmount } }, { timestamps: false });
      } catch (e) {
        return fail("gold.increment", e, { requestId, userId: String(userIdQ), goldAmount }, 500);
      }

      try {
        await createNotification({
          userId: String(userIdQ),
          title: "Thưởng đọc truyện.",
          subtitle: goldAmount === 10
            ? "Chúc mừng bạn đoạt hết may mắn của 10 người khác, nhận được 10 dâm ngọc"
            : `Chúc mừng bạn nhận được ${goldAmount} Dâm Ngọc!`,
          imgUrl: "/images/noti/gold.png",
          type: goldAmount === 10 ? "big-win" : "default",
        });
      } catch {}

      return finalize({ body: { success: true, code: "GRANTED", gold: goldAmount }, status: 200 });
    }

    // === ĐÃ QUA GATE ===
    if (!isRewardGranted) return finalize({ body: { success: true, code: "SKIPPED" }, status: 200 });

    try {
      await UserModel.findByIdAndUpdate(userIdQ, { $inc: { gold: goldAmount } }, { timestamps: false });
    } catch (e) {
      return fail("gold.increment.afterGate", e, { requestId, userId: String(userIdQ), goldAmount }, 500);
    }

    try {
      await createNotification({
        userId: String(userIdQ),
        title: "Thưởng đọc truyện.",
        subtitle: goldAmount === 10
          ? "Chúc mừng bạn đoạt hết may mắn của 10 người khác, nhận được 10 dâm ngọc"
          : `Chúc mừng bạn nhận được ${goldAmount} Dâm Ngọc!`,
        imgUrl: "/images/noti/gold.png",
        type: goldAmount === 10 ? "big-win" : "default",
      });
    } catch {}

    return finalize({ body: { success: true, code: "GRANTED", gold: goldAmount }, status: 200 });
  } catch (e) {
    return fail("top-level", e, { requestId }, 500);
  }
}
