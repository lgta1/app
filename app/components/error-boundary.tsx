import { isRouteErrorResponse, Link, useNavigate, useRouteError } from "react-router-dom";

export function ErrorBoundary() {
  const error = useRouteError();
  let devDetails = "";
  const navigate = useNavigate();

  try {
    // Always log details to console for debugging in production
    // This helps diagnose issues without exposing error text to users.
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error);
  } catch {}

  if (isRouteErrorResponse(error)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-8 text-center">
          <h1 className="text-txt-primary mb-4 text-2xl font-bold">
            Có vẻ bạn đang đi lạc đường, liên hệ với chúng tôi nếu nghĩ đây là lỗi ^^
          </h1>
          {import.meta.env.DEV && (
            <p className="text-txt-secondary mb-6">
              {error.status} {error.statusText}
            </p>
          )}
          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <button
              onClick={() => navigate(-1)}
              className="to-btn-primary border-lav-500 text-txt-focus cursor-pointer rounded-xl border px-6 py-3 text-sm font-semibold"
            >
              Về trang trước
            </button>
            <button
              onClick={() => navigate(0)}
              className="to-btn-primary border-lav-500 text-txt-focus cursor-pointer rounded-xl border px-6 py-3 text-sm font-semibold"
            >
              Tải lại trang
            </button>
            <Link to="/">
              <button className="to-btn-primary cursor-pointer rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
                Về trang chủ
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    devDetails = error.message;
    devDetails += "\n" + error.stack;
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center justify-center">
      <div className="bg-bgc-layer1 border-bd-default rounded-xl border p-8 text-center">
        <h1 className="text-txt-primary mb-4 text-2xl font-bold">Opps!</h1>
        <p className="text-txt-secondary mb-6">
          Có vẻ bạn đang đi lạc đường, liên hệ với chúng tôi nếu nghĩ đây là lỗi ^^
        </p>
        {devDetails && <p className="text-txt-secondary mb-6">{devDetails}</p>}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => navigate(-1)}
            className="to-btn-primary border-lav-500 text-txt-focus cursor-pointer rounded-xl border px-6 py-3 text-sm font-semibold"
          >
            Về trang trước
          </button>
          <button
            onClick={() => navigate(0)}
            className="to-btn-primary border-lav-500 text-txt-focus cursor-pointer rounded-xl border px-6 py-3 text-sm font-semibold"
          >
            Tải lại trang
          </button>
          <Link to="/">
            <button className="to-btn-primary cursor-pointer rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
              Về trang chủ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
