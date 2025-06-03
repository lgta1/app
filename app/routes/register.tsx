import { useState } from "react";
import { Form, Link, redirect, useActionData, useNavigation } from "react-router";

import { register } from "@/services/auth.server";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/register";

import { isBusinessError, returnBusinessError } from "~/helpers/errors";

export async function loader({ request }: Route.LoaderArgs) {
  // Kiểm tra xem người dùng đã đăng nhập chưa
  const userInfo = await getUserInfoFromSession(request);

  if (userInfo) {
    return redirect("/");
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    return register({ request });
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
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="bg-gradient-radial to-bgc-layer1 min-h-screen w-full from-[#191758]">
      {/* Container chính */}
      <div className="mx-auto mb-10 flex w-[558px] flex-col items-center gap-6 pt-[104px]">
        {/* Logo */}
        <img src="/images/logo.png" alt="Logo" className="h-[75px] w-[240px]" />

        {/* Banner */}
        <div className="flex flex-col justify-center gap-[12px]">
          <img
            src="/images/banners/topbanner-1.png"
            alt="Banner 1"
            className="h-[69px] w-[558px]"
          />
          <img
            src="/images/banners/topbanner-2.png"
            alt="Banner 2"
            className="h-[69px] w-[558px]"
          />
        </div>

        {/* Form đăng ký */}
        <div className="border-bd-default bg-bgc-layer1 flex w-full flex-col items-center gap-6 overflow-y-auto rounded-xl border p-4">
          {/* Tiêu đề */}
          <div className="flex w-full flex-col gap-[11px]">
            <h1 className="text-txt-primary text-3xl font-semibold">Đăng ký</h1>
            <div className="from-txt-secondary h-[1px] w-[370px] bg-gradient-to-r to-transparent"></div>
          </div>

          {/* Form fields */}
          <Form method="post" className="flex w-full flex-col gap-4">
            {actionData?.error && (
              <div className="rounded bg-red-500/10 p-2 text-sm font-medium text-red-500">
                {actionData.error.message}
              </div>
            )}

            {/* Tên */}
            <div className="flex w-full flex-col">
              <div className="flex items-center gap-[10px] pb-3">
                <label htmlFor="name" className="text-txt-primary text-xs font-semibold">
                  Tên
                </label>
              </div>
              <div className="bg-bgc-layer2 border-bd-default flex w-full items-center rounded-xl border px-3 py-[10px]">
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nhập tên của bạn"
                  className="text-txt-secondary w-full bg-transparent text-base font-medium outline-none"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex w-full flex-col">
              <div className="flex items-center gap-[10px] pb-3">
                <label htmlFor="email" className="text-txt-primary text-xs font-semibold">
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
                  className="text-txt-secondary w-full bg-transparent text-base font-medium outline-none"
                  required
                />
              </div>
            </div>

            {/* Mật khẩu */}
            <div className="flex w-full flex-col">
              <div className="flex items-center gap-[10px] pb-3">
                <label
                  htmlFor="password"
                  className="text-txt-primary text-xs font-semibold"
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
                  className="text-txt-secondary w-full bg-transparent text-base font-medium outline-none"
                  required
                />
              </div>
            </div>

            {/* Nhập lại mật khẩu */}
            <div className="flex w-full flex-col">
              <div className="flex items-center gap-[10px] pb-3">
                <label
                  htmlFor="confirmPassword"
                  className="text-txt-primary text-xs font-semibold"
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
                  className="text-txt-secondary w-full bg-transparent text-base font-medium outline-none"
                  required
                />
              </div>
            </div>

            {/* Link đăng nhập */}
            <div className="flex items-center gap-2">
              <span className="text-txt-secondary text-sm font-medium">
                Đã có tài khoản?
              </span>
              <Link to="/dang-nhap" className="text-lav-500 text-sm font-medium">
                Đăng nhập ngay
              </Link>
            </div>

            {/* Nút đăng ký */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="to-lav-500 w-full rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm font-semibold text-black shadow-[0px_4px_8.9px_rgba(196,69,255,0.25)] disabled:opacity-70"
            >
              {isSubmitting ? "Đang xử lý..." : "Đăng ký"}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
