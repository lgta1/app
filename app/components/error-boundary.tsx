import { isRouteErrorResponse, Link, useRouteError } from "react-router";

export function ErrorBoundary() {
  const error = useRouteError();
  let devDetails = "";

  if (isRouteErrorResponse(error)) {
    return (
      <div className="bg-gradient-radial flex min-h-screen items-center justify-center from-[#191758] to-[#09101A]">
        <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-8 text-center">
          <h1 className="text-txt-primary mb-4 text-2xl font-bold">
            {error.status} {error.statusText || "Đã xảy ra lỗi không mong muốn"}
          </h1>
          <Link to="/">
            <button className="to-btn-primary rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
              Về trang chủ
            </button>
          </Link>
        </div>
      </div>
    );
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    devDetails = error.message;
    devDetails += "\n" + error.stack;
  }

  return (
    <div className="bg-gradient-radial mx-auto flex min-h-screen max-w-xl items-center justify-center from-[#191758] to-[#09101A]">
      <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-8 text-center">
        <h1 className="text-txt-primary mb-4 text-2xl font-bold">
          Đã xảy ra lỗi không mong muốn
        </h1>
        <p className="text-txt-secondary mb-6">
          Vui lòng thử lại sau hoặc liên hệ hỗ trợ nếu lỗi tiếp tục xảy ra.
        </p>
        {devDetails && <p className="text-txt-secondary mb-6">{devDetails}</p>}
        <Link to="/">
          <button className="to-btn-primary rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
            Về trang chủ
          </button>
        </Link>
      </div>
    </div>
  );
}
