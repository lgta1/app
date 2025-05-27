import { useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { useFetcher, useSubmit } from "react-router";

interface UploadFileOptions {
  bucket?: string;
  category?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface DeleteFileOptions {
  bucket?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface DeleteFilesOptions {
  bucket?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useFileOperations() {
  const submit = useSubmit();
  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  // Handle upload response
  useEffect(() => {
    if (uploadFetcher.data && uploadFetcher.state === "idle") {
      if (uploadFetcher.data.success) {
        toast.success(uploadFetcher.data.message || "Tải file lên thành công!");
      } else {
        toast.error(uploadFetcher.data.error || "Có lỗi xảy ra khi tải file lên");
      }
    }
  }, [uploadFetcher.data, uploadFetcher.state]);

  // Handle delete response
  useEffect(() => {
    if (deleteFetcher.data && deleteFetcher.state === "idle") {
      if (deleteFetcher.data.success) {
        toast.success(deleteFetcher.data.message || "Xóa file thành công!");
      } else {
        toast.error(deleteFetcher.data.error || "Có lỗi xảy ra khi xóa file");
      }
    }
  }, [deleteFetcher.data, deleteFetcher.state]);

  // Upload single file with navigation
  const uploadFile = useCallback(
    (file: File, options: UploadFileOptions = {}) => {
      const formData = new FormData();
      formData.append("file", file);

      if (options.bucket) {
        formData.append("bucket", options.bucket);
      }

      if (options.category) {
        formData.append("category", options.category);
      }

      // Show loading toast
      toast.loading("Đang tải file lên...");

      submit(formData, {
        action: "/api/files/upload",
        method: "post",
        encType: "multipart/form-data",
      });
    },
    [submit],
  );

  // Upload file without navigation using fetcher
  const uploadFileWithFetcher = useCallback(
    (file: File, options: UploadFileOptions = {}) => {
      const formData = new FormData();
      formData.append("file", file);

      if (options.bucket) {
        formData.append("bucket", options.bucket);
      }

      if (options.category) {
        formData.append("category", options.category);
      }

      // Show loading toast
      toast.loading("Đang tải file lên...");

      uploadFetcher.submit(formData, {
        action: "/api/files/upload",
        method: "post",
        encType: "multipart/form-data",
      });

      // Store callbacks for later use
      if (options.onSuccess || options.onError) {
        // We'll handle this in the useEffect
        (uploadFetcher as any)._callbacks = options;
      }
    },
    [uploadFetcher],
  );

  // Delete single file
  const deleteFile = useCallback(
    (objectName: string, options: DeleteFileOptions = {}) => {
      const formData = new FormData();
      formData.append("objectName", objectName);

      if (options.bucket) {
        formData.append("bucket", options.bucket);
      }

      // Show loading toast
      toast.loading("Đang xóa file...");

      deleteFetcher.submit(formData, {
        action: "/api/files/delete",
        method: "post",
      });

      // Store callbacks for later use
      if (options.onSuccess || options.onError) {
        (deleteFetcher as any)._callbacks = options;
      }
    },
    [deleteFetcher],
  );

  // Delete multiple files
  const deleteFiles = useCallback(
    (objectNames: string[], options: DeleteFilesOptions = {}) => {
      const formData = new FormData();
      formData.append("objectNames", JSON.stringify(objectNames));

      if (options.bucket) {
        formData.append("bucket", options.bucket);
      }

      // Show loading toast
      toast.loading(`Đang xóa ${objectNames.length} file(s)...`);

      deleteFetcher.submit(formData, {
        action: "/api/files/delete",
        method: "post",
      });

      // Store callbacks for later use
      if (options.onSuccess || options.onError) {
        (deleteFetcher as any)._callbacks = options;
      }
    },
    [deleteFetcher],
  );

  // Get download URL
  const getDownloadUrl = useCallback(
    async (objectName: string, bucket?: string, expires?: number) => {
      try {
        const searchParams = new URLSearchParams({
          objectName,
        });

        if (bucket) {
          searchParams.append("bucket", bucket);
        }

        if (expires) {
          searchParams.append("expires", expires.toString());
        }

        const response = await fetch(`/api/files/download?${searchParams.toString()}`);
        const result = await response.json();

        if (result.success) {
          return result.data.downloadUrl;
        } else {
          toast.error(result.error || "Không thể tạo link tải về");
          throw new Error(result.error);
        }
      } catch (error) {
        toast.error("Có lỗi xảy ra khi tạo link tải về");
        throw error;
      }
    },
    [],
  );

  // Direct download file
  const downloadFile = useCallback(async (objectName: string, bucket?: string) => {
    try {
      const searchParams = new URLSearchParams({
        objectName,
        download: "true",
      });

      if (bucket) {
        searchParams.append("bucket", bucket);
      }

      // Show loading toast
      const loadingToastId = toast.loading("Đang tải file...");

      const response = await fetch(`/api/files/download?${searchParams.toString()}`);

      toast.dismiss(loadingToastId);

      if (response.ok) {
        // Create download link
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = objectName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast.success("Tải file thành công!");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Có lỗi xảy ra khi tải file");
      }
    } catch (error) {
      toast.error("Có lỗi xảy ra khi tải file");
      throw error;
    }
  }, []);

  // Execute callbacks when fetcher completes
  useEffect(() => {
    if (uploadFetcher.data && uploadFetcher.state === "idle") {
      const callbacks = (uploadFetcher as any)._callbacks;
      if (callbacks) {
        if (uploadFetcher.data.success) {
          callbacks.onSuccess?.(uploadFetcher.data.data);
        } else {
          callbacks.onError?.(uploadFetcher.data.error);
        }
        // Clear callbacks
        delete (uploadFetcher as any)._callbacks;
      }
    }
  }, [uploadFetcher.data, uploadFetcher.state]);

  useEffect(() => {
    if (deleteFetcher.data && deleteFetcher.state === "idle") {
      const callbacks = (deleteFetcher as any)._callbacks;
      if (callbacks) {
        if (deleteFetcher.data.success) {
          callbacks.onSuccess?.(deleteFetcher.data.data);
        } else {
          callbacks.onError?.(deleteFetcher.data.error);
        }
        // Clear callbacks
        delete (deleteFetcher as any)._callbacks;
      }
    }
  }, [deleteFetcher.data, deleteFetcher.state]);

  return {
    uploadFile,
    uploadFileWithFetcher,
    deleteFile,
    deleteFiles,
    getDownloadUrl,
    downloadFile,
    isUploading: uploadFetcher.state === "submitting",
    isDeleting: deleteFetcher.state === "submitting",
    isLoading: uploadFetcher.state === "loading" || deleteFetcher.state === "loading",
  };
}
