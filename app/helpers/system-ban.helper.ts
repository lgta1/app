// app/helpers/system-ban.helper.ts
// ❗ Không import bất kỳ "database/models" nào ở đây

// Dùng mutation server có sẵn
import { banUser } from "~/.server/mutations/user.mutation";

/**
 * systemBanUser: “bộ an ninh” thực thi ban (kèm message để log).
 * Đặt ở helpers (client-safe), nhưng chỉ được gọi trong code server (actions/loader).
 */
export async function systemBanUser(
  request: Request,
  userId: string,
  days: number,
  message: string
) {
  const msg = (message || "").trim() || `Banned ${days} days (system)`;
  // Nếu cần quyền đặc biệt thì banUser sẽ tự validate trong server
  return banUser(request, userId, days, msg);
}
