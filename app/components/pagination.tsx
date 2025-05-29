import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const pages = [];

  // Always show first page
  pages.push(1);

  // Show current page and surrounding pages
  if (currentPage > 3) {
    pages.push("...");
  }

  for (
    let i = Math.max(2, currentPage - 1);
    i <= Math.min(totalPages - 1, currentPage + 1);
    i++
  ) {
    if (!pages.includes(i)) {
      pages.push(i);
    }
  }

  // Show dots before last page if needed
  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  // Always show last page if more than 1 page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages);
  }

  return (
    <div className="bg-bgc-layer1 border-bd-default inline-flex items-center justify-start rounded-lg border">
      <div
        className="hover:bg-bgc-layer2 inline-flex w-8 cursor-pointer flex-col items-center justify-center rounded-lg p-1.5"
        onClick={() => currentPage > 1 && onPageChange(currentPage - 1)}
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
        onClick={() => currentPage < totalPages && onPageChange(currentPage + 1)}
      >
        <ChevronRight className="text-txt-secondary h-4 w-4" />
      </div>
    </div>
  );
}
