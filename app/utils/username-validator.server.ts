import { UserModel } from "~/database/models/user.model";

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

// NOTE: This must be defined server-side (do not import from *.client).
export const USERNAME_CHANGE_COST = 2000;

export function validateUsernameChangeCost(userGold: number): UsernameValidationResult {
  if (userGold < USERNAME_CHANGE_COST) {
    return {
      isValid: false,
      error: `Bạn cần ${USERNAME_CHANGE_COST} Ngọc để đổi username. Hiện tại bạn có ${userGold} Ngọc.`,
    };
  }
  return { isValid: true };
}

// Server-side local sanitizer to avoid bundler re-export/interop issues.
// Mirrors client behavior: NFC-normalize, strip non-ASCII letters/digits/spaces,
// collapse whitespace and trim.
export function sanitizeUsername(username: string): string {
  try {
    return (username ?? "")
      .toString()
      .normalize("NFC")
      .replace(/[^\p{L}0-9 ]+/gu, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    // In the unlikely case normalization fails, fall back to a safe trimmed string
    console.warn("[username-validator.server] sanitize fallback due to error:", e);
    return (username ?? "").toString().trim();
  }
}

export async function checkUsernameUniqueness(
  username: string,
  excludeUserId?: string,
): Promise<UsernameValidationResult> {
  try {
    const trimmedUsername = sanitizeUsername(username);
    const query: any = {
      name: trimmedUsername,
      isDeleted: false,
    };
    if (excludeUserId) query._id = { $ne: excludeUserId };

    // Use locale collation: case-insensitive, diacritic-sensitive (strength: 2)
    const existingUser = await UserModel.findOne(query)
      .collation({ locale: "vi", strength: 2 })
      .lean();
    if (existingUser) return { isValid: false, error: "Username này đã được sử dụng" };
    return { isValid: true };
  } catch (error) {
    console.error("Error checking username uniqueness:", error);
    return { isValid: false, error: "Có lỗi xảy ra khi kiểm tra username" };
  }
}

export async function validateUsernameComplete(
  username: string,
  excludeUserId?: string,
): Promise<UsernameValidationResult> {
  // Để tránh kéo logic client vào đây, re-validate theo cùng tiêu chí sanitize+regex ASCII
  const trimmed = sanitizeUsername(username).normalize("NFC");
  const len = Array.from(trimmed).length;
  if (len < 1) return { isValid: false, error: "Username là bắt buộc" };
  if (len > 15) return { isValid: false, error: "Username không được vượt quá 15 ký tự" };
  const unicodeLettersDigitsSpaces = /^[\p{L}0-9 ]+$/u;
  if (!unicodeLettersDigitsSpaces.test(trimmed)) {
    return { isValid: false, error: "Username chỉ được chứa chữ cái, số và khoảng trắng" };
  }

  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount > 6) return { isValid: false, error: "Username không được chứa quá 6 chữ số" };

  const uniqueness = await checkUsernameUniqueness(trimmed, excludeUserId);
  if (!uniqueness.isValid) return uniqueness;
  return { isValid: true };
}
