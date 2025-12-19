import { useState } from "react";

// Removed icon import per UI spec change
// import { ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const [gotoValue, setGotoValue] = useState<string>("");
  const pages: Array<number | "..."> = [];

  // Tính dải trang hiển thị (current ± 2)
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) pages.push("...");
  for (let i = startPage; i <= endPage; i++) pages.push(i);
  if (endPage < totalPages) pages.push("...");

  const isAtFirst = currentPage <= 1;
  const isAtLast = currentPage >= totalPages;

  // Kích thước: cao ×1.25, rộng ×1.1
  const baseBtn =
    "hover:bg-bgc-layer2 inline-flex h-10 w-9 cursor-pointer flex-col items-center justify-center rounded-lg p-2";
  const disabledCls = "opacity-50 cursor-not-allowed hover:bg-transparent";

  const gotoNumber = (() => {
    const n = parseInt(gotoValue, 10);
    if (isNaN(n)) return undefined;
    return n;
  })();

  const isGotoValid = gotoNumber !== undefined && gotoNumber >= 1 && gotoNumber <= totalPages;

  const handleGotoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGotoValid) {
      onPageChange(gotoNumber as number);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="bg-bgc-layer1 border-bd-default inline-flex items-center justify-start gap-2 rounded-lg border px-2 py-1">
      {/* Nhảy về TRANG ĐẦU (≪) */}
      <button
        className={`${baseBtn} ${isAtFirst ? disabledCls : ""}`}
        aria-label="Về trang đầu"
        disabled={isAtFirst}
        onClick={() => !isAtFirst && onPageChange(1)}
        title="Về trang đầu"
        type="button"
      >
        <div className="text-txt-secondary text-center font-sans text-sm font-semibold leading-tight">Đầu</div>
      </button>

      {/* (ĐÃ LOẠI BỎ) Nút lùi 1 trang */}

      {/* Dãy trang */}
      <div className="inline-flex items-center gap-1">
        {pages.map((page, idx) => (
          <div key={`${page}-${idx}`}>
            {page === "..." ? (
              <div className="inline-flex h-10 w-9 flex-col items-center justify-center rounded-lg p-2">
                <div className="text-txt-primary text-center font-sans text-sm font-semibold leading-tight">
                  ...
                </div>
              </div>
            ) : (
              <button
                type="button"
                className={`${baseBtn} ${currentPage === page ? "bg-btn-primary" : ""}`}
                aria-current={currentPage === page ? "page" : undefined}
                onClick={() => onPageChange(page as number)}
                title={`Trang ${page}`}
              >
                <div
                  className={`text-center font-sans text-sm font-semibold leading-tight ${
                    currentPage === page ? "text-bgc-layer1" : "text-txt-primary"
                  }`}
                >
                  {page}
                </div>
              </button>
            )}
          </div>
        ))}
      </div>

      {/* (ĐÃ LOẠI BỎ) Nút tiến 1 trang */}

      {/* Tới TRANG CUỐI (≫) */}
      <button
        className={`${baseBtn} ${isAtLast ? disabledCls : ""}`}
        aria-label="Tới trang cuối"
        disabled={isAtLast}
        onClick={() => !isAtLast && onPageChange(totalPages)}
        title="Tới trang cuối"
        type="button"
      >
        <div className="text-txt-secondary text-center font-sans text-sm font-semibold leading-tight">Cuối</div>
      </button>
      </div>
      {/* Ô nhập số trang + nút Đi */}
      <form onSubmit={handleGotoSubmit} className="inline-flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={totalPages}
          placeholder="Trang"
          value={gotoValue}
          onChange={(e) => setGotoValue(e.target.value.replace(/[^0-9]/g, ""))}
          className="h-10 w-20 rounded-lg border border-bd-default bg-bgc-layer1 px-2 text-center font-sans text-sm font-semibold text-txt-primary focus:outline-none focus:ring-2 focus:ring-btn-primary"
        />
        <button
          type="submit"
          disabled={!isGotoValid}
          className={`inline-flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-lg px-3 font-sans text-sm font-semibold leading-tight ${
            isGotoValid ? "bg-btn-primary text-bgc-layer1 hover:opacity-90" : "bg-bgc-layer2 text-txt-secondary opacity-50 cursor-not-allowed"
          }`}
          title={isGotoValid ? `Đi tới trang ${gotoNumber}` : "Nhập trang hợp lệ"}
        >
          Đi
        </button>
      </form>
    </div>
  );
}
