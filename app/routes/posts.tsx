import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Eye, Heart, MessageCircle, Search } from "lucide-react";

import { Pagination } from "~/components/pagination";
import PostCreationSidebar from "~/components/post-creation-sidebar";
import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";
import { usePagination } from "~/hooks/use-pagination";
import { formatDistanceToNow } from "~/utils/date.utils";

type PostType = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  images: string[];
  authorId: UserType;
  commentNumber: number;
  likeNumber: number;
  viewNumber: number;
  isPinned: boolean;
  createdAt: Date;
};

export default function Posts() {
  const [searchValue, setSearchValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState("latest");

  const {
    data: posts,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<PostType>({
    apiUrl: "/api/post",
    limit: 5,
    queryParams: {
      ...(searchQuery && { search: searchQuery }),
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchValue);
  };

  const handleSortChange = (sort: string) => {
    setSortOrder(sort);
    // Add sort logic here if needed
  };

  return (
    <div className="flex">
      <div className="mx-auto flex min-h-screen flex-col gap-4 px-4 py-4 sm:flex-row sm:py-6 lg:py-8 lg:pt-16">
        <PostCreationSidebar />
        <div className="flex w-full flex-col gap-6 sm:w-[500px] xl:w-[1114px]">
          {/* Header with Search and Sort */}
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex-1">
              <div className="bg-bgc-layer2 border-bd-default flex items-center gap-2 rounded-xl border px-3 py-2.5">
                <Search className="text-txt-primary h-6 w-6" />
                <input
                  type="text"
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearch(e);
                    }
                  }}
                  placeholder="Tìm kiếm"
                  className="text-txt-secondary placeholder:text-txt-secondary flex-1 border-none bg-transparent text-base font-medium outline-none"
                />
              </div>
            </form>
            {/* Sort Dropdown */}
            <div className="relative">
              <button
                onClick={() => {
                  // Toggle dropdown logic here
                }}
                className="bg-bgc-layer2 border-bd-default flex w-full items-center justify-between gap-2.5 rounded-xl border px-3 py-2.5 sm:w-60"
              >
                <span className="text-txt-primary text-base font-medium">
                  Sắp xếp theo: Mới nhất
                </span>
                <ChevronDown className="text-txt-secondary h-6 w-6" />
              </button>
            </div>
          </div>
          {/* Loading State */}
          {isLoading && (
            <div className="flex justify-center py-8">
              <div className="text-txt-secondary">Đang tải...</div>
            </div>
          )}
          {/* Error State */}
          {error && (
            <div className="flex justify-center py-8">
              <div className="text-red-500">{error}</div>
            </div>
          )}
          {/* Posts List */}
          {!isLoading && !error && (
            <div className="flex flex-col gap-5">
              {posts.map((post) => (
                <Link to={`/post/${post.id}`} key={post.id}>
                  <PostCard post={post} />
                </Link>
              ))}
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-center pt-6">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={goToPage}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: PostType }) {
  const authorImagePath = getTitleImgPath(post.authorId);
  const timeAgo = formatDistanceToNow(post.createdAt);

  return (
    <article className="border-bd-default flex flex-col gap-4 rounded-xl border bg-[radial-gradient(ellipse_100.00%_96.27%_at_50.00%_-0.00%,_rgba(25,_23,_88,_0.45)_0%,_#111128_100%)] p-4">
      {/* Header with User Info and Stats */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* User Info */}
        <div className="flex gap-4">
          {/* Avatar */}
          <img
            className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
            src={post.authorId.avatar || "/images/user-placeholder.png"}
            alt={post.authorId.name}
          />

          {/* Content */}
          <div className="min-w-0 flex-1">
            {/* User name and time */}
            <div className="mb-0.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <div className="flex items-center gap-1">
                <span className="text-txt-focus text-xs font-medium">
                  {post.authorId.name}
                </span>
                {authorImagePath && (
                  <img
                    className="h-5 w-28 object-contain"
                    src={authorImagePath}
                    alt="Cấp độ"
                  />
                )}
              </div>
              <span className="text-txt-secondary text-xs font-medium">{timeAgo}</span>
            </div>

            {/* Title */}
            <h2 className="text-txt-primary mb-1 text-base leading-normal font-medium">
              {post.title}
            </h2>

            {/* Content Preview */}
            <p className="text-txt-secondary line-clamp-2 text-sm leading-tight font-medium">
              {post.content}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-shrink-0 items-center gap-6">
          <div className="flex items-center gap-1.5">
            <MessageCircle className="text-txt-primary h-5 w-5" />
            <span className="text-txt-primary text-sm font-medium">
              {post.commentNumber || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Heart className="text-txt-primary h-5 w-5" />
            <span className="text-txt-primary text-sm font-medium">
              {post.likeNumber || 0}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Eye className="text-txt-primary h-5 w-5" />
            <span className="text-txt-primary text-sm font-medium">
              {post.viewNumber || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Image if exists */}
      {post.images && post.images.length > 0 && (
        <div className="to-bgc-layer1 h-64 w-full max-w-[550px] overflow-hidden rounded-lg bg-gradient-to-b from-transparent">
          <img
            src={post.images[0]}
            alt="Post image"
            className="h-full w-full object-cover"
          />
        </div>
      )}

      {/* Tags */}
      <div className="flex flex-wrap gap-3">
        {post.tags.map((tag, index) => (
          <span
            key={index}
            className="bg-bgc-layer-semi-purple text-txt-focus rounded-[32px] px-2 py-1.5 text-xs font-medium backdrop-blur-[3.40px]"
          >
            {tag}
          </span>
        ))}
      </div>
    </article>
  );
}
