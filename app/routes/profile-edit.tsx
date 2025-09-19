import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  type LoaderFunctionArgs,
  useSubmit,
} from "react-router-dom";
import { useActionData, useLoaderData, useNavigation } from "react-router-dom";
import { Camera, FileText, Mail, User, AlertTriangle, Coins } from "lucide-react";

import { updateUserProfile } from "~/.server/mutations/user.mutation";
import { requireLogin } from "~/.server/services/auth.server";
import {
  commitUserSession,
  getUserSession,
  setUserDataToSession,
} from "~/.server/services/session.svc";
import { ImageUploader } from "~/components/image-uploader";
import { UserModel } from "~/database/models/user.model";
import { useFileOperations } from "~/hooks/use-file-operations";
import { validateUsername, USERNAME_CHANGE_COST } from "~/utils/username-validator";

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireLogin(request);
  const userData = await UserModel.findById(user.id).lean();

  if (!userData) {
    throw new Error("Không tìm thấy người dùng");
  }

  return { user: userData };
}

// Action to handle form submission
export async function action({ request }: ActionFunctionArgs) {
  const user = await requireLogin(request);

  const formData = await request.formData();

  const updatedData: any = {
    name: formData.get("name") as string,
    bio: formData.get("bio") as string,
  };

  // Chỉ cập nhật avatar nếu có giá trị mới
  const avatarUrl = formData.get("avatar") as string;
  if (avatarUrl) {
    updatedData.avatar = avatarUrl;
  }

  const result = await updateUserProfile(request, user.id, updatedData);

  // Cập nhật session với thông tin mới
  let updatedSession = null;
  const hasNameChange = updatedData.name !== user.name;
  const hasAvatarChange = updatedData.avatar && updatedData.avatar !== user.avatar;

  if (hasNameChange || hasAvatarChange) {
    const session = await getUserSession(request);
    const updatedUser = {
      ...user,
      name: updatedData.name,
      ...(updatedData.avatar && { avatar: updatedData.avatar }),
    };
    setUserDataToSession(session, updatedUser);
    updatedSession = session;
  }

  const response = { success: true, message: result.message };

  if (updatedSession) {
    return Response.json(response, {
      headers: {
        "Set-Cookie": await commitUserSession(updatedSession),
      },
    });
  }

  return response;
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  try {
    const response = await serverAction<typeof action>();
    if (response.success) {
      toast.success(response.message);
    } else {
      toast.error(response.message);
    }
  } catch (error) {
    toast.error("Có lỗi xảy ra khi lưu thông tin");
  }
}

export default function ProfileEdit() {
  const { user } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const { uploadFileWithFetcher, isUploading } = useFileOperations();
  const submit = useSubmit();
  const formRef = useRef<HTMLFormElement>(null);

  // State for avatar handling
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>(user.avatar || "");
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>(user.avatar || "");

  // State for username validation
  const [username, setUsername] = useState<string>(user.name);
  const [usernameError, setUsernameError] = useState<string>("");
  const [showUsernameCostWarning, setShowUsernameCostWarning] = useState<boolean>(false);

  const isSubmitting = navigation.state === "submitting";

  // Check if username has changed from original
  const usernameChanged = username !== user.name;
  const hasEnoughGold = user.gold >= USERNAME_CHANGE_COST;

  // Cleanup object URL khi component unmount
  useEffect(() => {
    return () => {
      if (avatarPreview && avatarPreview.startsWith("blob:")) {
        URL.revokeObjectURL(avatarPreview);
      }
    };
  }, [avatarPreview]);

  // Handle file selection - chỉ preview local, không upload ngay
  const handleFileSelect = (file: File) => {
    setSelectedFile(file);

    // Tạo preview URL từ file local
    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);
  };

  // Handle clear avatar
  const handleClearAvatar = () => {
    // Clean up object URL nếu có
    if (avatarPreview && avatarPreview.startsWith("blob:")) {
      URL.revokeObjectURL(avatarPreview);
    }
    setSelectedFile(null);
    setAvatarPreview("");
    setUploadedAvatarUrl("");
  };

  // Handle username change and validation
  const handleUsernameChange = (value: string) => {
    setUsername(value);
    
    // Real-time validation
    const validation = validateUsername(value);
    if (!validation.isValid) {
      setUsernameError(validation.error || "Username không hợp lệ");
    } else {
      setUsernameError("");
    }

    // Show cost warning if username changed from original
    const changed = value !== user.name;
    setShowUsernameCostWarning(changed);
  };

  // Helper function để submit form
  const submitForm = (avatarUrl: string) => {
    try {
      if (!formRef.current) return;

      const formData = new FormData(formRef.current);
      formData.set("avatar", avatarUrl);

      submit(formData, {
        method: "post",
      });
    } catch (error) {
      toast.error("Có lỗi xảy ra khi xử lý");
    }
  };

  // Handle form submit với upload avatar trước
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Nếu có file mới được chọn, upload trước
    if (selectedFile) {
      uploadFileWithFetcher(selectedFile, {
        prefixPath: "avatar-uploads",
        onSuccess: (data) => {
          // Clean up local preview URL
          if (avatarPreview.startsWith("blob:")) {
            URL.revokeObjectURL(avatarPreview);
          }
          setUploadedAvatarUrl(data.url);
          setAvatarPreview(data.url);
          setSelectedFile(null);

          // Submit form với avatar URL mới
          submitForm(data.url);
        },
        onError: (error) => {
          toast.error(error || "Upload thất bại");
        },
      });
    } else {
      // Submit form với avatar URL hiện tại
      submitForm(uploadedAvatarUrl);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[951px] flex-col items-start gap-6 px-4 py-6 sm:px-6 lg:px-0">
      <Toaster position="bottom-right" />
      {/* Main Form Container */}
      <div className="flex w-full flex-col items-start gap-6">
        {/* Page Title */}
        <h1
          className="text-txt-primary font-sans text-2xl leading-9 font-semibold sm:text-3xl"
          style={{ textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)" }}
        >
          Sửa hồ sơ
        </h1>

        {/* Form Content */}
        <div className="bg-bgc-layer1 border-bd-default w-full rounded-xl border p-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] sm:p-6">
          <form
            ref={formRef}
            onSubmit={handleSubmit}
            id="profile-form"
            className="flex flex-col gap-6"
          >
            {/* Username Field */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-fit items-center gap-1.5">
                <User className="text-txt-secondary h-4 w-4" />
                <label className="text-txt-primary font-sans text-base font-semibold">
                  Username
                </label>
              </div>
              <div className="w-full sm:w-[680px] space-y-2">
                <input
                  type="text"
                  name="name"
                  value={username}
                  onChange={(e) => handleUsernameChange(e.target.value)}
                  className={`bg-bgc-layer2 border-bd-default text-txt-primary focus:border-lav-500 w-full rounded-xl border px-3 py-2.5 font-sans text-base font-medium outline-none ${
                    usernameError ? "border-red-500 focus:border-red-500" : ""
                  }`}
                  placeholder="6-15 ký tự, chỉ chữ cái và số"
                />
                
                {/* Username validation error */}
                {usernameError && (
                  <div className="flex items-center gap-2 text-red-500 text-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <span>{usernameError}</span>
                  </div>
                )}

                {/* Username change cost warning */}
                {showUsernameCostWarning && !usernameError && (
                  <div className={`flex items-center gap-2 text-sm p-3 rounded-lg border ${
                    hasEnoughGold 
                      ? "bg-yellow-500/10 border-yellow-500 text-yellow-600" 
                      : "bg-red-500/10 border-red-500 text-red-600"
                  }`}>
                    <Coins className="h-4 w-4" />
                    <div>
                      <div className="font-medium">
                        Đổi username sẽ tốn {USERNAME_CHANGE_COST.toLocaleString()} Ngọc
                      </div>
                      <div className="text-xs opacity-80">
                        Hiện tại bạn có {user.gold.toLocaleString()} Ngọc
                        {!hasEnoughGold && " (không đủ)"}
                      </div>
                    </div>
                  </div>
                )}

                {/* Username format hint */}
                {!showUsernameCostWarning && !usernameError && (
                  <div className="text-txt-secondary text-xs">
                    6-15 ký tự, chỉ được sử dụng chữ cái (a-z, A-Z) và số (0-9)
                  </div>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-fit items-center gap-1.5">
                <Mail className="text-txt-secondary h-4 w-4" />
                <label className="text-txt-primary font-sans text-base font-semibold">
                  Email
                </label>
              </div>
              <div className="w-full sm:w-[680px]">
                <input
                  readOnly
                  type="email"
                  name="email"
                  defaultValue={user.email}
                  className="bg-bgc-layer2 border-bd-default text-txt-secondary w-full cursor-not-allowed rounded-xl border px-3 py-2.5 font-sans text-base font-medium opacity-60 outline-none"
                />
              </div>
            </div>

            {/* Avatar Field */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div className="flex min-w-fit items-center gap-1.5 sm:items-start">
                <Camera className="text-txt-secondary h-4 w-4 sm:mt-0.5" />
                <label className="text-txt-primary font-sans text-base font-semibold">
                  Ảnh đại diện
                </label>
              </div>
              <div className="flex w-full flex-col gap-4 sm:w-[680px]">
                <div className="h-32 w-44">
                  <ImageUploader
                    onFileSelect={handleFileSelect}
                    onClear={handleClearAvatar}
                    preview={avatarPreview}
                    uploadText="Chọn ảnh"
                    accept="image/*"
                    aspectRatio="auto"
                    className="h-full"
                  />
                </div>

                {/* Hidden input to store avatar URL */}
                <input type="hidden" name="avatar" value={uploadedAvatarUrl} />

                {/* Upload status */}
                {isUploading && (
                  <div className="text-txt-secondary text-sm">Đang upload ảnh...</div>
                )}
              </div>
            </div>

            {/* Bio Field */}
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
              <div className="flex min-w-fit items-center gap-1.5 sm:items-start">
                <FileText className="text-txt-secondary h-4 w-4 sm:mt-1" />
                <label className="text-txt-primary font-sans text-base font-semibold">
                  Giới thiệu
                </label>
              </div>
              <div className="w-full sm:w-[681px]">
                <textarea
                  name="bio"
                  defaultValue={user.bio}
                  placeholder="Nhập giới thiệu vào đây..."
                  className="bg-bgc-layer2 border-bd-default text-txt-primary placeholder:text-txt-secondary focus:border-lav-500 min-h-60 w-full resize-none rounded-xl border px-3 py-2.5 font-sans text-base font-medium outline-none"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex w-full flex-col items-center gap-2.5 sm:items-end">
        <button
          type="submit"
          form="profile-form"
          disabled={
            isSubmitting || 
            isUploading || 
            (usernameError !== "") || 
            (usernameChanged && !hasEnoughGold)
          }
          className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b from-[#DD94FF] to-[#D373FF] px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-opacity disabled:opacity-50 sm:w-52"
        >
          <span className="text-center font-sans text-sm font-semibold text-black">
            {isUploading ? "Đang upload..." : isSubmitting ? "Đang lưu..." : "Lưu"}
          </span>
        </button>
        
        {/* Error message for insufficient gold */}
        {usernameChanged && !hasEnoughGold && (
          <div className="text-red-600 text-sm text-center">
            Bạn cần {USERNAME_CHANGE_COST.toLocaleString()} Ngọc để đổi username
          </div>
        )}
      </div>

      {/* Success Message */}
      {actionData?.success && (
        <div className="bg-success-success/10 border-success-success text-success-success w-full rounded-lg border p-4">
          {actionData.message}
        </div>
      )}
    </div>
  );
}
