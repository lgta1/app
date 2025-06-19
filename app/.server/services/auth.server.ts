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

const generateSalt = () => {
  return crypto.randomBytes(16).toString("hex");
};

const hashPassword = (password: string, salt: string) => {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, "sha512").toString("hex");
};

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
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";

  // Check the user's credentials
  const user = await UserModel.findOne({
    email: email.toLowerCase(),
    isDeleted: false,
    isBanned: false,
  }).lean();
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
  const formData = await request.formData();
  const name = formData.get("name")?.toString() ?? "";
  const email = formData.get("email")?.toString() ?? "";
  const password = formData.get("password")?.toString() ?? "";
  const confirmPassword = formData.get("confirmPassword")?.toString() ?? "";
  const faction = Number(formData.get("faction")?.toString() ?? "-1");
  const gender = Number(formData.get("gender")?.toString() ?? "-1");

  if (password !== confirmPassword) {
    throw new BusinessError("Mật khẩu không khớp");
  }

  const existingUser = await UserModel.findOne({ email }).lean();
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

  await UserModel.create({
    name,
    email,
    password: hashedPassword,
    salt,
    faction,
    gender,
  });

  return redirect("/login?registerSuccess=true");
}
