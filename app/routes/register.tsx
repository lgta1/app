import { useState } from "react";
import React from "react";
import {
  Link,
  type MetaFunction,
  redirect,
  useActionData,
  useNavigation,
  useSubmit,
} from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { register } from "@/services/auth.server";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/register";

// import { FactionSelectionDialog } from "~/components/dialog-faction-selection";
import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";
import { validateUsername } from "~/utils/username-validator.client";

export const meta: MetaFunction = () => {
  return [
    { title: "Đăng ký – Vinahentai" },
    {
      name: "description",
      content:
        "Tạo tài khoản Vinahentai để theo dõi truyện 18+ vietsub, đồng bộ danh sách yêu thích và nhận cập nhật nhanh. Trải nghiệm mượt, ít quảng cáo.",
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  // Kiểm tra xem người dùng đã đăng nhập chưa
  const userInfo = await getUserInfoFromSession(request);

  if (userInfo) {
    return redirect("/");
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    return await register({ request });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    throw error;
  }
}

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // ⚠️ Mặc định mọi user đăng ký mới sẽ thuộc phe 1 (UI chọn phe đã ẩn)
  const DEFAULT_GENDER_ID = 1; // 0=female, 1=male
  const DEFAULT_FACTION_ID = 1; // mặc định phe 1 (đổi thành 2 nếu cần)

  // Username validation state
  const [usernameError, setUsernameError] = useState<string>("");

  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";
  const submit = useSubmit();

  // Handle username validation
  const handleUsernameChange = (value: string) => {
    setName(value);

    // Real-time validation
    const validation = validateUsername(value);
    if (!validation.isValid) {
      setUsernameError(validation.error || "Username không hợp lệ");
    } else {
      setUsernameError("");
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    console.log("[register:client] handleSubmit", { name, email });

    // Validate username trước khi submit
    const usernameValidation = validateUsername(name);
    if (!usernameValidation.isValid) {
      setUsernameError(usernameValidation.error || "Username không hợp lệ");
      return;
    }

    // Kiểm tra mật khẩu
    if (password !== confirmPassword) {
      alert("Mật khẩu không khớp");
      return;
    }

    // Không mở dialog chọn phe nữa → submit thẳng với DEFAULT_FACTION_ID
    submitForm(DEFAULT_FACTION_ID);
  };

  const submitForm = (factionId: number) => {
    // Guard tránh double-submit
    if (isSubmitting) return;

    // Tạo FormData và submit
    const formData = new FormData();
    formData.append("name", name);
    // Chuẩn hóa email ở client để giảm rủi ro duplicate do case
    formData.append("email", email.trim().toLowerCase());
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);
    formData.append("faction", String(factionId)); // gửi phe mặc định
    formData.append("gender", String(DEFAULT_GENDER_ID)); // luôn = 1

    // Submit form bằng fetch API
    // Ghi rõ action để submit tới route /register (fallback và debug)
    console.log("[register:client] submitting form data", { name, email: email.trim().toLowerCase(), factionId });
    submit(formData, { method: "post", action: "/register" });
  };

  return (
    <>
  <div className="mb-10 min-h-screen w-full px-4">
        {/* Container chính */}
        <div className="mx-auto mb-10 flex w-full flex-col items-center gap-[46px] pt-[104px] md:max-w-[558px] md:gap-6 md:pt-[104px]">
          {/* Logo */}
          <img
            src="/images/logo.webp"
            alt="Logo Vinahentai"
            className="h-[75px] w-[340px]"
          />

          {/* Form đăng ký */}
          <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col items-center gap-6 overflow-y-auto rounded-xl border p-4 md:min-h-[450px]">
            {/* Tiêu đề */}
            <div className="flex w-full flex-col gap-[11px]">
              <h1 className="sr-only">
                Đăng ký tài khoản Vinahentai miễn phí để tham gia cộng đồng đọc truyện
              </h1>
              <div className="from-txt-secondary h-[1px] w-full bg-gradient-to-r to-transparent md:w-[370px]"></div>
            </div>

            {/* Form fields */}
            <form action="/register" method="post" onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
              {actionData?.error && (
                <div className="rounded bg-red-500/10 p-2 text-sm font-medium text-red-500">
                  {actionData.error.message}
                </div>
              )}

              {/* Tên */}
              <div className="flex w-full flex-col gap-2">
                <div className="flex items-center gap-[10px] pb-3">
                  <label
                    htmlFor="name"
                    className="text-txt-primary text-xs leading-4 font-semibold"
                  >
                    Username
                  </label>
                </div>
                <div
                  className={`bg-bgc-layer2 border-bd-default flex w-full items-center rounded-xl border px-3 py-[10px] ${
                    usernameError ? "border-red-500" : ""
                  }`}
                >
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={name}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="6-15 ký tự, chữ cái hoặc số"
                    className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                    required
                  />
                </div>

                {/* Username validation error */}
                {usernameError && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{usernameError}</span>
                  </div>
                )}

                {/* Username format hint */}
                {!usernameError && (
                  <div className="text-txt-secondary text-xs">
                    6-15 ký tự, chỉ dùng chữ cái (a-z, A-Z) và số (0-9)
                  </div>
                )}
              </div>

              {/* Email */}
              <div className="flex w-full flex-col">
                <div className="flex items-center gap-[10px] pb-3">
                  <label
                    htmlFor="email"
                    className="text-txt-primary text-xs leading-4 font-semibold"
                  >
                    Email
                  </label>
                </div>
                <div className="bg-bgc-layer2 border-bd-default flex w-full items-center rounded-xl border px-3 py-[10px]">
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Nhập email của bạn"
                    className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                    required
                  />
                </div>
              </div>

              {/* Mật khẩu */}
              <div className="flex w-full flex-col">
                <div className="flex items-center gap-[10px] pb-3">
                  <label
                    htmlFor="password"
                    className="text-txt-primary text-xs leading-4 font-semibold"
                  >
                    Mật khẩu
                  </label>
                </div>
                <div className="bg-bgc-layer2 border-bd-default flex w-full items-center rounded-xl border px-3 py-[10px]">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu của bạn"
                    className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                    required
                  />
                </div>
              </div>

              {/* Nhập lại mật khẩu */}
              <div className="flex w-full flex-col">
                <div className="flex items-center gap-[10px] pb-3">
                  <label
                    htmlFor="confirmPassword"
                    className="text-txt-primary text-xs leading-4 font-semibold"
                  >
                    Nhập lại mật khẩu
                  </label>
                </div>
                <div className="bg-bgc-layer2 border-bd-default flex w-full items-center rounded-xl border px-3 py-[10px]">
                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu của bạn"
                    className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                    required
                  />
                </div>
              </div>

              {/* Link đăng nhập */}
              <div className="flex items-center justify-center gap-2 md:justify-start">
                <span className="text-txt-secondary text-sm leading-5 font-medium">
                  Đã có tài khoản?
                </span>
                <Link
                  to="/login"
                  className="text-txt-focus text-sm leading-5 font-medium"
                >
                  Đăng nhập ngay
                </Link>
              </div>

              {/* Nút đăng ký */}
              <button
                type="submit"
                disabled={isSubmitting || usernameError !== ""}
                className="to-lav-500 h-11 w-full rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm leading-5 font-semibold text-black shadow-[0px_4px_8.9px_rgba(196,69,255,0.25)] disabled:opacity-70"
              >
                {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* (ĐÃ ẨN) Faction Selection Dialog – giữ comment để team khác biết đã bỏ */}
      {/*
      <FactionSelectionDialog
        isOpen={false}
        onClose={() => {}}
        userName={name || "Người chơi"}
        onSelectFaction={() => {}}
      />
      */}

      {/* Gender Selection Dialog */}
    </>
  );
}
