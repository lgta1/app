import React from "react";
import toast from "react-hot-toast";
import * as Dialog from "@radix-ui/react-dialog";
import { Download } from "lucide-react";

import type { ChapterType } from "~/database/models/chapter.model";

type DownloadChaptersDialogProps = {
  mangaId: string;
  mangaTitle: string;
  mangaSlug: string;
  chapters: ChapterType[];
  isFreeDownload: boolean;
  costPerChapter: number;
  className?: string;
};

export function DownloadChaptersDialog({
  mangaId,
  mangaTitle,
  mangaSlug,
  chapters,
  isFreeDownload,
  costPerChapter,
  className,
}: DownloadChaptersDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [downloadState, setDownloadState] = React.useState<{
    active: boolean;
    current: number;
    total: number;
    stage: "fetch" | "zip" | "direct" | "idle";
  }>({ active: false, current: 0, total: 0, stage: "idle" });

  const orderedChapters = React.useMemo(
    () =>
      (chapters || [])
        .map((c) => ({
          id: String((c as any).id ?? (c as any)._id ?? ""),
          chapterNumber: Number((c as any).chapterNumber ?? 0),
          title: String((c as any).title ?? ""),
        }))
        .filter((c) => Number.isFinite(c.chapterNumber) && c.chapterNumber > 0)
        .sort((a, b) => a.chapterNumber - b.chapterNumber),
    [chapters],
  );

  const totalSelectable = orderedChapters.length;
  const selectedCount = selected.size;
  const costValue = Number.isFinite(costPerChapter) ? costPerChapter : 0;
  const totalCost = isFreeDownload ? 0 : selectedCount * costValue;

  const isAllSelected = selectedCount > 0 && selectedCount === totalSelectable;

  const toggleSelect = (chapterNumber: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(chapterNumber)) {
        next.delete(chapterNumber);
      } else {
        next.add(chapterNumber);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(orderedChapters.map((c) => c.chapterNumber)));
  };

  const clearAll = () => {
    setSelected(new Set());
  };

  const sanitizeName = (value: string) =>
    value.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();

  const pad = (value: number, size = 3) => String(value).padStart(size, "0");

  const getFileExt = (url: string) => {
    const clean = url.split("?")[0]?.split("#")[0] || "";
    const match = /\.([a-z0-9]+)$/i.exec(clean);
    return match?.[1]?.toLowerCase() || "jpg";
  };

  const fetchChaptersForDownload = async () => {
    if (selectedCount === 0 || downloadState.active) {
      toast.error("Vui lòng chọn ít nhất một chương để tải");
      return null;
    }

    const chapterNumbers = Array.from(selected).sort((a, b) => a - b);
    setDownloadState({ active: true, current: 0, total: 0, stage: "fetch" });

    const response = await fetch("/api/manga-download", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "include",
      body: JSON.stringify({ mangaId, chapterNumbers }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) {
      throw new Error(data?.error || "Không thể tải truyện");
    }

    const chaptersData = Array.isArray(data?.chapters) ? data.chapters : [];
    if (chaptersData.length === 0) {
      throw new Error("Không tìm thấy chương để tải");
    }

    return chaptersData;
  };

  const handleDownloadZip = async () => {
    try {
      const chaptersData = await fetchChaptersForDownload();
      if (!chaptersData) return;

      const totalImages = chaptersData.reduce(
        (sum: number, c: any) => sum + (Array.isArray(c?.contentUrls) ? c.contentUrls.length : 0),
        0,
      );
      setDownloadState({ active: true, current: 0, total: totalImages, stage: "fetch" });

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      let current = 0;
      for (const chapter of chaptersData) {
        const chapterNumber = Number(chapter?.chapterNumber ?? 0);
        const folder = zip.folder(`Chap-${pad(chapterNumber)}`);
        const urls = Array.isArray(chapter?.contentUrls) ? chapter.contentUrls : [];
        const downloadUrls = Array.isArray(chapter?.downloadUrls) ? chapter.downloadUrls : [];

        for (let i = 0; i < urls.length; i += 1) {
          const originalUrl = String(urls[i] || "");
          const url = String(downloadUrls[i] || originalUrl || "");
          if (!url) continue;
          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) {
            throw new Error(`Không thể tải ảnh chương ${chapterNumber}`);
          }
          const blob = await res.blob();
          const ext = getFileExt(originalUrl || url);
          folder?.file(`${pad(i + 1)}.${ext}`, blob);
          current += 1;
          setDownloadState({ active: true, current, total: totalImages, stage: "fetch" });
        }
      }

      setDownloadState({ active: true, current: totalImages, total: totalImages, stage: "zip" });
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "STORE" });
      const fileBase = sanitizeName(mangaSlug || mangaTitle || "manga");
      const fileName = `${fileBase || "manga"}-chapters-${selectedCount}.zip`;

      const blobUrl = URL.createObjectURL(zipBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      toast.success(
        totalCost > 0
          ? `Đã trừ ${totalCost} Dâm Ngọc. Bắt đầu tải xuống...`
          : "Bắt đầu tải xuống...",
      );
      setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
      setOpen(false);
    } catch (error) {
      console.error("[download-zip] failed", error);
      const message =
        error instanceof Error && /fetch/i.test(error.message)
          ? "Ảnh không cho phép tải dạng ZIP (CORS)."
          : error instanceof Error
            ? error.message
            : "Không thể tải truyện";
      toast.error(message);
      setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
    }
  };

  const handleDownloadImages = async () => {
    try {
      const chaptersData = await fetchChaptersForDownload();
      if (!chaptersData) return;

      const supportsDirectoryPicker =
        typeof window !== "undefined" &&
        typeof (window as any).showDirectoryPicker === "function";

      if (!supportsDirectoryPicker) {
        toast.error("Trình duyệt chưa hỗ trợ chọn thư mục lưu. Hãy dùng \"Tải zip\".");
        setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
        return;
      }

      const canUseFolderDownload = chaptersData.every((chapter: any) => {
        const downloadUrls = Array.isArray(chapter?.downloadUrls) ? chapter.downloadUrls : [];
        if (!downloadUrls.length) return false;
        return downloadUrls.every((u: any) => typeof u === "string" && u.startsWith("/api/files/download"));
      });

      if (!canUseFolderDownload) {
        toast.error("Không thể tải thẳng ảnh do nguồn ảnh không hỗ trợ.");
        setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
        return;
      }

      let rootDir: any = null;
      try {
        rootDir = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      } catch {
        rootDir = null;
      }

      if (!rootDir) {
        setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
        return;
      }

      const totalImages = chaptersData.reduce(
        (sum: number, c: any) => sum + (Array.isArray(c?.contentUrls) ? c.contentUrls.length : 0),
        0,
      );
      setDownloadState({ active: true, current: 0, total: totalImages, stage: "direct" });

      let current = 0;
      for (const chapter of chaptersData) {
        const chapterNumber = Number(chapter?.chapterNumber ?? 0);
        const urls = Array.isArray(chapter?.contentUrls) ? chapter.contentUrls : [];
        const downloadUrls = Array.isArray(chapter?.downloadUrls) ? chapter.downloadUrls : [];
        const chapterFolder = await rootDir.getDirectoryHandle(`Chap-${pad(chapterNumber)}`, { create: true });

        for (let i = 0; i < urls.length; i += 1) {
          const originalUrl = String(urls[i] || "");
          const url = String(downloadUrls[i] || originalUrl || "");
          if (!url) continue;
          const ext = getFileExt(originalUrl || url);
          const fileName = `${pad(i + 1)}.${ext}`;

          const res = await fetch(url, { credentials: "include" });
          if (!res.ok) {
            throw new Error(`Không thể tải ảnh chương ${chapterNumber}`);
          }
          const blob = await res.blob();
          const fileHandle = await chapterFolder.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();

          current += 1;
          setDownloadState({ active: true, current, total: totalImages, stage: "direct" });
        }
      }

      toast.success(
        totalCost > 0
          ? `Đã trừ ${totalCost} Dâm Ngọc. Bắt đầu tải xuống...`
          : "Bắt đầu tải xuống...",
      );
      setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
      setOpen(false);
    } catch (error) {
      console.error("[download-images] failed", error);
      toast.error(error instanceof Error ? error.message : "Không thể tải truyện");
      setDownloadState({ active: false, current: 0, total: 0, stage: "idle" });
    }
  };

  return (
    <div className={className || "mt-4"}>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-bd-default bg-bgc-layer2 px-4 py-2 text-sm font-semibold text-txt-primary hover:bg-bgc-layer2/80"
          >
            <Download className="h-4 w-4" />
            Tải truyện
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/50" />
          <Dialog.Content className="fixed left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-bd-default bg-bgc-layer1 p-5 shadow-xl">
            <Dialog.Title className="text-txt-primary text-lg font-semibold">Tải truyện</Dialog.Title>
            <Dialog.Description className="text-txt-secondary mt-1 text-sm">
              Chọn chương để tải. Bạn có thể tải ZIP hoặc tải thẳng ảnh (trình duyệt hỗ trợ sẽ cho chọn thư mục lưu).
            </Dialog.Description>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-primary hover:bg-bgc-layer2/80"
              >
                Chọn tất
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="rounded-lg border border-bd-default px-3 py-1.5 text-xs font-semibold text-txt-secondary hover:bg-bgc-layer2/80"
              >
                Bỏ chọn
              </button>
              {isAllSelected ? (
                <span className="text-txt-secondary text-xs">Đã chọn tất cả chương</span>
              ) : null}
            </div>

            <div className="mt-4 max-h-[50vh] overflow-auto rounded-xl border border-bd-default">
              {orderedChapters.map((chapter) => (
                <label
                  key={chapter.id || chapter.chapterNumber}
                  className="flex cursor-pointer items-center gap-3 border-b border-bd-default px-4 py-3 last:border-b-0"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(chapter.chapterNumber)}
                    onChange={() => toggleSelect(chapter.chapterNumber)}
                    className="h-4 w-4 accent-fuchsia-500"
                  />
                  <div className="min-w-0">
                    <div className="text-txt-primary text-sm font-semibold">Chương {chapter.chapterNumber}</div>
                    {chapter.title ? (
                      <div className="text-txt-secondary text-xs truncate">{chapter.title}</div>
                    ) : null}
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="text-txt-secondary text-sm">
                Đã chọn: <span className="text-txt-primary font-semibold">{selectedCount}</span> chương
                {!isFreeDownload ? (
                  <span className="ml-2">• Tổng phí: {totalCost} Dâm Ngọc</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="rounded-lg border border-bd-default px-4 py-2 text-sm font-semibold text-txt-secondary hover:bg-bgc-layer2/80"
                    disabled={downloadState.active}
                  >
                    Đóng
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  onClick={handleDownloadZip}
                  disabled={downloadState.active || selectedCount === 0}
                  className="rounded-lg bg-gradient-to-r from-[#DD94FF] to-[#D373FF] px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadState.active
                    ? downloadState.stage === "zip"
                      ? "Đang đóng gói..."
                      : `Đang tải ${downloadState.current}/${downloadState.total}`
                    : "Tải zip"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImages}
                  disabled={downloadState.active || selectedCount === 0}
                  className="rounded-lg border border-bd-default px-4 py-2 text-sm font-semibold text-txt-primary hover:bg-bgc-layer2/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {downloadState.active && downloadState.stage === "direct"
                    ? `Đang tải ${downloadState.current}/${downloadState.total}`
                    : "Tải thẳng ảnh"}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

export default DownloadChaptersDialog;
