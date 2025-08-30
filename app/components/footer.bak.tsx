import { Link } from "react-router";

const sponsors = [
  "Hello 8888",
  "8kbet",
  "Nowgoal",
  "W88",
  "bj88",
  "BK8",
  "new88",
  "Hello 8888",
  "8kbet",
  "Nowgoal",
  "new88",
  "bj88",
  "BK8",
  "new88",
  "Hello 8888",
  "8kbet",
  "new88",
  "Nowgoal",
  "new88",
  "BK8",
  "new88",
  "Hello 8888",
  "new88",
  "bj88",
  "W88",
  "new88",
  "BK8",
  "new88",
  "Hello 8888",
  "8kbet",
  "new88",
];

export function Footer() {
  return (
    <footer className="border-bd-default bg-bgc-layer1 overflow-hidden border-t">
      <div className="container mx-auto px-4 py-6 pb-12 md:px-8 md:py-10 md:pb-20">
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-[1fr_2fr_3fr] md:gap-8">
          {/* Cột bên trái */}
          <div className="flex flex-col gap-8 md:gap-16">
            {/* Logo và links */}
            <div className="flex w-full flex-col gap-4 md:w-60">
              {/* Logo */}
              <img
                src="/images/logo.png"
                alt="WuxiaWorld Logo"
                className="h-8 w-24 md:h-10 md:w-32"
              />

              {/* Links */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center">
                  <Link
                    to="/gioi-thieu"
                    className="text-txt-secondary text-sm leading-tight font-medium"
                  >
                    Giới thiệu
                  </Link>
                  <span className="text-txt-secondary mx-3">|</span>
                  <Link
                    to="/lien-he"
                    className="text-txt-secondary text-sm leading-tight font-medium"
                  >
                    Liên hệ
                  </Link>
                </div>
                <div className="flex items-center">
                  <Link
                    to="/dieu-khoan"
                    className="text-txt-secondary text-sm leading-tight font-medium"
                  >
                    Điều khoản
                  </Link>
                  <span className="text-txt-secondary mx-3">|</span>
                  <Link
                    to="/chinh-sach-bao-mat"
                    className="text-txt-secondary text-sm leading-tight font-medium"
                  >
                    Chính Sách Bảo Mật
                  </Link>
                </div>
              </div>
            </div>

            {/* Thông tin liên hệ */}
            <div className="flex w-full flex-col gap-4 md:w-60">
              <h3 className="text-txt-primary text-xl leading-normal font-medium md:text-2xl">
                Liên hệ đặt quảng cáo
              </h3>
              <div className="flex w-full flex-col gap-[5px] md:w-60">
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  Email: support@nettruyenvie.com
                </p>
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  Gửi kèm thông tin liên hệ (telegram)
                </p>
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  Copyright © 2025 Wuxia World
                </p>
              </div>
            </div>
          </div>

          {/* Cột 2: Disclaimer */}
          <div className="flex flex-col gap-4">
            <h3 className="text-txt-primary text-xl leading-normal font-medium md:text-2xl">
              Liên hệ đặt quảng cáo
            </h3>
            <p className="text-txt-secondary text-sm leading-tight font-medium">
              Trang web này chỉ cung cấp dịch vụ đọc truyện tranh trực tuyến cho mục đích
              giải trí và chia sẻ nội dung. Chúng tôi không chịu trách nhiệm về bản quyền
              truyện (do sưu tầm từ nhiều nguồn) và nội dung quảng cáo của bên thứ ba hiển
              thị trên trang web. Nếu bạn là chủ sở hữu bản quyền và phát hiện nội dung vi
              phạm, vui lòng liên hệ để gỡ bỏ kịp thời. Người dùng cần cân nhắc và chịu
              trách nhiệm khi tương tác với quảng cáo.
            </p>
          </div>

          {/* Danh sách các nhà tài trợ */}
          <div className="flex flex-wrap content-start justify-start gap-1.5">
            {sponsors.map((sponsor, index) => (
              <div
                key={index}
                className="bg-bgc-layer-semi-neutral flex items-center justify-center gap-1.5 rounded-[32px] px-2 py-1.5 backdrop-blur-[3.40px]"
              >
                <span className="text-txt-secondary text-xs leading-none font-medium">
                  {sponsor}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
