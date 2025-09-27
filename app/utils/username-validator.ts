import { UserModel } from '~/database/models/user.model';

export interface UsernameValidationResult {
  isValid: boolean;
  error?: string;
}

export const USERNAME_CHANGE_COST = 2000;

/**
 * Validates username based on specified constraints
 */
export function validateUsername(username: string): UsernameValidationResult {
  // Check if username exists
  if (!username) {
    return { isValid: false, error: 'Username là bắt buộc' };
  }

  // Trim whitespace
  const trimmedUsername = username.trim();

  // Check length constraints
  if (trimmedUsername.length < 6) {
    return { isValid: false, error: 'Username phải có ít nhất 6 ký tự' };
  }

  if (trimmedUsername.length > 18) {
    return { isValid: false, error: 'Username không được vượt quá 18 ký tự' };
  }

  // BEGIN <feature:username-unicode-space>
  // Check character constraints - allow Unicode letters, numbers and spaces
  // Sử dụng \p{L} cho "letter" (mọi bảng chữ cái), \p{N} cho "number", và khoảng trắng ' '
  // Cần cờ 'u' để kích hoạt xử lý Unicode trong RegExp của JS.
  const validCharactersRegex = /^[\p{L}\p{N} ]+$/u;
  if (!validCharactersRegex.test(trimmedUsername)) {
    return {
      isValid: false,
      // Cập nhật thông báo để phản ánh quy tắc mới: cho phép chữ, số và khoảng trắng
      error: 'Username chỉ được chứa chữ cái, số và khoảng trắng',
    };
  }
  // END <feature:username-unicode-space>

  // Additional security checks - prevent potentially dangerous strings
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
    /\\x/i,
    /unicode/i,
    /%[0-9a-f]{2}/i,
    /&#/i,
    /javascript:/i,
    /data:/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmedUsername)) {
      return {
        isValid: false,
        error: 'Username chứa ký tự không được phép',
      };
    }
  }

  return { isValid: true };
}

/**
 * Checks if username already exists in the system
 */
export async function checkUsernameUniqueness(
  username: string,
  excludeUserId?: string,
): Promise<UsernameValidationResult> {
  try {
    // BEGIN <feature:username-unicode-space>
    // Chuẩn hoá & làm sạch nhẹ để so sánh thống nhất (giữ chữ có dấu và khoảng trắng hợp lệ)
    const trimmedUsername = sanitizeUsername(username);
    // END <feature:username-unicode-space>
    
    const query: any = { 
      // BEGIN <feature:username-unicode-space>
      // Dùng cờ 'u' để hỗ trợ Unicode đúng; vẫn exact match theo chuỗi sau khi sanitize
      name: { $regex: new RegExp(`^${trimmedUsername}$`, 'iu') }, // Case-insensitive + Unicode
      // END <feature:username-unicode-space>
      isDeleted: false 
    };

    // Exclude current user if updating existing user
    if (excludeUserId) {
      query._id = { $ne: excludeUserId };
    }

    const existingUser = await UserModel.findOne(query).lean();

    if (existingUser) {
      return {
        isValid: false,
        error: 'Username này đã được sử dụng',
      };
    }

    return { isValid: true };
  } catch (error) {
    console.error('Error checking username uniqueness:', error);
    return {
      isValid: false,
      error: 'Có lỗi xảy ra khi kiểm tra username',
    };
  }
}

/**
 * Comprehensive username validation including uniqueness check
 */
export async function validateUsernameComplete(
  username: string,
  excludeUserId?: string,
): Promise<UsernameValidationResult> {
  // First validate format and constraints
  const formatValidation = validateUsername(username);
  if (!formatValidation.isValid) {
    return formatValidation;
  }

  // Then check uniqueness
  const uniquenessValidation = await checkUsernameUniqueness(username, excludeUserId);
  if (!uniquenessValidation.isValid) {
    return uniquenessValidation;
  }

  return { isValid: true };
}

/**
 * Checks if user has enough gold for username change
 */
export function validateUsernameChangeCost(userGold: number): UsernameValidationResult {
  if (userGold < USERNAME_CHANGE_COST) {
    return {
      isValid: false,
      error: `Bạn cần ${USERNAME_CHANGE_COST} Ngọc để đổi username. Hiện tại bạn có ${userGold} Ngọc.`,
    };
  }

  return { isValid: true };
}

/**
 * Sanitizes username to prevent any potential security issues
 */
export function sanitizeUsername(username: string): string {
  // BEGIN <feature:username-unicode-space>
  // Giữ nguyên ý: "sanitize" chỉ loại ký tự ngoài phạm vi cho phép,
  // nhưng bây giờ cho phép chữ (Unicode), số và khoảng trắng.
  // - Chuẩn hoá Unicode về NFC (tránh 2 cách mã hoá dấu)
  // - Loại ký tự không phải \p{L} (letter), \p{N} (number) hoặc space
  // - Gộp nhiều khoảng trắng liên tiếp thành 1 khoảng trắng
  // - Trim đầu/cuối
  return username
    .normalize('NFC')
    .replace(/[^\p{L}\p{N} ]+/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
  // END <feature:username-unicode-space>
}
