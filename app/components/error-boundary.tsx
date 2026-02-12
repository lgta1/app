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
            Có thể chúng tôi đang BẢO TRÌ MÁY CHỦ hoặc đang BỔ SUNG TÍNH NĂNG. Thử lại sau 10s - 5 phút, nếu vẫn không được hãy báo lỗi với chúng tôi qua Discord Vinahentai. Cảm ơn bạn.
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
              Quay về Trang trước
            </button>
            <Link to="/">
              <button className="to-btn-primary cursor-pointer rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
                Quay về Trang chủ
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
          Có thể chúng tôi đang BẢO TRÌ MÁY CHỦ hoặc đang BỔ SUNG TÍNH NĂNG. Thử lại sau 10s - 5 phút, nếu vẫn không được hãy báo lỗi với chúng tôi qua Discord Vinahentai. Cảm ơn bạn.
        </p>
        {devDetails && <p className="text-txt-secondary mb-6">{devDetails}</p>}
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <button
            onClick={() => navigate(-1)}
            className="to-btn-primary border-lav-500 text-txt-focus cursor-pointer rounded-xl border px-6 py-3 text-sm font-semibold"
          >
            Quay về Trang trước
          </button>
          <Link to="/">
            <button className="to-btn-primary cursor-pointer rounded-xl bg-gradient-to-b from-[#DD94FF] px-6 py-3 text-sm font-semibold text-black">
              Quay về Trang chủ
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
