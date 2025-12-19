import { redirect } from "react-router";
import crypto from "crypto";

import {
  createUserSession,
  destroySession,
  getUserInfoFromSession,
  getUserSession,
} from "@/services/session.svc";

import { ROLES } from "~/constants/user";
import { UserModel, type UserType } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors.helper";
import { isAdmin } from "~/helpers/user.helper";
import { validateUsernameComplete, sanitizeUsername } from "~/utils/username-validator.server";

export const generateSalt = () => {
  return crypto.randomBytes(16).toString("hex");
};

export const hashPassword = (password: string, salt: string) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Safe sanitizer wrapper: some build/runtime interop issues have caused
 * `sanitizeUsername` to not be a function in production bundles. Use the
 * imported sanitizer when available, otherwise fall back to a local
 * implementation that mirrors the client sanitizer behavior.
 */
function safeSanitizeUsername(username: string): string {
  try {
    if (typeof sanitizeUsername === "function") return sanitizeUsername(username);
  } catch (e) {
    // fall through to fallback sanitizer
    console.warn("[register] sanitizeUsername call failed, using fallback", e);
  }

  // Fallback: mirror `sanitizeUsername` from client (strip non ASCII letters/digits/spaces, collapse spaces)
  try {
    return username
      .normalize("NFC")
      .replace(/[^A-Za-z0-9 ]+/g, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch (e) {
    console.warn("[register] fallback sanitize failed, returning raw trimmed username", e);
    return (username ?? "").toString().trim();
  }
}

/**
 * Yêu cầu user phải đăng nhập, nếu không sẽ redirect về login
 */
export async function requireLogin(request: Request): Promise<UserType> {
  const userInfo = await getUserInfoFromSession(request);

  if (!userInfo) {
    throw redirect("/login");
  }

  return userInfo;
}

export async function requireAdminLogin(request: Request): Promise<UserType> {
  const userInfo = await getUserInfoFromSession(request);

  if (!userInfo) {
    throw redirect("/login");
  }

  if (userInfo.role !== ROLES.ADMIN) {
    throw redirect("/");
  }

  return userInfo;
}

export async function requireAdminOrModLogin(request: Request): Promise<UserType> {
  const userInfo = await getUserInfoFromSession(request);

  if (!userInfo) {
    throw redirect("/login");
  }

  if (!isAdmin(userInfo.role)) {
    throw redirect("/");
  }

  return userInfo;
}

export async function logout(request: Request) {
  const session = await getUserSession(request);
  return redirect("/", {
    headers: {
      "Set-Cookie": await destroySession(session),
    },
  });
}

export async function login({
  request,
  redirectUrl = "/",
}: {
  request: Request;
  redirectUrl?: string;
}) {
  const formData = await request.formData();
  const identifierRaw = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  const identifier = identifierRaw.trim();
  if (!identifier) {
    throw new BusinessError("Vui lòng nhập email hoặc username");
  }

  // Check the user's credentials (không filter isBanned để kiểm tra ban status)
  const isEmail = EMAIL_REGEX.test(identifier);
  let user: UserType | null = null;

  if (isEmail) {
    user = await UserModel.findOne({
      email: identifier.toLowerCase(),
      isDeleted: false,
    }).lean();
  } else {
    const sanitizedUsername = safeSanitizeUsername(identifier);
    if (!sanitizedUsername) {
      throw new BusinessError("Username không hợp lệ");
    }

    user = await UserModel.findOne({
      name: new RegExp(`^${escapeRegex(sanitizedUsername)}$`, "i"),
      isDeleted: false,
    }).lean();
  }
  if (!user) {
    throw new BusinessError("Tài khoản hoặc mật khẩu không chính xác");
  }

  const hashedPassword = hashPassword(password, user.salt);
  if (hashedPassword !== user.password) {
    throw new BusinessError("Tài khoản hoặc mật khẩu không chính xác");
  }

  // Kiểm tra trạng thái ban và xử lý unban tự động
  if (user.isBanned) {
    const now = new Date();

    // Nếu ban đã hết hạn, tự động unban
    if (user.banExpiresAt && new Date(user.banExpiresAt) <= now) {
      await UserModel.findByIdAndUpdate(user._id, {
        $unset: {
          banExpiresAt: 1,
          banMessage: 1,
        },
        $set: {
          isBanned: false,
        },
      });
    } else {
      // Vẫn còn trong thời gian ban
      const banMessage = user.banMessage || "Vi phạm quy định của hệ thống";
      throw new BusinessError(
        `Tài khoản của bạn đã bị vô hiệu hóa với lý do: ${banMessage}`,
      );
    }
  }

  // Create a session
  const response = await createUserSession({
    request,
    remember: true,
    redirectUrl: isAdmin(user.role) ? "/admin/member" : redirectUrl,
    user,
  });

  if (!response) {
    throw new BusinessError("Đã xảy ra lỗi khi tạo phiên đăng nhập");
  }

  return response;
}

export async function register({ request }: { request: Request }) {
  try {
    const formData = await request.formData();
    const name = formData.get("name")?.toString() ?? "";
    const emailRaw = formData.get("email")?.toString() ?? "";
    // Chuẩn hóa email để tránh các lỗi do khác biệt chữ hoa/thường
    const email = emailRaw.toLowerCase().trim();
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
    const faction = Number(formData.get("faction")?.toString() ?? "-1");
    const gender = Number(formData.get("gender")?.toString() ?? "-1");

    console.log("[register] received data", { name, email, faction, gender });

    if (password !== confirmPassword) {
      console.log("[register] password mismatch");
      throw new BusinessError("Mật khẩu không khớp");
    }

  // Validate username with new constraints using server validator
  const sanitizedUsername = safeSanitizeUsername(name);
    console.log("[register] sanitized username", sanitizedUsername);

    const usernameValidation = await validateUsernameComplete(sanitizedUsername);
    console.log("[register] username validation", usernameValidation);

    if (!usernameValidation.isValid) {
      throw new BusinessError(usernameValidation.error || "Username không hợp lệ");
    }

    const existingUser = await UserModel.findOne({ email }).lean();
    console.log("[register] existingUser", !!existingUser);
    if (existingUser) {
      throw new BusinessError("Tài khoản đã tồn tại");
    }

    if (faction === -1) {
      throw new BusinessError("Vui lòng chọn phe phái");
    }

    if (gender === -1) {
      throw new BusinessError("Vui lòng chọn giới tính");
    }

    const salt = generateSalt();
    const hashedPassword = hashPassword(password, salt);

    try {
      await UserModel.create({
        name: sanitizedUsername,
        email,
        password: hashedPassword,
        salt,
        faction,
        gender,
      });
    } catch (err: any) {
      // Bắt lỗi duplicate key (email/name trùng) và trả lỗi thân thiện.
      // Mã lỗi MongoDB cho duplicate key thường là 11000.
      if (err && (err.code === 11000 || err.code === "11000")) {
        console.log("[register] duplicate key", err.keyValue ?? err);
        throw new BusinessError("Tài khoản đã tồn tại");
      }
      console.error("[register] Error creating user during register:", err);
      throw new BusinessError("Đã xảy ra lỗi khi tạo tài khoản");
    }

    console.log("[register] user created successfully", { email, name: sanitizedUsername });

    return redirect("/login?registerSuccess=true");
  } catch (err: unknown) {
    // Nếu là BusinessError thì re-throw để action xử lý theo luồng hiện tại
    if (err instanceof BusinessError) throw err;
    console.error("[register] unexpected error:", err);
    throw new BusinessError("Đã xảy ra lỗi khi tạo tài khoản");
  }
}
