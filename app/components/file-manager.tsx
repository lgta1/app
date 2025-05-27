import { useEffect, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useFetcher } from "react-router";

import { useFileOperations } from "~/hooks/use-file-operations";

interface FileInfo {
  name: string;
  size: number;
  lastModified: string;
  bucket: string;
  url?: string;
  contentType?: string;
}

interface FileManagerProps {
  bucket?: string;
  category?: string;
  allowMultiple?: boolean;
  maxFileSize?: number; // in MB
  allowedTypes?: string[];
}

export function FileManager({
  bucket = "uploads",
  category = "general",
  allowMultiple = true,
  maxFileSize = 10,
  allowedTypes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "text/plain",
  ],
}: FileManagerProps) {
  const {
    uploadFileWithFetcher,
    deleteFile,
    deleteFiles,
    downloadFile,
    isUploading,
    isDeleting,
  } = useFileOperations();

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listFetcher = useFetcher<{ success: boolean; data: FileInfo[] }>();

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [bucket]);

  // Handle fetcher response for file list
  useEffect(() => {
    if (listFetcher.data?.success) {
      setFiles(listFetcher.data.data);
    }
  }, [listFetcher.data]);

  const loadFiles = () => {
    const searchParams = new URLSearchParams({ bucket });
    listFetcher.load(`/api/files/list?${searchParams.toString()}`);
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);

    if (selectedFiles.length === 0) return;

    if (!allowMultiple && selectedFiles.length > 1) {
      toast.error("Chỉ được chọn một file");
      return;
    }

    selectedFiles.forEach((file) => {
      // Validate file size
      if (file.size > maxFileSize * 1024 * 1024) {
        toast.error(`File "${file.name}" quá lớn. Kích thước tối đa: ${maxFileSize}MB`);
        return;
      }

      // Validate file type
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        toast.error(`File "${file.name}" không được hỗ trợ`);
        return;
      }

      // Upload file
      uploadFileWithFetcher(file, {
        bucket,
        category,
        onSuccess: () => {
          loadFiles(); // Reload file list
        },
      });
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);

    const droppedFiles = Array.from(event.dataTransfer.files);

    if (!allowMultiple && droppedFiles.length > 1) {
      toast.error("Chỉ được thả một file");
      return;
    }

    droppedFiles.forEach((file) => {
      // Validate file size
      if (file.size > maxFileSize * 1024 * 1024) {
        toast.error(`File "${file.name}" quá lớn. Kích thước tối đa: ${maxFileSize}MB`);
        return;
      }

      // Validate file type
      if (allowedTypes && !allowedTypes.includes(file.type)) {
        toast.error(`File "${file.name}" không được hỗ trợ`);
        return;
      }

      // Upload file
      uploadFileWithFetcher(file, {
        bucket,
        category,
        onSuccess: () => {
          loadFiles(); // Reload file list
        },
      });
    });
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleFileDelete = (fileName: string) => {
    deleteFile(fileName, {
      bucket,
      onSuccess: () => {
        loadFiles(); // Reload file list
        setSelectedFiles((prev) => prev.filter((f) => f !== fileName));
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedFiles.length === 0) {
      toast.error("Chưa chọn file nào để xóa");
      return;
    }

    deleteFiles(selectedFiles, {
      bucket,
      onSuccess: () => {
        loadFiles(); // Reload file list
        setSelectedFiles([]);
      },
    });
  };

  const handleFileDownload = (fileName: string) => {
    downloadFile(fileName, bucket);
  };

  const toggleFileSelection = (fileName: string) => {
    setSelectedFiles((prev) => {
      if (prev.includes(fileName)) {
        return prev.filter((f) => f !== fileName);
      } else {
        return [...prev, fileName];
      }
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="mx-auto w-full max-w-4xl p-6">
      <Toaster position="top-right" />

      {/* Upload Area */}
      <div
        className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${isUploading ? "pointer-events-none opacity-50" : ""} `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <div className="space-y-4">
          <div className="text-gray-600">
            <p>Kéo thả file vào đây hoặc</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="font-medium text-blue-500 hover:text-blue-600"
              disabled={isUploading}
            >
              chọn file từ máy tính
            </button>
          </div>

          <div className="text-sm text-gray-500">
            <p>Kích thước tối đa: {maxFileSize}MB</p>
            <p>
              Định dạng hỗ trợ:{" "}
              {allowedTypes?.map((type) => type.split("/")[1]).join(", ")}
            </p>
          </div>

          {isUploading && (
            <div className="text-blue-500">
              <p>Đang tải file lên...</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple={allowMultiple}
          accept={allowedTypes?.join(",")}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      {/* File List Controls */}
      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-lg font-medium">Files ({files.length})</h3>

        <div className="flex gap-2">
          {selectedFiles.length > 0 && (
            <button
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="rounded-lg bg-red-500 px-4 py-2 text-white hover:bg-red-600 disabled:opacity-50"
            >
              Xóa đã chọn ({selectedFiles.length})
            </button>
          )}

          <button
            onClick={loadFiles}
            disabled={listFetcher.state === "loading"}
            className="rounded-lg bg-gray-500 px-4 py-2 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {listFetcher.state === "loading" ? "Đang tải..." : "Tải lại"}
          </button>
        </div>
      </div>

      {/* File List */}
      <div className="mt-4 space-y-2">
        {files.length === 0 ? (
          <div className="py-8 text-center text-gray-500">Chưa có file nào</div>
        ) : (
          files.map((file) => (
            <div
              key={file.name}
              className="flex items-center justify-between rounded-lg border p-4 hover:bg-gray-50"
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.name)}
                  onChange={() => toggleFileSelection(file.name)}
                  className="h-4 w-4"
                />

                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <div className="text-sm text-gray-500">
                    {formatFileSize(file.size)} •{" "}
                    {new Date(file.lastModified).toLocaleDateString("vi-VN")}
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => handleFileDownload(file.name)}
                  className="rounded bg-blue-500 px-3 py-1 text-white hover:bg-blue-600"
                >
                  Tải về
                </button>

                <button
                  onClick={() => handleFileDelete(file.name)}
                  disabled={isDeleting}
                  className="rounded bg-red-500 px-3 py-1 text-white hover:bg-red-600 disabled:opacity-50"
                >
                  Xóa
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
