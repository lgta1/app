import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = [];

  // Calculate the range of pages to show (current ± 2)
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);

  if (startPage > 1) {
    pages.push("...");
  }

  if (endPage < totalPages) {
    pages.push("...");
  }

  // Add pages in the range
  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <div className="bg-bgc-layer1 border-bd-default inline-flex items-center justify-start rounded-lg border">
      <div
        className="hover:bg-bgc-layer2 inline-flex w-8 cursor-pointer flex-col items-center justify-center rounded-lg p-1.5"
        onClick={() => currentPage > 1 && onPageChange(1)}
      >
        <ChevronLeft className="text-txt-secondary h-4 w-4" />
      </div>

      {pages.map((page, index) => (
        <div key={index}>
          {page === "..." ? (
            <div className="inline-flex w-8 flex-col items-center justify-center rounded-lg p-1.5">
              <div className="text-txt-primary text-center font-sans text-sm leading-tight font-semibold">
                ...
              </div>
            </div>
          ) : (
            <div
              className={`hover:bg-bgc-layer2 inline-flex w-8 cursor-pointer flex-col items-center justify-center rounded-lg p-1.5 ${
                currentPage === page ? "bg-btn-primary" : ""
              }`}
              onClick={() => onPageChange(page as number)}
            >
              <div
                className={`text-center font-sans text-sm leading-tight font-semibold ${
                  currentPage === page ? "text-bgc-layer1" : "text-txt-primary"
                }`}
              >
                {page}
              </div>
            </div>
          )}
        </div>
      ))}

      <div
        className="hover:bg-bgc-layer2 inline-flex w-8 cursor-pointer flex-col items-center justify-center rounded-lg p-1.5"
        onClick={() => currentPage < totalPages && onPageChange(totalPages)}
      >
        <ChevronRight className="text-txt-secondary h-4 w-4" />
      </div>
    </div>
  );
}
