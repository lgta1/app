export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export const USERNAME_CHANGE_COST = 2000;

// Client-only validator: Unicode letters (\p{L}) + digits + spaces, 1–15 chars (by code points)
export function validateUsername(username: string): UsernameValidationResult {
  const trimmed = (username ?? "").trim().normalize("NFC");
  const len = Array.from(trimmed).length;
  if (len < 1) return { isValid: false, error: "Username là bắt buộc" };
  if (len > 15) return { isValid: false, error: "Username không được vượt quá 15 ký tự" };

  const unicodeLettersDigitsSpaces = /^[\p{L}0-9 ]+$/u;
  if (!unicodeLettersDigitsSpaces.test(trimmed)) {
    return { isValid: false, error: "Username chỉ được chứa chữ cái, số và khoảng trắng" };
  }

  const digitCount = (trimmed.match(/\d/g) ?? []).length;
  if (digitCount > 6) return { isValid: false, error: "Username không được chứa quá 6 chữ số" };

  // Basic dangerous patterns guard
  const dangerousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /onclick/i,
    /eval/i,
    /expression/i,
    /<.*>/,
    /[<>'"&]/,
    /%[0-9a-f]{2}/i,
    /&#/i,
    /javascript:/i,
    /data:/i,
  ];
  for (const p of dangerousPatterns) if (p.test(trimmed)) return { isValid: false, error: "Username chứa ký tự không được phép" };

  return { isValid: true };
}

export function validateUsernameChangeCost(userGold: number): UsernameValidationResult {
  if (userGold < USERNAME_CHANGE_COST) {
    return { isValid: false, error: `Bạn cần ${USERNAME_CHANGE_COST} Ngọc để đổi username. Hiện tại bạn có ${userGold} Ngọc.` };
  }
  return { isValid: true };
}

export function sanitizeUsername(username: string): string {
  return username
    .normalize("NFC")
    .replace(/[^\p{L}0-9 ]+/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
