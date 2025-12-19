import type { UserType } from "~/database/models/user.model";

/**
 * Cấu trúc bảng kinh nghiệm cần thiết để lên từng cấp
 * Cấp số 9 là cấp cao nhất
 */
export const LEVEL_THRESHOLDS = [
  0, // Cấp 1 (bắt đầu)
  250, // Cấp 2
  1000, // Cấp 3
  2500, // Cấp 4
  7500, // Cấp 5
  15000, // Cấp 6
  25000, // Cấp 7
  40000, // Cấp 8
  80000, // Cấp 9
  Infinity, // Giới hạn
];

export const MAX_LEVEL = 9;

export const LEVEL_TITLES: Record<number, string> = {
  1: "Nhập Lọ",
  2: "Luyện Lọ",
  3: "Cuồng Lọ",
  4: "Lọ Vương",
  5: "Lọ Vương Bất Tử",
  6: "Lọ Đế",
  7: "Lọ Thánh",
  8: "Lọ Thánh Chí Tôn",
  9: "Thần Lọ Vĩnh Hằng",
};

/**
 * Tính toán cấp độ dựa trên kinh nghiệm
 * @param exp - Số kinh nghiệm hiện tại của người dùng
 * @returns Cấp độ hiện tại (từ 1-9)
 */
export function calculateLevel(exp: number): number {
  for (let i = 0; i < LEVEL_THRESHOLDS.length - 1; i++) {
    if (exp < LEVEL_THRESHOLDS[i + 1]) {
      return i + 1;
    }
  }
  return MAX_LEVEL; // Trả về cấp cao nhất nếu vượt quá tất cả ngưỡng
}

/**
 * Tính toán tiến trình lên cấp hiện tại dưới dạng phần trăm
 * @param currentExp - Số kinh nghiệm hiện tại
 * @returns Phần trăm tiến trình lên cấp (0-100)
 */
export function levelProgressPercentageFor(level: number, expInLevel: number): number {
  if (level >= MAX_LEVEL) return 100;
  const required = getMaxExp(level);
  if (!isFinite(required) || required <= 0) return 100;
  return Math.floor(Math.max(0, Math.min(1, (expInLevel || 0) / required)) * 100);
}

/**
 * Cập nhật kinh nghiệm người dùng và kiểm tra lên cấp
 * @param user - Đối tượng người dùng
 * @param expToAdd - Số kinh nghiệm cần thêm
 * @returns Thông tin sau khi cập nhật {newExp, oldLevel, newLevel, didLevelUp}
 */
export function updateUserExp(
  user: UserType,
  expToAdd: number,
): {
  newExp: number; // exp-in-level sau khi cộng
  oldLevel: number;
  newLevel: number;
  didLevelUp: boolean;
} {
  let oldLevel = user.level || 1;
  let level = oldLevel;
  let expInLevel = user.exp || 0; // DB lưu exp-in-level
  let remaining = Math.max(0, expToAdd || 0);
  let didLevelUp = false;

  while (remaining > 0 && level < MAX_LEVEL) {
    const required = getMaxExp(level);
    if (!isFinite(required) || required <= 0) break; // guard
    const toNext = required - expInLevel;
    if (remaining >= toNext) {
      // level up
      remaining -= toNext;
      level += 1;
      expInLevel = 0; // reset on level-up
      didLevelUp = true;
    } else {
      expInLevel += remaining;
      remaining = 0;
    }
  }

  // Nếu đã max level, không cộng dồn thêm exp (giữ nguyên)
  if (level >= MAX_LEVEL) {
    level = MAX_LEVEL;
    // expInLevel giữ nguyên (không vượt qua)
  }

  return {
    newExp: expInLevel,
    oldLevel,
    newLevel: level,
    didLevelUp,
  };
}

/**
 * Return the max exp for the given level (i.e. how much exp is needed while on this level)
 * For example, for level=1 this returns (thresholdLevel2 - thresholdLevel1).
 */
export const getMaxExp = (level: number) => {
  const prev = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? Infinity;
  if (!isFinite(next)) return Infinity; // max level
  return next - prev; // exp cần để từ level -> level+1
};

export function getLevelTitle(level: number | null | undefined): string {
  const normalized = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level || 1)));
  return LEVEL_TITLES[normalized] || "";
}

