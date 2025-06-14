import { Link, useParams } from "react-router";
import { Check } from "lucide-react";

export default function MangaUploadedSuccess() {
  const params = useParams();
  return (
    <div className="bg-bgc-layer1 flex min-h-screen items-center justify-center p-4">
      <div className="inline-flex w-full max-w-[701px] flex-col items-center justify-start gap-4 sm:gap-6">
        {/* Success Icon */}
        <div className="relative mb-3 flex aspect-square h-[75px] w-[75px] items-center justify-center overflow-hidden rounded-full bg-[#25EBAC]">
          <Check className="text-txt-primary h-12 w-12" strokeWidth={3} />
        </div>

        {/* Success Title */}
        <h1
          className="text-txt-primary text-center font-sans text-2xl leading-tight font-semibold sm:text-3xl sm:leading-9"
          style={{
            textShadow: "0px 0px 4px rgba(182, 25, 255, 0.59)",
          }}
        >
          Đăng Truyện Thành Công!
        </h1>

        {/* Description */}
        <p className="text-txt-secondary max-w-md px-4 text-center font-sans text-sm leading-normal font-medium sm:max-w-none sm:px-0 sm:text-base">
          Cảm ơn bạn đã đăng truyện. Chúng mình sẽ duyệt truyện của bạn trong vòng 7 ngày
          làm việc.
        </p>

        {/* Action Buttons */}
        <div className="flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
          {/* Secondary Button - Xem trước */}
          <Link
            to={`/manga/preview/${params.id}`}
            className="border-lav-500 hover:bg-lav-500/10 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl border bg-transparent px-4 py-3 transition-colors duration-200 sm:w-52"
            style={{
              boxShadow: "0px 4px 8.9px 0px rgba(146, 53, 190, 0.25)",
            }}
          >
            <span className="text-txt-focus text-center font-sans text-sm leading-tight font-semibold">
              Xem trước
            </span>
          </Link>

          {/* Primary Button - Tiếp tục */}
          <Link
            to={`/manga/chapter/create/${params.id}`}
            className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-4 py-3 font-sans text-sm leading-tight font-semibold text-black transition-opacity duration-200 hover:opacity-90 sm:w-52"
            style={{
              background: "linear-gradient(to bottom, #DD94FF, #D373FF)",
              boxShadow: "0px 4px 8.9px 0px rgba(196, 69, 255, 0.25)",
            }}
          >
            <span className="text-center">Tiếp tục</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
