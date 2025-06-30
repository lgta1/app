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
export function levelProgressPercentage(currentExp: number): number {
  const currentLevel = calculateLevel(currentExp);

  if (currentLevel >= MAX_LEVEL) {
    return 100; // Đã đạt cấp tối đa
  }

  const prevLevelThreshold = LEVEL_THRESHOLDS[currentLevel - 1];
  const nextLevelThreshold = LEVEL_THRESHOLDS[currentLevel];
  const expInCurrentLevel = currentExp - prevLevelThreshold;
  const expRequiredForLevel = nextLevelThreshold - prevLevelThreshold;

  return Math.floor((expInCurrentLevel / expRequiredForLevel) * 100);
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
  newExp: number;
  oldLevel: number;
  newLevel: number;
  didLevelUp: boolean;
} {
  const oldExp = user.exp || 0;
  const oldLevel = calculateLevel(oldExp);
  const newExp = oldExp + expToAdd;
  const newLevel = calculateLevel(newExp);

  return {
    newExp,
    oldLevel,
    newLevel,
    didLevelUp: newLevel > oldLevel,
  };
}

export const getMaxExp = (level: number) => {
  return LEVEL_THRESHOLDS[level];
};
