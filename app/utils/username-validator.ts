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

  if (trimmedUsername.length > 15) {
    return { isValid: false, error: 'Username không được vượt quá 15 ký tự' };
  }

  // Check character constraints - only alphanumeric characters
  const validCharactersRegex = /^[a-zA-Z0-9]+$/;
  if (!validCharactersRegex.test(trimmedUsername)) {
    return {
      isValid: false,
      error: 'Username chỉ được chứa chữ cái (a-z, A-Z) và số (0-9)',
    };
  }

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
    const trimmedUsername = username.trim();
    
    const query: any = { 
      name: { $regex: new RegExp(`^${trimmedUsername}$`, 'i') }, // Case-insensitive exact match
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
  return username.trim().replace(/[^a-zA-Z0-9]/g, '');
}
