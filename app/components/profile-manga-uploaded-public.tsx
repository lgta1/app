import { BookOpen } from "lucide-react";

import { LoadingSpinner } from "~/components/loading-spinner";
import { MangaCard } from "~/components/manga-card";
import { Pagination } from "~/components/pagination";
import type { MangaType } from "~/database/models/manga.model";
import { usePagination } from "~/hooks/use-pagination";

interface ProfileMangaUploadedPublicProps {
  userId?: string;
}

export function ProfileMangaUploadedPublic({ userId }: ProfileMangaUploadedPublicProps) {
  const queryParams = userId ? { userId } : undefined;

  const {
    data: uploadedMangas,
    currentPage,
    totalPages,
    isLoading,
    error,
    goToPage,
  } = usePagination<MangaType>({
    apiUrl: "/api/manga/uploaded",
    limit: 20,
    queryParams,
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <BookOpen className="text-lav-500 h-5 w-5" />
        <h2 className="text-xl font-semibold text-white uppercase">TRUYỆN ĐÃ ĐĂNG</h2>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="py-8 text-center">
          <p className="text-error-error text-sm font-medium">{error}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {uploadedMangas.map((manga) => (
              <MangaCard key={manga.id} manga={manga} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
