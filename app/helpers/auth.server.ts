import { redirect } from "react-router";
import crypto from "crypto";

import { ROLES } from "~/constants/user";
import { UserModel } from "~/database/models/user.model";
import { BusinessError } from "~/helpers/errors";
import {
  createUserSession,
  destroySession,
  getUserId,
  getUserSession,
} from "~/helpers/session.server";
import { isAdmin } from "~/helpers/user";

const generateSalt = () => {
  return crypto.randomBytes(16).toString("hex");
};

const hashPassword = (password: string, salt: string) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
};

/**
 * Yêu cầu user phải đăng nhập, nếu không sẽ redirect về login
 */
export async function requireLogin(request: Request): Promise<string> {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  return userId;
}

export async function requireAdminLogin(request: Request): Promise<string> {
  const userId = await getUserId(request);

  if (!userId) {
    throw redirect("/login");
  }

  const user = await UserModel.findById(userId);
  if (!user || user.role !== ROLES.ADMIN) {
    throw redirect("/");
  }

  return userId;
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
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  // Check the user's credentials
  const user = await UserModel.findOne({ email: email.toLowerCase() }).lean();
  if (!user) {
    throw new BusinessError("Tài khoản hoặc mật khẩu không chính xác");
  }

  const hashedPassword = hashPassword(password, user.salt);
  if (hashedPassword !== user.password) {
    throw new BusinessError("Tài khoản hoặc mật khẩu không chính xác");
  }

  // Create a session
  const response = await createUserSession({
    request,
    userId: user.id,
    remember: true,
    redirectUrl: isAdmin(user.role) ? "/admin/member" : redirectUrl,
  });

  if (!response) {
    throw new BusinessError("Đã xảy ra lỗi khi tạo phiên đăng nhập");
  }

  return response;
}

export async function register({ request }: { request: Request }) {
  const formData = await request.formData();
  const name = formData.get("name")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";

  if (password !== confirmPassword) {
    throw new BusinessError("Mật khẩu không khớp");
  }

  const existingUser = await UserModel.findOne({ email }).lean();
  if (existingUser) {
    throw new BusinessError("Tài khoản đã tồn tại");
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);

  await UserModel.create({
    name,
    email,
    password: hashedPassword,
    salt,
  });

  return redirect("/login");
}
