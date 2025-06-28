import { type LoaderFunctionArgs, NavLink } from "react-router";
import { useLoaderData } from "react-router";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  Heart,
  Trash2,
} from "lucide-react";

interface User {
  id: string;
  name: string;
  avatar: string;
  registrationDate: string;
  level: number;
  experience: number;
  maxExperience: number;
  damNgocCount: number;
  chaptersRead: number;
  waifuCount: number;
  mangasPosted: number;
  mangasFollowing: number;
  bio: string;
  waifuCollection: string[];
  followingMangas: {
    id: string;
    title: string;
    cover: string;
    chapter: string;
    views: number;
    likes: number;
  }[];
}

// Mock data - replace with actual data fetching
export async function loader({ request }: LoaderFunctionArgs) {
  // TODO: Fetch actual user data from database
  const user = {
    id: "1",
    name: "Nguyễn Văn A",
    avatar: "https://placehold.co/102x102",
    registrationDate: "02/03/2025",
    level: 7,
    experience: 500,
    maxExperience: 1000,
    damNgocCount: 1000,
    chaptersRead: 1000,
    waifuCount: 10,
    mangasPosted: 10,
    mangasFollowing: 10,
    bio: "Trang web của chúng tôi chỉ cung cấp dịch vụ đọc truyện tranh online với mục đích giải trí và chia sẻ nội dung.",
    waifuCollection: [
      "https://placehold.co/141x211",
      "https://placehold.co/141x211",
      "https://placehold.co/141x213",
      "https://placehold.co/141x213",
      "https://placehold.co/141x213",
      "https://placehold.co/141x213",
    ],
    followingMangas: [
      {
        id: "1",
        title: "Đã Chăm Rồi Thì Hãy Chịu Trách Nhiệm Đi!",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
      {
        id: "2",
        title: "Hành trình mùa xuân xanh",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
      {
        id: "3",
        title: "Bạn gái nội địa",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
      {
        id: "4",
        title: "Chào buổi sáng Call",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
      {
        id: "5",
        title: "Ngón tay ma thuật khơi dậy nhịp đập trái tim",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
      {
        id: "6",
        title: "Giam Giữ Em Trong Mật Ngọt",
        cover: "https://placehold.co/34x34",
        chapter: "Chapter 12",
        views: 1000,
        likes: 1000,
      },
    ],
  };

  return { user };
}

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();

  return (
    <div className="mx-auto flex w-full max-w-[968px] flex-col items-center gap-6 p-4 lg:py-8">
      {/* Profile Info Section */}
      <div className="bg-bgc-layer1 border-bd-default flex w-full flex-col gap-6 rounded-xl border p-4 lg:flex-row lg:p-6">
        {/* Left Section - User Info */}
        <div className="flex flex-1 gap-4 lg:max-w-[514px]">
          <img
            className="h-16 w-16 rounded-full object-cover lg:h-24 lg:w-24"
            src={user.avatar}
            alt={user.name}
          />
          <div className="flex flex-1 flex-col gap-3">
            {/* Name and Badge */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-3">
                <h1 className="text-txt-primary font-sans text-lg font-semibold lg:text-xl">
                  {user.name}
                </h1>
                <img
                  className="h-6 w-20 lg:h-8 lg:w-28"
                  src="https://placehold.co/116x32"
                  alt="User Badge"
                />
              </div>
              <p className="text-txt-secondary text-xs font-medium">
                Ngày đăng ký: {user.registrationDate}
              </p>
            </div>

            {/* Experience Bar */}
            <div className="flex items-center gap-1.5">
              <img
                className="h-8 w-10 lg:h-10 lg:w-12"
                src="/images/icons/exp.png"
                alt="EXP Icon"
              />
              <div className="flex flex-1 flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-txt-primary text-xs font-medium">
                    Kinh nghiệm
                  </span>
                  <span className="text-txt-primary text-xs font-medium">
                    {user.experience}/{user.maxExperience}
                  </span>
                </div>
                <div className="bg-bgc-layer2 h-2 overflow-hidden rounded">
                  <div
                    className="via-lav-500 h-2 rounded bg-gradient-to-r from-[#3D1351] to-[#E8B5FF]"
                    style={{ width: `${(user.experience / user.maxExperience) * 100}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="flex flex-col gap-[5px]">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">Giới thiệu</h2>
                <NavLink to="/profile-edit">
                  <Edit3 className="text-success-success h-4 w-4" />
                </NavLink>
              </div>
              <p className="text-txt-secondary text-xs leading-none font-medium">
                {user.bio}
              </p>
            </div>
          </div>
        </div>

        {/* Right Section - Stats */}
        <div className="border-bd-default flex flex-1 flex-col gap-3 rounded-xl border p-2">
          <div className="flex">
            <div className="flex flex-1 flex-col items-center">
              <div className="text-txt-primary text-base font-semibold">{user.level}</div>
              <div className="text-txt-secondary text-xs font-medium">Cấp bậc</div>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <div className="flex items-center gap-1.5">
                <img
                  className="h-5 w-6"
                  src="/images/icons/gold-icon.png"
                  alt="Dâm Ngọc"
                />
                <div className="text-txt-primary text-base font-semibold">
                  {user.damNgocCount.toLocaleString()}
                </div>
              </div>
              <div className="text-txt-secondary text-xs font-medium">Dâm Ngọc</div>
            </div>
          </div>
          <div className="flex">
            <div className="flex flex-1 flex-col items-center">
              <div className="text-txt-primary text-base font-semibold">
                {user.chaptersRead.toLocaleString()}
              </div>
              <div className="text-txt-secondary text-xs font-medium">Chap đã đọc</div>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <div className="text-txt-primary text-base font-semibold">
                {user.waifuCount}
              </div>
              <div className="text-txt-secondary text-xs font-medium">Số Waifu</div>
            </div>
          </div>
          <div className="flex">
            <div className="flex flex-1 flex-col items-center">
              <div className="text-txt-primary text-base font-semibold">
                {user.mangasPosted}
              </div>
              <div className="text-txt-secondary text-xs font-medium">Truyện đã đăng</div>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <div className="text-txt-primary text-base font-semibold">
                {user.mangasFollowing}
              </div>
              <div className="text-txt-secondary text-xs font-medium">
                Truyện theo dõi
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex w-full flex-wrap items-center gap-4">
        <button className="bg-btn-primary flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.40px]">
          <span className="text-txt-inverse text-base font-medium">Tổng quan</span>
        </button>
        <button className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.40px]">
          <span className="text-txt-primary text-base font-medium">Túi đồ</span>
        </button>
        <button className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.40px]">
          <span className="text-txt-primary text-base font-medium">Quản lý truyện</span>
        </button>
        <button className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1.5 rounded-[32px] px-3 py-1.5 backdrop-blur-[3.40px]">
          <span className="text-txt-primary text-base font-medium">Bình luận</span>
        </button>
      </div>

      {/* Waifu Collection Section */}
      <div className="flex w-full flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/images/icons/multi-star.svg" alt="star" />
            <h2 className="text-xl font-semibold text-white uppercase">
              bộ sưu tập waifu
            </h2>
          </div>
          <button className="border-lav-500 flex items-center gap-1.5 rounded-xl border px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(146,53,190,0.25)]">
            <Eye className="text-lav-500 h-5 w-5" />
            <span className="text-txt-focus text-sm font-semibold">Xem tất cả</span>
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 lg:gap-6">
          {user.waifuCollection.map((image: string, index: number) => (
            <img
              key={index}
              className="h-40 w-full rounded-lg object-cover sm:h-48 lg:h-52"
              src={image}
              alt={`Waifu ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Manga Management Section */}
      <div className="flex w-full flex-col gap-4">
        <div className="flex items-center gap-3">
          <BookOpen className="text-lav-500 h-5 w-5" />
          <h2 className="text-xl font-semibold text-white uppercase">quản lý truyện</h2>
        </div>

        <div className="flex flex-col gap-4">
          {/* Sub Navigation */}
          <div className="border-bd-default flex border-b">
            <button className="border-lav-500 flex items-center gap-2.5 border-b p-3">
              <span className="text-base font-semibold text-white">Truyện theo dõi</span>
            </button>
            <button className="flex items-center gap-2.5 p-3">
              <span className="text-txt-secondary text-base font-medium">
                Đã đọc gần đây
              </span>
            </button>
            <button className="flex items-center gap-2.5 p-3">
              <span className="text-txt-secondary text-base font-medium">
                Truyện đã đăng
              </span>
            </button>
          </div>

          {/* Manga List */}
          <div className="flex flex-col items-center gap-4">
            <div className="text-txt-secondary text-sm font-medium">
              Tổng cộng: {user.followingMangas.length}
            </div>

            <div className="flex w-full flex-col gap-2">
              {user.followingMangas.map((manga: User["followingMangas"][0]) => (
                <div
                  key={manga.id}
                  className="bg-bgc-layer1 border-bd-default flex w-full items-center justify-between rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    <img
                      className="h-8 w-8 rounded object-cover"
                      src={manga.cover}
                      alt={manga.title}
                    />
                    <div className="flex flex-1 flex-col gap-0.5">
                      <h3 className="text-txt-primary line-clamp-1 text-sm leading-tight font-medium">
                        {manga.title}
                      </h3>
                      <div className="flex flex-wrap items-start gap-2">
                        <span className="text-txt-focus text-xs font-medium">
                          {manga.chapter}
                        </span>
                        <div className="flex items-center gap-1.5 rounded-[32px] backdrop-blur-[3.40px]">
                          <Eye className="text-txt-secondary h-3 w-3" />
                          <span className="text-txt-secondary text-xs font-medium">
                            {manga.views.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 rounded-[32px] backdrop-blur-[3.40px]">
                          <Heart className="text-txt-secondary h-3 w-3" />
                          <span className="text-txt-secondary text-xs font-medium">
                            {manga.likes.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center">
                    <Trash2 className="text-txt-secondary hover:text-error-error h-5 w-5 cursor-pointer" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            <div className="bg-bgc-layer1 border-bd-default flex items-center rounded-lg border">
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <ChevronLeft className="text-txt-secondary h-4 w-4" />
              </button>
              <button className="bg-btn-primary flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <span className="text-txt-inverse text-sm font-semibold">1</span>
              </button>
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <span className="text-txt-primary text-sm font-semibold">2</span>
              </button>
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <span className="text-txt-primary text-sm font-semibold">3</span>
              </button>
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <span className="text-txt-primary text-sm font-semibold">...</span>
              </button>
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <span className="text-txt-primary text-sm font-semibold">10</span>
              </button>
              <button className="flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
                <ChevronRight className="text-txt-secondary h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
