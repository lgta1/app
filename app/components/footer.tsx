import { Link } from "react-router";

export function Footer() {
  return (
    <footer className="border-bd-default bg-bgc-layer1 overflow-hidden border-t">
      <div className="container mx-auto px-4 py-6 pb-12 md:px-8 md:py-10 md:pb-20">
        <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-[1fr_2fr_3fr] md:gap-8">
          {/* Cột bên trái */}
          <div className="flex flex-col gap-8 md:gap-16">
            {/* Logo & links */}
            <div className="flex w-full flex-col gap-4 md:w-60">
              {/* Logo */}
              <img
                src="/images/logo.png"
                alt="Vinahentai Logo"
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
                  Email:{" "}
                  <a href="mailto:vinahentai.contact@gmail.com" className="text-pink-500 hover:text-pink-400 hover:underline">
                    vinahentai.contact@gmail.com
                  </a>{" "}
                  hoặc{" "}
                  <a href="mailto:contact.vina2ten@proton.me" className="text-pink-500 hover:text-pink-400 hover:underline">
                    contact.vina2ten@proton.me
                  </a>
                </p>
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  Gửi kèm thông tin liên hệ (telegram)
                </p>
                <p className="text-txt-secondary text-sm leading-tight font-medium">
                  Copyright © 2025 Vinahentai
                </p>
              </div>
            </div>
          </div>

          {/* Cột giữa: Giới thiệu / Disclaimer */}
          <div className="flex flex-col gap-4">
            <h3 className="text-txt-primary text-xl leading-normal font-medium md:text-2xl">
              Giới thiệu
            </h3>
            <p className="text-txt-secondary text-sm leading-tight font-medium">
              Vinahentai là nền tảng cộng đồng, nơi người dùng có thể chia sẻ
              truyện tranh trực tuyến để cùng giải trí. Nội dung trên trang được
              đăng tải bởi người dùng, vì vậy có thể có trường hợp chưa được
              kiểm duyệt kỹ càng hoặc vi phạm bản quyền.
              <br />
              <br />
              Chúng tôi luôn tôn trọng quyền tác giả và mong muốn cùng cộng đồng
              xây dựng không gian đọc truyện giải trí. Nếu bạn là chủ sở hữu
              bản quyền hoặc phát hiện nội dung chưa phù hợp, vui lòng liên hệ
              với chúng tôi. Chúng tôi cam kết xử lý nhanh chóng để bảo vệ
              quyền lợi chính đáng.
              <br />
              <br />
              Nội dung quảng cáo hiển thị trên trang do bên thứ ba cung cấp;
              người dùng cần cân nhắc khi tương tác.
            </p>
          </div>

          {/* Cột phải: Từ khóa & liên kết */}
          <div className="flex flex-col gap-4">
            <h3 className="text-txt-primary text-xl leading-normal font-medium md:text-2xl">
              Khám phá thêm
            </h3>

            <p className="text-txt-secondary text-sm leading-tight font-medium">
              VinaHentai là nơi bạn có thể{" "}
              <Link to="/genres/ahegao" className="text-pink-500 hover:text-pink-400 hover:underline">đọc hentai online</Link>, trải nghiệm
              hàng ngàn bộ truyện hấp dẫn. Từ những bộ{" "}
              <Link to="/genres/anal" className="text-pink-500 hover:text-pink-400 hover:underline">đọc truyện hentai 18+</Link>,{" "}
              <Link to="/genres/big-ass" className="text-pink-500 hover:text-pink-400 hover:underline">Đọc truyện tranh Hentai</Link> cho đến
              những tuyển tập <Link to="/genres/big-boobs" className="text-pink-500 hover:text-pink-400 hover:underline">Truyện Hentai</Link>,
              thậm chí cả biến thể tìm kiếm như{" "}
              <Link to="/genres/blowjobs" className="text-pink-500 hover:text-pink-400 hover:underline">truyện hentaiz</Link>, tất cả đều được
              cập nhật đầy đủ và nhanh chóng. Chúng tôi đặc biệt mang đến các
              bộ <Link to="/genres/cosplay" className="text-pink-500 hover:text-pink-400 hover:underline">hentai vietsub</Link>, những tuyển
              tập <Link to="/genres/doujinshi" className="text-pink-500 hover:text-pink-400 hover:underline">truyện hentai vietsub full</Link>{" "}
              chất lượng cao, kể cả bản{" "}
              <Link to="/genres/ecchi" className="text-pink-500 hover:text-pink-400 hover:underline">vietsub không che</Link>, giúp người đọc
              dễ dàng thưởng thức. Nếu bạn yêu thích thể loại{" "}
              <Link to="/genres/full-color" className="text-pink-500 hover:text-pink-400 hover:underline">hentai không che</Link> hay muốn
              khám phá các phiên bản mới lạ như{" "}
              <Link to="/genres/harem" className="text-pink-500 hover:text-pink-400 hover:underline">manhwa không che</Link>, chắc chắn sẽ tìm
              thấy nội dung phù hợp.
            </p>

            <p className="text-txt-secondary text-sm leading-tight font-medium">
              Ngoài ra, bạn còn có thể lựa chọn trong kho{" "}
              <Link to="/genres/soft-incest" className="text-pink-500 hover:text-pink-400 hover:underline">anime hentai</Link>,{" "}
              <Link to="/genres/milf" className="text-pink-500 hover:text-pink-400 hover:underline">anime</Link> hay các chủ đề{" "}
              <Link to="/genres/ntr" className="text-pink-500 hover:text-pink-400 hover:underline">Anime manga hentai Nhật Bản</Link>. Với các
              fan <Link to="/genres/romance" className="text-pink-500 hover:text-pink-400 hover:underline">manhwa hentai</Link>, chúng tôi có
              đầy đủ <Link to="/genres/schoolgirl" className="text-pink-500 hover:text-pink-400 hover:underline">manhwa</Link>, từ{" "}
              <Link to="/genres/vanilla" className="text-pink-500 hover:text-pink-400 hover:underline">manhwa 18+</Link>,{" "}
              <Link to="/genres/3d-hentai" className="text-pink-500 hover:text-pink-400 hover:underline">hentai Manhwa</Link>, cho tới{" "}
              <Link to="/genres/bdsm" className="text-pink-500 hover:text-pink-400 hover:underline">Truyện Manhwa 18+</Link> để thỏa mãn nhu
              cầu giải trí. Trang web cũng đa dạng với nhiều thể loại phong phú
              như <Link to="/genres/elf" className="text-pink-500 hover:text-pink-400 hover:underline">hentai doujinshi</Link>,{" "}
              <Link to="/genres/fantasy" className="text-pink-500 hover:text-pink-400 hover:underline">hentai JAV</Link>, hay cả{" "}
              <Link to="/genres/horror" className="text-pink-500 hover:text-pink-400 hover:underline">
                Truyện tranh sex tiếng việt online
              </Link>.
              Người dùng có thể dễ dàng tìm thấy bất kỳ chủ đề nào mình quan
              tâm.
            </p>

            <p className="text-txt-secondary text-sm leading-tight font-medium">
              Đồng thời, VinaHentai còn được nhiều người biết đến thông qua các
              thương hiệu quen thuộc như{" "}
              <Link to="/genres/isekai" className="text-pink-500 hover:text-pink-400 hover:underline">HentaiVN</Link>,{" "}
              <Link to="/genres/maids" className="text-pink-500 hover:text-pink-400 hover:underline">VinaHentai 18+</Link>, hay cả biến thể
              tìm kiếm phổ biến như <Link to="/genres/manhwa" className="text-pink-500 hover:text-pink-400 hover:underline">hentaivnx</Link>,
              giúp kết nối cộng đồng yêu thích hentai rộng lớn. Chúng tôi luôn
              cập nhật liên tục những bộ{" "}
              <Link to="/genres/mind-break" className="text-pink-500 hover:text-pink-400 hover:underline">hentai full màu</Link>, siêu phẩm{" "}
              <Link to="/genres/nun" className="text-pink-500 hover:text-pink-400 hover:underline">hentai mới nhất 2025</Link>, các tuyển tập{" "}
              <Link to="/genres/nurse" className="text-pink-500 hover:text-pink-400 hover:underline">hentai 18+ hot</Link> cũng như{" "}
              <Link to="/genres/pregnant" className="text-pink-500 hover:text-pink-400 hover:underline">hentai miễn phí</Link> để ai cũng có
              thể tiếp cận. Với các fan của thể loại{" "}
              <Link to="/genres/quan-tat" className="text-pink-500 hover:text-pink-400 hover:underline">Hentai Nhật Bản</Link>, đây chính là
              nơi để bạn khám phá và tận hưởng không giới hạn.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
