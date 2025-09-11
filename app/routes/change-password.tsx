import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  type LoaderFunctionArgs,
  redirect,
} from "react-router-dom";
import { Form, useActionData } from "react-router-dom";

import { generateSalt, hashPassword, requireLogin } from "@/services/auth.server";

import { UserModel } from "~/database/models/user.model";

interface ActionData {
  error?: string;
  success?: boolean;
  step?: 1 | 2;
}

export async function loader({ request }: LoaderFunctionArgs) {
  await requireLogin(request);
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await requireLogin(request);
  const userId = user.id;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "verify-current") {
    const currentPassword = formData.get("currentPassword") as string;

    if (!currentPassword) {
      return { error: "Vui lòng nhập mật khẩu hiện tại", step: 1 };
    }

    try {
      const user = await UserModel.findById(userId);
      if (!user) {
        return { error: "Không tìm thấy người dùng", step: 1 };
      }

      const hashedPassword = hashPassword(currentPassword, user.salt);
      if (hashedPassword !== user.password) {
        return { error: "Mật khẩu hiện tại không đúng", step: 1 };
      }

      return { success: true, step: 2 };
    } catch (error) {
      return { error: "Có lỗi xảy ra, vui lòng thử lại", step: 1 };
    }
  }

  if (intent === "update-password") {
    const newPassword = formData.get("newPassword") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (!newPassword || !confirmPassword) {
      return { error: "Vui lòng nhập đầy đủ thông tin", step: 2 };
    }

    if (newPassword !== confirmPassword) {
      return { error: "Mật khẩu xác nhận không khớp", step: 2 };
    }

    if (newPassword.length < 6) {
      return { error: "Mật khẩu phải có ít nhất 6 ký tự", step: 2 };
    }

    try {
      const salt = generateSalt();
      const hashedPassword = hashPassword(newPassword, salt);
      await UserModel.findByIdAndUpdate(userId, {
        password: hashedPassword,
        salt: salt,
      });

      return {
        success: true,
        step: 3,
      };
    } catch (error) {
      return { error: "Có lỗi xảy ra, vui lòng thử lại", step: 2 };
    }
  }

  return { error: "Hành động không hợp lệ" };
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  try {
    const response = await serverAction<typeof action>();
    if (response.step === 3) {
      if (response.success) {
        toast.success("Mật khẩu đã được cập nhật thành công");
        return redirect("/profile");
      } else {
        toast.error(response.error || "Vui lòng kiểm tra lại thông tin");
      }
    }

    return response;
  } catch (error) {
    toast.error("Có lỗi xảy ra khi cập nhật mật khẩu");
  }
}

export default function ChangePassword() {
  const actionData = useActionData<ActionData>();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Update step based on action result
  if (actionData?.step && actionData.step !== currentStep) {
    setCurrentStep(actionData.step);
  }

  if (actionData?.success && currentStep === 1) {
    setCurrentStep(2);
  }

  return (
    <div className="bg-bgc-layer1 flex items-center justify-center p-4 py-8 lg:pb-28">
      <Toaster position="bottom-right" />
      <div className="inline-flex w-96 flex-col items-center justify-start gap-11 sm:w-full sm:max-w-[558px] sm:gap-6">
        {/* Logo */}
        <img className="h-20 w-60 object-contain" src="/images/logo.png" alt="Logo" />

        {/* Main Card */}
        <div className="border-bd-default flex w-full flex-col items-center justify-center gap-6 rounded-xl border bg-slate-950 p-4">
          {/* Header */}
          <div className="flex flex-col items-start justify-start gap-2.5 self-stretch">
            <h1 className="justify-center self-stretch font-sans text-2xl leading-9 font-semibold text-white sm:text-3xl">
              Thay đổi mật khẩu
            </h1>
            <div className="h-px w-full bg-gradient-to-r from-slate-500 to-slate-500/0" />
          </div>

          {/* Error Message */}
          {actionData?.error && (
            <div className="bg-error-error/10 border-error-error/20 self-stretch rounded-xl border p-3">
              <p className="text-error-error text-sm font-medium">{actionData.error}</p>
            </div>
          )}

          <Form method="post" className="flex flex-col gap-4 self-stretch">
            {currentStep === 1 ? (
              // Step 1: Verify Current Password
              <>
                <input type="hidden" name="intent" value="verify-current" />

                <div className="flex flex-col items-start justify-start self-stretch">
                  <label className="inline-flex items-center justify-center gap-2.5 pb-3">
                    <span className="text-txt-primary justify-center font-sans text-xs leading-none font-semibold">
                      Nhập mật khẩu hiện tại
                    </span>
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    required
                    className="bg-bgc-layer2 outline-bd-default placeholder:text-txt-secondary focus:outline-lav-500 self-stretch rounded-xl px-3 py-2.5 font-sans text-base leading-normal font-medium text-white outline-1 outline-offset-[-1px]"
                    placeholder="Nhập mật khẩu hiện tại"
                  />
                </div>

                <button
                  type="submit"
                  className="inline-flex h-11 items-center justify-center gap-2.5 self-stretch rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-all duration-200 hover:from-fuchsia-400 hover:to-fuchsia-500"
                >
                  <span className="justify-center text-center font-sans text-sm leading-tight font-semibold text-black">
                    Tiếp
                  </span>
                </button>
              </>
            ) : (
              // Step 2: Enter New Password
              <>
                <input type="hidden" name="intent" value="update-password" />

                <div className="flex flex-col items-start justify-start gap-4 self-stretch">
                  <div className="flex flex-col items-start justify-start self-stretch">
                    <label className="inline-flex items-center justify-center gap-2.5 pb-3">
                      <span className="text-txt-primary justify-center font-sans text-xs leading-none font-semibold">
                        Nhập mật khẩu mới
                      </span>
                    </label>
                    <input
                      type="password"
                      name="newPassword"
                      required
                      minLength={6}
                      className="bg-bgc-layer2 outline-bd-default placeholder:text-txt-secondary focus:outline-lav-500 self-stretch rounded-xl px-3 py-2.5 font-sans text-base leading-normal font-medium text-white outline-1 outline-offset-[-1px]"
                      placeholder="Nhập mật khẩu mới"
                    />
                  </div>

                  <div className="flex flex-col items-start justify-start self-stretch">
                    <label className="inline-flex items-center justify-center gap-2.5 pb-3">
                      <span className="text-txt-primary justify-center font-sans text-xs leading-none font-semibold">
                        Nhập lại mật khẩu mới
                      </span>
                    </label>
                    <input
                      type="password"
                      name="confirmPassword"
                      required
                      minLength={6}
                      className="bg-bgc-layer2 outline-bd-default placeholder:text-txt-secondary focus:outline-lav-500 self-stretch rounded-xl px-3 py-2.5 font-sans text-base leading-normal font-medium text-white outline-1 outline-offset-[-1px]"
                      placeholder="Nhập lại mật khẩu mới"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 self-stretch sm:flex-row">
                  <button
                    type="submit"
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-fuchsia-300 to-fuchsia-400 px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-all duration-200 hover:from-fuchsia-400 hover:to-fuchsia-500"
                  >
                    <span className="justify-center text-center font-sans text-sm leading-tight font-semibold text-black">
                      Cập nhật
                    </span>
                  </button>
                </div>
              </>
            )}
          </Form>
        </div>
      </div>
    </div>
  );
}
