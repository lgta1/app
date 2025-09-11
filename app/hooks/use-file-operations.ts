import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useFetcher, useSubmit } from "react-router-dom";

import { BusinessError } from "~/helpers/errors.helper";

interface UploadFileOptions {
  prefixPath?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface DeleteFileOptions {
  prefixPath?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

interface DeleteFilesOptions {
  prefixPath?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useFileOperations() {
  const submit = useSubmit();
  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();

  // Use refs to store callbacks
  const uploadCallbacksRef = useRef<UploadFileOptions | null>(null);
  const deleteCallbacksRef = useRef<DeleteFileOptions | null>(null);

  // Handle upload response
  useEffect(() => {
    if (uploadFetcher.data && uploadFetcher.state === "idle") {
      if (uploadFetcher.data.success) {
        toast.success(uploadFetcher.data.message || "Tải file lên thành công!");
        // Execute success callback
        uploadCallbacksRef.current?.onSuccess?.(uploadFetcher.data.data);
      } else {
        toast.error(uploadFetcher.data.error || "Có lỗi xảy ra khi tải file lên");
        // Execute error callback
        uploadCallbacksRef.current?.onError?.(uploadFetcher.data.error);
      }
      // Clear callbacks after execution
      uploadCallbacksRef.current = null;
    }
  }, [uploadFetcher.data, uploadFetcher.state]);

  // Handle delete response
  useEffect(() => {
    if (deleteFetcher.data && deleteFetcher.state === "idle") {
      if (deleteFetcher.data.success) {
        toast.success(deleteFetcher.data.message || "Xóa file thành công!");
        // Execute success callback
        deleteCallbacksRef.current?.onSuccess?.(deleteFetcher.data.data);
      } else {
        toast.error(deleteFetcher.data.error || "Có lỗi xảy ra khi xóa file");
        // Execute error callback
        deleteCallbacksRef.current?.onError?.(deleteFetcher.data.error);
      }
      // Clear callbacks after execution
      deleteCallbacksRef.current = null;
    }
  }, [deleteFetcher.data, deleteFetcher.state]);

  // Upload single file with navigation
  const uploadFile = useCallback(
    (file: File, options: UploadFileOptions = {}) => {
      const formData = new FormData();
      formData.append("file", file);

      if (options.prefixPath) {
        formData.append("prefixPath", options.prefixPath);
      }

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

      if (options.prefixPath) {
        formData.append("prefixPath", options.prefixPath);
      }

      // Store callbacks before submitting
      uploadCallbacksRef.current = options;

      uploadFetcher.submit(formData, {
        action: "/api/files/upload",
        method: "post",
        encType: "multipart/form-data",
      });
    },
    [uploadFetcher],
  );

  // Delete single file
  const deleteFile = useCallback(
    (objectName: string, options: DeleteFileOptions = {}) => {
      const formData = new FormData();
      formData.append("objectName", objectName);

      if (options.prefixPath) {
        formData.append("prefixPath", options.prefixPath);
      }

      // Store callbacks before submitting
      deleteCallbacksRef.current = options;

      deleteFetcher.submit(formData, {
        action: "/api/files/delete",
        method: "post",
      });
    },
    [deleteFetcher],
  );

  // Delete multiple files
  const deleteFiles = useCallback(
    (objectNames: string[], options: DeleteFilesOptions = {}) => {
      const formData = new FormData();
      formData.append("objectNames", JSON.stringify(objectNames));

      if (options.prefixPath) {
        formData.append("prefixPath", options.prefixPath);
      }

      // Store callbacks before submitting
      deleteCallbacksRef.current = options;

      deleteFetcher.submit(formData, {
        action: "/api/files/delete",
        method: "post",
      });
    },
    [deleteFetcher],
  );

  // Direct download file
  const downloadFile = useCallback(async (objectName: string, prefixPath?: string) => {
    try {
      const searchParams = new URLSearchParams({
        objectName,
        download: "true",
      });

      if (prefixPath) {
        searchParams.append("prefixPath", prefixPath);
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

  // Upload multiple files
  const uploadMultipleFiles = useCallback(
    async (uploads: Array<{ file: File; options: UploadFileOptions }>) => {
      try {
        // Create upload promises for parallel execution
        const uploadPromises = uploads.map(async ({ file, options }) => {
          const formData = new FormData();
          formData.append("file", file);

          if (options.prefixPath) {
            formData.append("prefixPath", options.prefixPath);
          }

          const response = await fetch("/api/files/upload", {
            method: "POST",
            body: formData,
          });

          const result = await response.json();

          if (!response.ok || !result.success) {
            throw new BusinessError(result.error || "Tải file lên thất bại");
          }

          // Execute individual success callback if provided
          options.onSuccess?.(result.data);

          return result.data;
        });

        // Wait for all uploads to complete
        const results = await Promise.all(uploadPromises);

        toast.success(`Upload ${results.length} file thành công!`);
        return results;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Có lỗi xảy ra khi upload file";
        toast.error(errorMessage);

        // Execute error callbacks if provided
        uploads.forEach(({ options }) => {
          options.onError?.(errorMessage);
        });

        throw error;
      }
    },
    [],
  );

  return {
    uploadFile,
    uploadFileWithFetcher,
    deleteFile,
    deleteFiles,
    downloadFile,
    uploadMultipleFiles,
    isUploading: uploadFetcher.state === "submitting",
    isDeleting: deleteFetcher.state === "submitting",
    isLoading: uploadFetcher.state === "loading" || deleteFetcher.state === "loading",
  };
}
