import { useState } from "react";
import { Toaster } from "react-hot-toast";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { Check, CircleUserRound, Edit, Heart, MessageCircle, Share2 } from "lucide-react";

import { getUserInfoFromSession } from "@/services/session.svc";

import { likePost } from "~/.server/mutations/post.mutation";
import { getPostByIdWithLikeStatus } from "~/.server/queries/post.query";
import CommentDetail from "~/components/comment-detail";
import PostCreationSidebar from "~/components/post-creation-sidebar";
import type { UserType } from "~/database/models/user.model";
import { getTitleImgPath } from "~/helpers/user.helper";
import { isAdmin } from "~/helpers/user.helper";
import { formatDistanceToNow } from "~/utils/date.utils";

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { id } = params;

  if (!id) {
    throw new Response("Post ID is required", { status: 400 });
  }

  const currentUser = await getUserInfoFromSession(request);
  const post = await getPostByIdWithLikeStatus(id, currentUser?.id);

  if (!post) {
    throw new Response("Post not found", { status: 404 });
  }

  return {
    post,
    currentUser,
    isLoggedIn: !!currentUser,
    isAdmin: isAdmin(currentUser?.role ?? ""),
  };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { id } = params;

  if (!id) {
    throw new Response("Post ID is required", { status: 400 });
  }

  const currentUser = await getUserInfoFromSession(request);

  if (!currentUser) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "like") {
    const result = await likePost(id, currentUser.id);
    return result;
  }

  throw new Response("Invalid action", { status: 400 });
};

export default function PostDetail() {
  const { post, currentUser, isLoggedIn, isAdmin } = useLoaderData<typeof loader>();
  const [isShared, setIsShared] = useState(false);
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const author = post.authorId as unknown as UserType;

  const handleShare = async () => {
    try {
      const currentUrl = window.location.href;
      await navigator.clipboard.writeText(currentUrl);

      setIsShared(true);
      setTimeout(() => {
        setIsShared(false);
      }, 2000);
    } catch (error) {
      console.error("Failed to copy URL to clipboard:", error);
    }
  };

  const handleEdit = () => {
    navigate(`/post-edit/${post.id}`);
  };

  // Calculate current like count based on fetcher result
  const currentLikeNumber = fetcher.data?.likeNumber ?? post.likeNumber;
  const isLiked = fetcher.data?.isLiked ?? post.isLiked;
  const isLiking = fetcher.state === "submitting";

  return (
    <div className="flex">
      <Toaster position="bottom-right" />
      <div className="mx-auto flex min-h-screen gap-4 px-4 py-4 sm:py-6 lg:py-8 lg:pt-16">
        <PostCreationSidebar className="hidden sm:flex" />

        <div className="w-full sm:w-[500px] xl:w-4xl">
          <div className="relative w-full">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
              <div className="flex items-start justify-between">
                <div className="flex items-start justify-start gap-3 sm:gap-4">
                  {/* Avatar */}
                  {author.avatar ? (
                    <img
                      className="h-10 w-10 flex-shrink-0 rounded-full object-cover sm:h-11 sm:w-11"
                      src={author.avatar}
                      alt={author.name}
                    />
                  ) : (
                    <CircleUserRound className="h-10 w-10 flex-shrink-0 rounded-full object-cover sm:h-11 sm:w-11" />
                  )}

                  {/* User Info & Title */}
                  <div className="flex flex-1 flex-col items-start justify-start gap-0.5">
                    <div className="flex flex-wrap items-center justify-start gap-2 sm:gap-4">
                      <div className="flex items-center justify-start gap-1">
                        <div className="text-txt-focus font-sans text-xs leading-none font-medium">
                          {author.name}
                        </div>
                        <img src={getTitleImgPath(author)} alt="Title" className="h-4" />
                      </div>
                      <div className="text-txt-secondary font-sans text-xs leading-none font-medium">
                        {formatDistanceToNow(post.createdAt)}
                      </div>
                    </div>

                    {/* Post Title */}
                    <h1 className="text-txt-primary w-full font-sans text-lg leading-6 font-semibold sm:text-xl sm:leading-7">
                      {post.title}
                    </h1>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="text-txt-primary font-sans text-sm leading-tight font-medium whitespace-pre-wrap">
                {post.content}
              </div>
            </div>

            {/* Image Section */}
            {post.images && post.images.length > 0 && (
              <div className="mt-6">
                <div className="flex flex-col flex-wrap gap-4 sm:flex-row">
                  {post.images.map((image, index) => (
                    <div key={index} className="w-full sm:w-[48%] sm:max-w-[48%]">
                      <img
                        className="h-auto w-full rounded-lg"
                        src={image || "https://placehold.co/478x481"}
                        alt={`Post image ${index + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tags Section */}
            <div className="mt-6 flex flex-wrap items-start justify-start gap-3">
              {post.tags &&
                post.tags.length > 0 &&
                post.tags.map((tag, index) => (
                  <div
                    key={index}
                    className="bg-bgc-layer-semi-purple flex items-center justify-center gap-2.5 rounded-[32px] px-2 py-1.5 backdrop-blur-[3.40px]"
                  >
                    <div className="text-txt-focus font-sans text-xs leading-none font-medium">
                      {tag}
                    </div>
                  </div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:mt-6 sm:flex-row sm:gap-0">
              <div className="flex flex-wrap items-center justify-start gap-1.5 sm:gap-2">
                {/* Comment Button */}
                <button className="bg-bgc-layer2 hover:bg-opacity-80 flex items-center justify-center gap-1 rounded-[32px] px-3 py-1.5 transition-colors sm:gap-1.5 sm:px-4">
                  <MessageCircle className="text-txt-primary h-4 w-4 sm:h-5 sm:w-5" />
                  <div className="text-txt-primary font-sans text-xs leading-tight font-medium sm:text-sm">
                    {post.commentNumber || 0}
                  </div>
                </button>

                {/* Like Button */}
                {currentUser ? (
                  <fetcher.Form method="post" className="inline">
                    <input type="hidden" name="actionType" value="like" />
                    <button
                      type="submit"
                      disabled={isLiking}
                      className={`${
                        isLiked
                          ? "bg-txt-focus hover:bg-txt-focus/80"
                          : "bg-bgc-layer2 hover:bg-opacity-80"
                      } flex cursor-pointer items-center justify-center gap-1 rounded-[32px] px-3 py-1.5 transition-colors disabled:opacity-50 sm:gap-1.5 sm:px-4`}
                    >
                      <Heart
                        className={`${
                          isLiked ? "fill-white text-white" : "text-txt-primary"
                        } h-4 w-4 sm:h-5 sm:w-5`}
                      />
                      <div
                        className={`${
                          isLiked ? "text-white" : "text-txt-primary"
                        } font-sans text-xs leading-tight font-medium sm:text-sm`}
                      >
                        {currentLikeNumber || 0}
                      </div>
                    </button>
                  </fetcher.Form>
                ) : (
                  <button className="bg-bgc-layer2 hover:bg-opacity-80 flex items-center justify-center gap-1 rounded-[32px] px-3 py-1.5 transition-colors sm:gap-1.5 sm:px-4">
                    <Heart className="text-txt-primary h-4 w-4 sm:h-5 sm:w-5" />
                    <div className="text-txt-primary font-sans text-xs leading-tight font-medium sm:text-sm">
                      {post.likeNumber || 0}
                    </div>
                  </button>
                )}

                {/* Share Button */}
                <button
                  onClick={handleShare}
                  className={`${
                    isShared
                      ? "scale-105 bg-green-500"
                      : "bg-bgc-layer2 hover:bg-opacity-80"
                  } flex cursor-pointer items-center justify-center gap-1 rounded-[32px] px-3 py-1.5 transition-all duration-300 ease-in-out sm:gap-1.5 sm:px-4`}
                >
                  {isShared ? (
                    <Check className="h-4 w-4 text-white sm:h-5 sm:w-5" />
                  ) : (
                    <Share2 className="text-txt-primary h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                  <div
                    className={`${
                      isShared ? "text-white" : "text-txt-primary"
                    } font-sans text-xs leading-tight font-medium sm:text-sm`}
                  >
                    {isShared ? "Đã copy!" : "Chia sẻ"}
                  </div>
                </button>

                {/* Edit Button - Only show if current user is author */}
                {currentUser && currentUser.id === author.id && (
                  <button
                    onClick={handleEdit}
                    className="bg-bgc-layer2 hover:bg-opacity-80 flex cursor-pointer items-center justify-center gap-1 rounded-[32px] px-3 py-1.5 transition-colors sm:gap-1.5 sm:px-4"
                  >
                    <Edit className="text-txt-primary h-4 w-4 sm:h-5 sm:w-5" />
                    <div className="text-txt-primary font-sans text-xs leading-tight font-medium sm:text-sm">
                      Sửa
                    </div>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-8">
            <CommentDetail postId={post.id} isLoggedIn={isLoggedIn} isAdmin={isAdmin} />
          </div>
        </div>
      </div>
    </div>
  );
}
