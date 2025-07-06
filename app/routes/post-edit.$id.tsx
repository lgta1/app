import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Form, useLoaderData, useNavigate, useParams } from "react-router";
import { FileText, MessageSquare, Plus, Tag, Upload, X } from "lucide-react";

import { getPostById } from "@/queries/post.query";

import type { Route } from "./+types/post-edit.$id";

import { useFileOperations } from "~/hooks/use-file-operations";

interface Tag {
  id: string;
  name: string;
}

interface PreviewImage {
  file?: File;
  url: string;
  id: string;
  isExisting?: boolean; // để phân biệt ảnh hiện có và ảnh mới upload
}

export async function loader({ params }: Route.LoaderArgs) {
  const { id } = params;

  try {
    const post = await getPostById(id);

    if (!post) {
      throw new Response("Không tìm thấy bài viết", { status: 404 });
    }

    return post;
  } catch (error) {
    throw new Response("Có lỗi xảy ra khi tải bài viết", { status: 500 });
  }
}

export default function PostEdit() {
  const post = useLoaderData<Route.ComponentProps["loaderData"]>();
  const navigate = useNavigate();
  const params = useParams();

  const [title, setTitle] = useState(post.title || "");
  const [content, setContent] = useState(post.content || "");
  const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<PreviewImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadMultipleFiles } = useFileOperations();

  // Initialize form với dữ liệu post hiện có
  useEffect(() => {
    if (post) {
      setTitle(post.title || "");
      setContent(post.content || "");

      // Set tags
      if (post.tags && post.tags.length > 0) {
        const tags = post.tags.map((tagName: string, index: number) => ({
          id: `existing-${index}`,
          name: tagName,
        }));
        setSelectedTags(tags);
      }

      // Set existing images
      if (post.images && post.images.length > 0) {
        const existingImages = post.images.map((imageUrl: string, index: number) => ({
          url: imageUrl,
          id: `existing-${index}`,
          isExisting: true,
        }));
        setPreviewImages(existingImages);
      }
    }
  }, [post]);

  const handleRemoveTag = (tagId: string) => {
    setSelectedTags(selectedTags.filter((tag) => tag.id !== tagId));
  };

  const handleAddTag = () => {
    if (
      tagInput.trim() &&
      !selectedTags.some(
        (tag) => tag.name.toLowerCase() === tagInput.trim().toLowerCase(),
      )
    ) {
      const newTag: Tag = {
        id: Date.now().toString(),
        name: tagInput.trim(),
      };
      setSelectedTags([...selectedTags, newTag]);
      setTagInput("");
    }
  };

  const handleTagInputKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles((prev) => [...prev, ...newFiles]);

      // Create preview images for new files
      const newPreviewImages: PreviewImage[] = [];
      newFiles.forEach((file, index) => {
        const url = URL.createObjectURL(file);
        newPreviewImages.push({
          file,
          url,
          id: `new-${Date.now()}-${index}`,
          isExisting: false,
        });
      });

      setPreviewImages((prev) => [...prev, ...newPreviewImages]);
    }

    // Reset input value to allow selecting the same files again
    event.target.value = "";
  };

  const removePreviewImage = (id: string) => {
    setPreviewImages((prev) => {
      const imageToRemove = prev.find((img) => img.id === id);
      if (imageToRemove) {
        // Revoke URL chỉ cho ảnh mới upload (có file)
        if (imageToRemove.file) {
          URL.revokeObjectURL(imageToRemove.url);
          // Remove from uploadedFiles array
          setUploadedFiles((prevFiles) =>
            prevFiles.filter((file) => file !== imageToRemove.file),
          );
        }
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(0)) + sizes[i];
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!title.trim() || !content.trim()) {
      toast.error("Vui lòng điền đầy đủ tiêu đề và nội dung");
      return;
    }

    setIsSubmitting(true);

    try {
      let allImageUrls: string[] = [];

      // Lấy URLs của ảnh hiện có (không bị xóa)
      const existingImageUrls = previewImages
        .filter((img) => img.isExisting)
        .map((img) => img.url);

      allImageUrls = [...existingImageUrls];

      // Upload ảnh mới nếu có
      if (uploadedFiles.length > 0) {
        const filesToUpload = uploadedFiles.map((file) => ({
          file,
          options: {
            bucket: "post-images",
            category: "attachments",
          },
        }));

        const uploadResults = await uploadMultipleFiles(filesToUpload);
        const newImageUrls = uploadResults.map((result) => result.url);
        allImageUrls = [...allImageUrls, ...newImageUrls];
      }

      const formData = new FormData();
      formData.append("intent", "update-post");
      formData.append("postId", params.id!);
      formData.append("title", title);
      formData.append("content", content);
      formData.append("tags", JSON.stringify(selectedTags.map((tag) => tag.name)));
      formData.append("images", JSON.stringify(allImageUrls));

      const response = await fetch("/api/post", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.success) {
        toast.success(result.message || "Cập nhật bài viết thành công!");

        // Cleanup preview URLs for new images only
        previewImages
          .filter((img) => img.file)
          .forEach((img) => URL.revokeObjectURL(img.url));

        navigate(`/post/${params.id}`);
      } else {
        toast.error(result.error || "Có lỗi xảy ra khi cập nhật bài viết");
      }
    } catch (error) {
      console.error("Error updating post:", error);
      toast.error("Có lỗi xảy ra khi cập nhật bài viết");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-txt-primary font-sans text-2xl leading-9 font-semibold [text-shadow:_0px_0px_4px_rgb(182_25_255_/_0.59)] sm:text-3xl">
            Chỉnh sửa thảo luận
          </h1>
        </div>

        {/* Main Form */}
        <Form onSubmit={handleSubmit}>
          <div className="border-bd-default rounded-xl border p-4 shadow-[0px_4px_4px_0px_rgba(0,0,0,0.25)] sm:p-6">
            <div className="space-y-6">
              {/* Title Field */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-1.5 sm:w-[170px] sm:flex-shrink-0">
                  <FileText className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base leading-normal font-semibold">
                    Tiêu đề
                  </label>
                </div>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Viết hoa ký tự đầu tiên mỗi từ"
                    maxLength={100}
                    required
                    className="bg-bgc-layer2 border-bd-default text-txt-primary placeholder-txt-secondary focus:border-txt-focus w-full rounded-xl border px-3 py-2.5 font-sans text-base leading-normal font-medium focus:outline-none"
                  />
                  <div className="text-txt-secondary absolute top-2.5 right-3 font-sans text-base leading-normal font-medium">
                    {title.length}/100
                  </div>
                </div>
              </div>

              {/* Content Field */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-1.5 sm:w-[170px] sm:flex-shrink-0 sm:pt-2">
                  <MessageSquare className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base leading-normal font-semibold">
                    Nội dung
                  </label>
                </div>

                <div className="flex-1">
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Nhập nội dung tại đây"
                    rows={8}
                    required
                    className="bg-bgc-layer2 border-bd-default text-txt-primary placeholder-txt-secondary focus:border-txt-focus w-full resize-none rounded-xl border px-3 py-2.5 font-sans text-base leading-normal font-medium focus:outline-none"
                  />
                </div>
              </div>

              {/* Tags Field */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-1.5 sm:w-[170px] sm:flex-shrink-0 sm:pt-2">
                  <Tag className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base leading-normal font-semibold">
                    Tag
                  </label>
                </div>

                <div className="flex-1 space-y-3">
                  {/* Tag Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyPress={handleTagInputKeyPress}
                      placeholder="Nhập tag và nhấn Enter"
                      className="bg-bgc-layer2 border-bd-default text-txt-primary placeholder-txt-secondary focus:border-txt-focus flex-1 rounded-xl border px-3 py-2.5 font-sans text-base leading-normal font-medium focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!tagInput.trim()}
                      className="from-lav-500 to-lav-600 flex items-center gap-1.5 rounded-xl bg-gradient-to-b px-4 py-2.5 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4 text-black" />
                      <span className="font-sans text-sm leading-tight font-semibold text-black">
                        Thêm
                      </span>
                    </button>
                  </div>

                  {/* Selected Tags */}
                  {selectedTags.length > 0 && (
                    <div className="bg-bgc-layer2 border-bd-default flex min-h-[44px] flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                      {selectedTags.map((tag) => (
                        <div
                          key={tag.id}
                          className="bg-bgc-layer-semi-purple flex items-center gap-2 rounded-[32px] px-2 py-1.5 backdrop-blur-[3.40px]"
                        >
                          <span className="text-txt-focus font-sans text-xs leading-none font-medium">
                            {tag.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag.id)}
                            className="text-txt-focus hover:text-txt-primary transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* File Upload Field */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex items-start gap-1.5 sm:w-[170px] sm:flex-shrink-0 sm:pt-2">
                  <Upload className="text-txt-secondary h-4 w-4" />
                  <label className="text-txt-primary font-sans text-base leading-normal font-semibold">
                    Ảnh đính kèm
                  </label>
                </div>

                <div className="flex-1">
                  <div className="relative flex flex-col gap-2">
                    <div className="bg-bgc-layer2 border-bd-default relative flex h-32 w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-3 py-2.5">
                      {/* Hidden file input */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />

                      {/* Upload Button and Text */}
                      <div className="flex flex-col items-center gap-3">
                        <button
                          type="button"
                          onClick={triggerFileInput}
                          className="from-lav-500 to-lav-600 flex items-center gap-1.5 rounded-xl bg-gradient-to-b px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-opacity hover:opacity-90"
                        >
                          <Upload className="h-5 w-5 text-black" />
                          <span className="font-sans text-sm leading-tight font-semibold text-black">
                            {previewImages.length > 0 ? "Thêm ảnh" : "Tải ảnh lên"}
                          </span>
                        </button>
                        <div className="text-txt-primary text-center font-sans text-sm leading-tight font-medium">
                          Click để{" "}
                          {previewImages.length > 0 ? "thêm ảnh mới" : "tải ảnh lên"}
                        </div>
                      </div>
                    </div>

                    <div className="text-txt-secondary font-sans text-sm leading-tight font-medium">
                      Kích thước ảnh lớn nhất 2000 x 8000 pixel, văn bản không vượt quá
                      10MB.
                    </div>

                    {/* Preview Images */}
                    {previewImages.length > 0 && (
                      <div className="mt-4 w-full">
                        <div className="flex flex-wrap gap-4">
                          {previewImages.map((image) => (
                            <div key={image.id} className="group relative">
                              <div className="border-bd-default h-32 w-32 overflow-hidden rounded-lg border">
                                <img
                                  src={image.url}
                                  alt="Preview"
                                  className="h-full w-full object-cover object-top"
                                />
                              </div>

                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => removePreviewImage(image.id)}
                                className="absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-gray-600 bg-gray-800 transition-colors hover:bg-gray-700"
                              >
                                <X className="text-txt-primary h-4 w-4" />
                              </button>

                              {/* File size hoặc existing label */}
                              <div className="text-txt-primary absolute bottom-1 left-1 rounded bg-black/70 px-2 py-1 text-xs">
                                {image.file ? formatFileSize(image.file.size) : "Hiện có"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/post/${params.id}`)}
              className="bg-bgc-layer2 border-bd-default text-txt-primary hover:bg-bgc-layer2/80 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border px-4 py-3 transition-colors sm:w-52"
            >
              <span className="font-sans text-sm leading-tight font-semibold">Hủy</span>
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="from-lav-500 to-lav-600 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl bg-gradient-to-b px-4 py-3 shadow-[0px_4px_8.899999618530273px_0px_rgba(196,69,255,0.25)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 sm:w-52"
            >
              <span className="font-sans text-sm leading-tight font-semibold text-black">
                {isSubmitting ? "Đang cập nhật..." : "Cập nhật"}
              </span>
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
