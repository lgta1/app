import { useCallback, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useFetcher, useSubmit } from "react-router-dom";

import { BusinessError } from "~/helpers/errors.helper";

interface UploadFileOptions {
  prefixPath?: string;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  watermark?: boolean;
  watermarkVariant?: 1 | 2;
  watermarkStyle?: "glow" | "stroke";
}

interface UploadedFileResult {
  objectName: string;
  fullPath: string;
  url: string;
  prefixPath?: string;
  size?: number;
  type?: string;
  originalName?: string;
  sanitizedName?: string;
  isRenamed?: boolean;
  isPublic?: boolean;
}

interface UploadSession {
  promise: Promise<UploadedFileResult[]>;
  cancel: () => void;
  getUploadedResults: () => UploadedFileResult[];
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

const isAbortError = (error: unknown): boolean => {
  return error instanceof DOMException && error.name === "AbortError";
};

export function useFileOperations() {
  const submit = useSubmit();
  const uploadFetcher = useFetcher();
  const deleteFetcher = useFetcher();
  const MAX_UPLOAD_CONCURRENCY = 4;

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

      if (options.watermark) {
        formData.append("watermark", "true");

        if (options.watermarkVariant) {
          formData.append("watermarkVariant", String(options.watermarkVariant));
        }

        if (options.watermarkStyle) {
          formData.append("watermarkStyle", options.watermarkStyle);
        }
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

      if (options.watermark) {
        formData.append("watermark", "true");

        if (options.watermarkVariant) {
          formData.append("watermarkVariant", String(options.watermarkVariant));
        }

        if (options.watermarkStyle) {
          formData.append("watermarkStyle", options.watermarkStyle);
        }
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
    async (
      uploads: Array<{ file: File; options: UploadFileOptions }>,
      onProgress?: (done: number, total: number) => void,
    ) => {
      try {
        let completed = 0;
        const total = uploads.length;
        if (onProgress) onProgress(0, total);
        const results: UploadedFileResult[] = new Array(total);
        let inFlight = 0;
        let nextIndex = 0;

        const runNext = async (): Promise<void> => {
          if (nextIndex >= uploads.length) return;
          const currentIndex = nextIndex;
          nextIndex += 1;
          inFlight += 1;

          const { file, options } = uploads[currentIndex];
          const formData = new FormData();
          formData.append("file", file);

          if (options.prefixPath) {
            formData.append("prefixPath", options.prefixPath);
          }

          if (options.watermark) {
            formData.append("watermark", "true");

            if (options.watermarkVariant) {
              formData.append("watermarkVariant", String(options.watermarkVariant));
            }
          }

          const response = await fetch("/api/files/upload", {
            method: "POST",
            body: formData,
            credentials: "include",
            headers: { "X-Requested-With": "fetch" },
          });

          const rawText = await response.text();
          let result: any = null;
          try {
            result = rawText ? JSON.parse(rawText) : null;
          } catch {
            throw new BusinessError(`Phản hồi không hợp lệ (HTTP ${response.status})`);
          }

          if (!response.ok || !result?.success) {
            throw new BusinessError(result?.error || `Tải file lên thất bại (HTTP ${response.status})`);
          }

          options.onSuccess?.(result.data);

          completed += 1;
          if (onProgress) onProgress(completed, total);

          results[currentIndex] = result.data as UploadedFileResult;
          inFlight -= 1;

          if (nextIndex < uploads.length) {
            await runNext();
          }
        };

        const starters = Array.from(
          { length: Math.min(MAX_UPLOAD_CONCURRENCY, uploads.length) },
          () => runNext(),
        );

        await Promise.all(starters);

        toast.success(`Upload ${results.length} file thành công!`);
        if (onProgress) onProgress(total, total);
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

  const uploadMultipleFilesCancelable = useCallback(
    (
      uploads: Array<{ file: File; options: UploadFileOptions }>,
      onProgress?: (done: number, total: number) => void,
    ): UploadSession => {
      const controllers = uploads.map(() => new AbortController());
      const uploadedResults: UploadedFileResult[] = [];
      let completed = 0;
      const total = uploads.length;
      let canceled = false;
      let stopped = false;

      if (onProgress) onProgress(0, total);

      const promise = (async () => {
        try {
          const results: UploadedFileResult[] = new Array(total);
          let inFlight = 0;
          let nextIndex = 0;

          const runNext = async (): Promise<void> => {
            if (stopped || canceled || nextIndex >= uploads.length) return;
            const currentIndex = nextIndex;
            nextIndex += 1;
            inFlight += 1;

            const { file, options } = uploads[currentIndex];
            const formData = new FormData();
            formData.append("file", file);

            if (options.prefixPath) {
              formData.append("prefixPath", options.prefixPath);
            }

            if (options.watermark) {
              formData.append("watermark", "true");

              if (options.watermarkVariant) {
                formData.append("watermarkVariant", String(options.watermarkVariant));
              }

              if (options.watermarkStyle) {
                formData.append("watermarkStyle", options.watermarkStyle);
              }
            }

            const response = await fetch("/api/files/upload", {
              method: "POST",
              body: formData,
              signal: controllers[currentIndex].signal,
              credentials: "include",
              headers: { "X-Requested-With": "fetch" },
            });

            const rawText = await response.text();
            let result: any = null;
            try {
              result = rawText ? JSON.parse(rawText) : null;
            } catch {
              throw new BusinessError(`Phản hồi không hợp lệ (HTTP ${response.status})`);
            }

            if (!response.ok || !result?.success) {
              throw new BusinessError(result?.error || `Tải file lên thất bại (HTTP ${response.status})`);
            }

            uploadedResults.push(result.data as UploadedFileResult);
            options.onSuccess?.(result.data);

            completed += 1;
            if (onProgress) onProgress(completed, total);

            results[currentIndex] = result.data as UploadedFileResult;
            inFlight -= 1;

            if (nextIndex < uploads.length) {
              await runNext();
            }
          };

          const starters = Array.from(
            { length: Math.min(MAX_UPLOAD_CONCURRENCY, uploads.length) },
            () => runNext(),
          );
          await Promise.all(starters);

          if (!canceled) {
            toast.success(`Upload ${results.length} file thành công!`);
            if (onProgress) onProgress(total, total);
          }

          return results;
        } catch (error) {
          stopped = true;
          if (isAbortError(error) || canceled) {
            throw new DOMException("Upload canceled", "AbortError");
          }

          const errorMessage =
            error instanceof Error ? error.message : "Có lỗi xảy ra khi upload file";
          toast.error(errorMessage);
          uploads.forEach(({ options }) => {
            options.onError?.(errorMessage);
          });
          throw error;
        }
      })();

      const cancel = () => {
        if (canceled) return;
        canceled = true;
        controllers.forEach((controller) => controller.abort());
      };

      return {
        promise,
        cancel,
        getUploadedResults: () => [...uploadedResults],
      };
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
    uploadMultipleFilesCancelable,
    isUploading: uploadFetcher.state === "submitting",
    isDeleting: deleteFetcher.state === "submitting",
    isLoading: uploadFetcher.state === "loading" || deleteFetcher.state === "loading",
  };
}
