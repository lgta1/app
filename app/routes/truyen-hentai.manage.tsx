import { ProfileMangaUploaded } from "~/components/profile-manga-uploaded";
import { requireLogin } from "@/services/auth.server";
import type { LoaderFunctionArgs } from "react-router-dom";

export async function loader({ request }: LoaderFunctionArgs) {
  // require login so API /api/manga/uploaded can return user-specific data
  await requireLogin(request);
  return null;
}

export const meta = () => [
  { title: "Quản lý truyện - Trang cá nhân" },
  { name: "description", content: "Quản lý truyện bạn đã đăng. Chỉnh sửa, thêm chương hoặc tạo truyện mới." },
];

export default function MangaManage() {
  return (
    <div className="mx-auto w-full max-w-[968px] p-4 lg:py-8">
      <div className="mb-6 flex items-center gap-3">
        <h1 className="text-xl font-semibold text-white uppercase">Quản lý truyện</h1>
      </div>

      <ProfileMangaUploaded />
    </div>
  );
}
