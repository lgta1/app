import { useState } from "react";
import {
  Form,
  Link,
  type MetaFunction,
  redirect,
  useActionData,
  useNavigation,
  useSearchParams,
} from "react-router";

import { login } from "@/services/auth.server";
import { getUserInfoFromSession } from "@/services/session.svc";

import type { Route } from "./+types/login";

import { isBusinessError, returnBusinessError } from "~/helpers/errors.helper";

export const meta: MetaFunction = () => {
  return [
    { title: "Đăng nhập | WuxiaWorld" },
    {
      name: "description",
      content: "Đăng nhập vào tài khoản WuxiaWorld để trải nghiệm đầy đủ",
    },
  ];
};

export async function loader({ request }: Route.LoaderArgs) {
  // Check if the user is already logged in
  const userInfo = await getUserInfoFromSession(request);

  if (userInfo) {
    return redirect("/");
  }
}

export async function action({ request }: Route.ActionArgs) {
  try {
    return await login({ request });
  } catch (error) {
    if (isBusinessError(error)) {
      return returnBusinessError(error);
    }

    throw error;
  }
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const registerSuccess = searchParams.get("registerSuccess") === "true";

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="bg-gradient-radial to-bgc-layer1 min-h-screen w-full from-[#191758] px-4">
      {/* Container chính */}
      <div className="mx-auto mb-10 flex w-full max-w-[402px] flex-col items-center gap-[46px] pt-[104px] md:max-w-[558px] md:gap-6 md:pt-[104px]">
        {/* Logo */}
        <img src="/images/logo.png" alt="Logo" className="h-[75px] w-[240px]" />

        {/* Banner */}
        <div className="flex w-full flex-col justify-center gap-[15px] md:gap-[12px]">
          <img
            src="/images/banners/topbanner-1.png"
            alt="Banner 1"
            className="h-[53px] w-full md:h-[69px]"
          />
          <img
            src="/images/banners/topbanner-2.png"
            alt="Banner 2"
            className="h-[53px] w-full md:h-[69px]"
          />
        </div>

        {/* Form đăng nhập */}
        <div className="border-bd-default bg-bgc-layer1 flex h-[444px] w-full flex-col items-center gap-6 overflow-y-auto rounded-xl border p-4 md:max-h-[450px] md:min-h-[376px]">
          {/* Tiêu đề */}
          <div className="flex w-full flex-col gap-[11px]">
            <h1 className="text-txt-primary text-center text-3xl leading-9 font-semibold md:text-left">
              Đăng nhập
            </h1>
            <div className="from-txt-secondary h-[1px] w-full bg-gradient-to-r to-transparent md:w-[370px]"></div>
          </div>

          {/* Form */}
          <Form method="post" className="flex w-full flex-col gap-4">
            {registerSuccess && (
              <div className="rounded bg-green-500/10 p-2 text-sm font-medium text-green-500">
                Chúc mừng bạn đã đăng ký tài khoản thành công
              </div>
            )}

            {actionData?.error && (
              <div className="rounded bg-red-500/10 p-2 text-sm font-medium text-red-500">
                {actionData.error.message}
              </div>
            )}

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
                  placeholder="Nhập email của bạn"
                  className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
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
                  placeholder="Nhập mật khẩu của bạn"
                  className="text-txt-secondary w-full bg-transparent text-base leading-6 font-medium outline-none"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Link đăng ký */}
            <div className="flex items-center justify-start gap-2">
              <span className="text-txt-secondary text-sm leading-5 font-medium">
                Chưa có tài khoản?
              </span>
              <Link
                to="/dang-ky"
                className="text-txt-focus text-sm leading-5 font-medium"
              >
                Đăng ký ngay
              </Link>
            </div>

            {/* Nút đăng nhập */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="to-lav-500 h-11 w-full rounded-xl bg-gradient-to-b from-[#DD94FF] px-4 py-3 text-sm leading-5 font-semibold text-black shadow-[0px_4px_8.9px_rgba(196,69,255,0.25)] disabled:opacity-70"
            >
              {isSubmitting ? "Đang xử lý..." : "Đăng nhập"}
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}
