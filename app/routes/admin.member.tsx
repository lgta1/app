import { useState } from "react";
import { toast, Toaster } from "react-hot-toast";
import {
  type ActionFunctionArgs,
  type ClientActionFunctionArgs,
  type LoaderFunctionArgs,
  type MetaFunction,
} from "react-router";
import { useLoaderData, useSearchParams, useSubmit } from "react-router-dom";
import { Gift, Search, Trash2, TriangleAlert } from "lucide-react";

import { banUser, deleteUser, rewardGoldUser } from "@/mutations/user.mutation";
import { getListModAndAdmin, getListUser, getTotalUserCount } from "@/queries/user.query";
import { requireAdminOrModLogin } from "@/services/auth.server";

import { BanMemberDialog } from "~/components/dialog-ban-member";
import { RewardGoldDialog } from "~/components/dialog-reward-gold";
import { WarningActionDialog } from "~/components/dialog-warning-action";
import { Dropdown } from "~/components/dropdown";
import { Pagination } from "~/components/pagination";
import type { UserType } from "~/database/models/user.model";

export const meta: MetaFunction = () => {
  return [
    { title: "Quản lý thành viên | Admin" },
    { name: "description", content: "Trang quản lý thành viên của hệ thống" },
  ];
};

const SORT_OPTIONS = [
  { value: "newest", label: "Mới tham gia" },
  { value: "oldest", label: "Tham gia lâu nhất" },
  { value: "most_manga", label: "Đăng nhiều truyện nhất" },
  { value: "least_manga", label: "Đăng ít truyện nhất" },
  { value: "most_warnings", label: "Cảnh cáo nhiều nhất" },
  { value: "highest_level", label: "Cấp cao nhất" },
  { value: "lowest_level", label: "Cấp thấp nhất" },
];

interface LoaderData {
  members: UserType[];
  admins: UserType[];
  currentPage: number;
  totalPages: number;
  searchTerm: string;
  activeTab: string;
  sortBy: string;
}

export async function loader({ request }: LoaderFunctionArgs): Promise<LoaderData> {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const searchTerm = url.searchParams.get("search") || "";
  const activeTab = url.searchParams.get("tab") || "members";
  const sortBy = url.searchParams.get("sort") || "newest";
  const limit = 10;

  if (activeTab === "admins") {
    const admins = await getListModAndAdmin(searchTerm);
    return {
      members: [],
      admins,
      currentPage: 1,
      totalPages: 1,
      searchTerm,
      activeTab,
      sortBy,
    };
  }

  const [members, totalMembers] = await Promise.all([
    getListUser(page, limit, searchTerm, sortBy),
    getTotalUserCount(searchTerm),
  ]);

  const totalPages = Math.ceil(totalMembers / limit);

  return {
    members,
    admins: [],
    currentPage: page,
    totalPages,
    searchTerm,
    activeTab,
    sortBy,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  await requireAdminOrModLogin(request);

  const formData = await request.formData();
  const action = formData.get("action");
  const userId = formData.get("userId");

  if (action === "delete" && typeof userId === "string") {
    try {
      await deleteUser(request, userId);
      return { success: true, message: "Xóa người dùng thành công" };
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error ? error.message : "Có lỗi xảy ra khi xóa người dùng",
      };
    }
  }

  if (action === "ban" && typeof userId === "string") {
    const days = formData.get("days");
    const message = formData.get("message");

    if (typeof days === "string" && typeof message === "string") {
      try {
        await banUser(request, userId, parseInt(days, 10), message);
        return { success: true, message: "Khóa tài khoản thành công" };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Có lỗi xảy ra khi khóa tài khoản",
        };
      }
    }
  }

  if (action === "reward" && typeof userId === "string") {
    const amount = formData.get("amount");
    const message = formData.get("message");

    if (typeof amount === "string" && typeof message === "string") {
      try {
        await rewardGoldUser(request, userId, parseInt(amount, 10), message);
        return { success: true, message: "Thưởng dâm ngọc thành công" };
      } catch (error) {
        return {
          success: false,
          message:
            error instanceof Error ? error.message : "Có lỗi xảy ra khi thưởng dâm ngọc",
        };
      }
    }
  }

  return { success: false, message: "Hành động không hợp lệ" };
}

export async function clientAction({ serverAction }: ClientActionFunctionArgs) {
  const data = await serverAction<{ success: boolean; message: string }>();
  if (data.success) {
    toast.success(data.message);
  } else {
    toast.error(data.message);
  }
}

interface TabProps {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}

function Tab({ active, children, onClick }: TabProps) {
  return (
    <div
      className={`flex w-36 cursor-pointer items-center justify-center gap-2.5 p-3 ${
        active ? "border-lav-500 border-b" : ""
      }`}
      onClick={onClick}
    >
      <div
        className={`font-sans text-base leading-normal font-medium ${
          active ? "text-txt-primary" : "text-txt-secondary"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: "active" | "disabled";
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "active") {
    return (
      <div className="flex items-center justify-center gap-2.5 rounded-[32px] bg-[#25EBAC]/10 px-2 py-1 backdrop-blur-[3.40px]">
        <div className="font-sans text-xs leading-none font-medium text-[#25EBAC]">
          Đang hoạt động
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2.5 rounded-[32px] bg-[#FF555D]/10 px-2 py-1 backdrop-blur-[3.40px]">
      <div className="font-sans text-xs leading-none font-medium text-[#FF555D]">
        Vô hiệu hóa
      </div>
    </div>
  );
}

interface ActionButtonsProps {
  member: UserType;
  onDeleteClick: (member: UserType) => void;
  onBanClick: (member: UserType) => void;
  onRewardClick: (member: UserType) => void;
}

function ActionButtons({
  member,
  onDeleteClick,
  onBanClick,
  onRewardClick,
}: ActionButtonsProps) {
  return (
    <div className="flex items-center justify-start gap-3">
      <div
        className="flex cursor-pointer items-center justify-start gap-1 hover:opacity-70"
        onClick={() => onRewardClick(member)}
      >
        <div className="relative h-5 w-5 overflow-hidden">
          <Gift className="h-5 w-5 text-[#25EBAC]" />
        </div>
      </div>
      <div
        className="flex cursor-pointer items-center justify-start gap-1 hover:opacity-70"
        onClick={() => onBanClick(member)}
      >
        <div className="relative h-5 w-5 overflow-hidden">
          <TriangleAlert className="h-5 w-5 text-[#FFE133]" />
        </div>
      </div>
      <div
        className="flex cursor-pointer items-center justify-start gap-1 hover:opacity-70"
        onClick={() => onDeleteClick(member)}
      >
        <div className="relative h-5 w-5 overflow-hidden">
          <Trash2 className="text-txt-secondary h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function AdminMember() {
  const {
    members,
    admins,
    currentPage,
    totalPages,
    searchTerm: initialSearchTerm,
    activeTab: initialActiveTab,
    sortBy: initialSortBy,
  } = useLoaderData<LoaderData>();

  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const [activeTab, setActiveTab] = useState<"members" | "admins">(
    initialActiveTab as "members" | "admins",
  );
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    member: UserType | null;
  }>({
    open: false,
    member: null,
  });
  const [banDialog, setBanDialog] = useState<{
    open: boolean;
    member: UserType | null;
  }>({
    open: false,
    member: null,
  });
  const [rewardDialog, setRewardDialog] = useState<{
    open: boolean;
    member: UserType | null;
  }>({
    open: false,
    member: null,
  });

  const handleDeleteClick = (member: UserType) => {
    setDeleteDialog({
      open: true,
      member,
    });
  };

  const handleBanClick = (member: UserType) => {
    setBanDialog({
      open: true,
      member,
    });
  };

  const handleRewardClick = (member: UserType) => {
    setRewardDialog({
      open: true,
      member,
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.member) {
      const formData = new FormData();
      formData.append("action", "delete");
      formData.append("userId", deleteDialog.member.id);
      submit(formData, { method: "post" });
    }
  };

  const handleBanConfirm = (days: number, message: string) => {
    if (banDialog.member) {
      const formData = new FormData();
      formData.append("action", "ban");
      formData.append("userId", banDialog.member.id);
      formData.append("days", days.toString());
      formData.append("message", message);
      submit(formData, { method: "post" });
    }
  };

  const handleRewardConfirm = (amount: number, message: string) => {
    if (rewardDialog.member) {
      const formData = new FormData();
      formData.append("action", "reward");
      formData.append("userId", rewardDialog.member.id);
      formData.append("amount", amount.toString());
      formData.append("message", message);
      submit(formData, { method: "post" });
    }
  };

  const handleTabChange = (tab: "members" | "admins") => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    params.delete("page"); // Reset to first page when changing tabs
    submit(params, { method: "get" });
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    const params = new URLSearchParams(searchParams);
    if (value.trim()) {
      params.set("search", value);
    } else {
      params.delete("search");
    }
    params.delete("page"); // Reset to first page when searching
    submit(params, { method: "get" });
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("sort", value);
    params.delete("page"); // Reset to first page when sorting
    submit(params, { method: "get" });
  };

  const handlePageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", page.toString());
    submit(params, { method: "get" });
  };

  // Use real data based on active tab
  const displayData = activeTab === "members" ? members : admins;
  const showPagination = activeTab === "members" && totalPages > 1;

  return (
    <div className="container mx-auto my-8 w-full max-w-[1141px] gap-4 px-4 lg:px-0">
      <Toaster position="bottom-right" />
      <div className="text-txt-primary justify-center text-center text-2xl leading-loose font-semibold">
        Quản lý thành viên
      </div>
      {/* Tab Navigation */}
      <div className="inline-flex h-12 w-full max-w-[968px] items-center justify-start">
        <Tab active={activeTab === "members"} onClick={() => handleTabChange("members")}>
          Thành viên
        </Tab>
        <Tab active={activeTab === "admins"} onClick={() => handleTabChange("admins")}>
          Ban Quản trị
        </Tab>
      </div>

      {/* Main Content */}
      <div className="bg-bgc-layer1 border-bd-default flex min-h-[596px] flex-col items-start justify-start gap-6 self-stretch rounded-xl border p-6 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)]">
        {/* Search and Sort Controls */}
        <div className="flex flex-col items-start justify-between gap-4 self-stretch md:flex-row md:gap-0">
          <div className="bg-bgc-layer2 border-bd-default flex w-full items-center justify-start gap-2 rounded-xl border px-3 py-2 md:w-80">
            <Search className="text-txt-primary h-5 w-5" />
            <input
              type="text"
              placeholder="Tìm thành viên"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="text-txt-secondary placeholder:text-txt-secondary focus:text-txt-primary flex-1 bg-transparent font-sans text-sm leading-tight font-semibold focus:outline-none"
            />
          </div>
          <Dropdown
            options={SORT_OPTIONS}
            value={initialSortBy}
            onSelect={handleSortChange}
            className="w-full md:w-72"
            placeholder="Sắp xếp theo"
          />
        </div>

        {/* Table */}
        <div className="flex flex-col items-start justify-start self-stretch">
          {/* Table Header */}
          <div className="bg-bgc-layer2 hidden items-center justify-start self-stretch rounded-xl lg:flex">
            <div className="flex items-center justify-center gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                STT
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Email
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Tên
              </div>
            </div>
            <div className="flex flex-1 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Cấp
              </div>
            </div>
            <div className="flex w-36 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Truyện đã đăng
              </div>
            </div>
            <div className="flex w-24 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Cảnh cáo
              </div>
            </div>
            <div className="flex w-40 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Trạng thái
              </div>
            </div>
            <div className="flex w-28 items-center justify-start gap-2.5 p-3">
              <div className="text-txt-secondary font-sans text-sm leading-tight font-semibold">
                Tác vụ
              </div>
            </div>
          </div>

          {/* Table Rows */}
          {displayData.map((user, index) => {
            const status: "active" | "disabled" = user.isBanned ? "disabled" : "active";
            const globalIndex =
              activeTab === "members" ? (currentPage - 1) * 10 + index + 1 : index + 1;

            return (
              <div
                key={user.id}
                className="border-bd-default flex flex-col items-start justify-start gap-2 self-stretch border-b p-2 lg:flex-row lg:items-center lg:gap-0 lg:p-0"
              >
                {/* Mobile Layout */}
                <div className="w-full space-y-2 lg:hidden">
                  <div className="flex items-center justify-between">
                    <div className="text-txt-primary font-sans text-sm font-semibold">
                      #{globalIndex}
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="space-y-1">
                    <div className="text-txt-primary font-sans text-sm font-semibold">
                      {user.name}
                    </div>
                    <div className="text-txt-secondary font-sans text-xs font-medium">
                      {user.email}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-txt-primary font-sans text-xs font-medium">
                      {user.level}
                    </div>
                    <div className="text-txt-primary font-sans text-sm font-semibold">
                      {user.mangasCount || 0} truyện | {user.warningsCount || 0} cảnh cáo
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <ActionButtons
                      member={user}
                      onDeleteClick={handleDeleteClick}
                      onBanClick={handleBanClick}
                      onRewardClick={handleRewardClick}
                    />
                  </div>
                </div>

                {/* Desktop Layout */}
                <div className="hidden w-12 items-center justify-center gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {globalIndex}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {user.email}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {user.name}
                  </div>
                </div>
                <div className="hidden flex-1 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {user.level}
                  </div>
                </div>
                <div className="hidden w-36 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {user.mangasCount || 0}
                  </div>
                </div>
                <div className="hidden w-24 items-center justify-start gap-2.5 p-3 lg:flex">
                  <div className="text-txt-primary font-sans text-sm leading-tight font-semibold">
                    {user.warningsCount || 0}
                  </div>
                </div>
                <div className="hidden w-40 items-center justify-start gap-2.5 p-3 lg:flex">
                  <StatusBadge status={status} />
                </div>
                <div className="hidden w-28 items-center justify-start gap-2.5 p-3 lg:flex">
                  <ActionButtons
                    member={user}
                    onDeleteClick={handleDeleteClick}
                    onBanClick={handleBanClick}
                    onRewardClick={handleRewardClick}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {showPagination && (
          <div className="flex flex-col items-center justify-center gap-2.5 self-stretch">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </div>
        )}
      </div>

      {/* Delete Member Dialog */}
      <WarningActionDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title="Xóa thành viên?"
        message={`Hành động này sẽ không thể hoàn tác. Bạn có muốn tiếp tục xóa ${deleteDialog.member?.email}?`}
        confirmText="Xóa thành viên"
        onConfirm={handleDeleteConfirm}
      />

      {/* Ban Member Dialog */}
      <BanMemberDialog
        member={banDialog.member}
        open={banDialog.open}
        onOpenChange={(open) => setBanDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleBanConfirm}
      />

      {/* Reward Member Dialog */}
      <RewardGoldDialog
        member={rewardDialog.member}
        open={rewardDialog.open}
        onOpenChange={(open) => setRewardDialog((prev) => ({ ...prev, open }))}
        onConfirm={handleRewardConfirm}
      />
    </div>
  );
}
