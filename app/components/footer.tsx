import { Link } from "react-router-dom";

const GENRE_LINKS: { label: string; to: string }[] = [
  { label: "Ahegao", to: "/genres/ahegao" },
  { label: "Hentai 18+", to: "/genres/anal" },
  { label: "Big Ass", to: "/genres/big-ass" },
  { label: "Big Boobs", to: "/genres/big-boobs" },
  { label: "Blowjobs", to: "/genres/blowjobs" },
  { label: "Cosplay", to: "/genres/anh-cosplay" },
  { label: "Doujinshi", to: "/genres/doujinshi" },
  { label: "Ecchi", to: "/genres/ecchi" },
  { label: "Full Color", to: "/genres/full-color" },
  { label: "Harem", to: "/genres/harem" },
  { label: "Isekai", to: "/genres/isekai" },
  { label: "MILF", to: "/genres/milf" },
  { label: "NTR", to: "/genres/ntr" },
  { label: "Romance", to: "/genres/romance" },
  { label: "Schoolgirl", to: "/genres/schoolgirl" },
  { label: "Vanilla", to: "/genres/vanilla" },
  { label: "3D Hentai", to: "/genres/3d-hentai" },
  { label: "BDSM", to: "/genres/bdsm" },
  { label: "Elf", to: "/genres/elf" },
  { label: "Fantasy", to: "/genres/fantasy" },
  { label: "Manhwa", to: "/genres/manhwa" },
  { label: "Mind Break", to: "/genres/mind-break" },
];

const PARTNER_LINKS: { label: string; href: string; badge: string }[] = [
  { label: "Sex Anime", href: "https://hentaiz-a1.com", badge: "hentaiz-a1.com" },
];

export function Footer() {
  return (
    <footer className="border-bd-default bg-bgc-layer1 border-t">
      <div className="container mx-auto px-4 py-8 md:px-8 md:py-12">
        {/* ── Hàng chính: 3 cột ── */}
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[220px_1fr_1fr] md:gap-10">
          {/* Cột 1: Logo + Điều hướng + Liên hệ */}
          <div className="flex flex-col gap-5">
            <img
              src="/images/logo2.webp"
              alt="Vinahentai Logo"
              className="h-8 w-36 md:h-10 md:w-44"
            />

            <nav className="flex flex-col gap-1.5">
              <Link to="/gioi-thieu" className="text-txt-secondary hover:text-txt-primary text-sm font-medium transition-colors">
                Giới thiệu
              </Link>
              <Link to="/danh-sach" className="text-txt-secondary hover:text-txt-primary text-sm font-medium transition-colors">
                Danh sách truyện
              </Link>
              <Link to="/genres" className="text-txt-secondary hover:text-txt-primary text-sm font-medium transition-colors">
                Thể loại
              </Link>
              <Link to="/leaderboard" className="text-txt-secondary hover:text-txt-primary text-sm font-medium transition-colors">
                Bảng xếp hạng
              </Link>
            </nav>

            <div className="flex flex-col gap-2">
              <p className="text-txt-primary text-sm font-semibold">Liên hệ</p>
              <a
                href="mailto:vinahentai.contact@gmail.com"
                className="text-txt-secondary hover:text-pink-400 flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
                  <path d="M3 4a2 2 0 0 0-2 2v1.161l8.441 4.221a1.25 1.25 0 0 0 1.118 0L19 7.162V6a2 2 0 0 0-2-2H3Z" />
                  <path d="m19 8.839-7.77 3.885a2.75 2.75 0 0 1-2.46 0L1 8.839V14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.839Z" />
                </svg>
                vinahentai.contact@gmail.com
              </a>
              <a
                href="https://t.me/vnhtcontact"
                target="_blank"
                rel="noopener noreferrer"
                className="text-txt-secondary hover:text-sky-400 flex items-center gap-1.5 text-sm font-medium transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 shrink-0">
                  <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                </svg>
                @vnhtcontact
              </a>
            </div>

            <p className="text-txt-muted text-xs">© 2025 Vinahentai</p>
          </div>

          {/* Cột 2: Giới thiệu */}
          <div className="flex flex-col gap-3">
            <p className="text-txt-primary text-sm font-semibold">Giới thiệu</p>
            <p className="text-txt-secondary text-sm leading-relaxed">
              Vinahentai là nền tảng cộng đồng chia sẻ truyện tranh trực tuyến để cùng
              giải trí. Nội dung trên trang được đăng tải bởi người dùng và có thể chưa
              được kiểm duyệt đầy đủ.
            </p>
            <p className="text-txt-secondary text-sm leading-relaxed">
              Chúng tôi tôn trọng quyền tác giả và cam kết xử lý nhanh chóng nếu có nội
              dung vi phạm. Vui lòng liên hệ nếu bạn phát hiện nội dung chưa phù hợp.
            </p>
            <p className="text-txt-muted text-xs leading-relaxed">
              Nội dung quảng cáo do bên thứ ba cung cấp; người dùng tự cân nhắc khi tương tác.
            </p>
          </div>

          {/* Cột 3: Khám phá thêm */}
          <div className="flex flex-col gap-3">
            <p className="text-txt-primary text-sm font-semibold">Khám phá thêm</p>
            <div className="flex flex-wrap gap-1.5">
              {GENRE_LINKS.map(({ label, to }) => (
                <Link
                  key={to}
                  to={to}
                  className="border-bd-default text-txt-secondary hover:border-pink-500/50 hover:text-pink-400 rounded border px-2 py-0.5 text-xs font-medium transition-colors"
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="border-bd-default my-6 border-t" />

        {/* ── Hàng dưới: Liên kết đối tác / Tài trợ ── */}
        <div className="flex flex-col gap-3">
          <p className="text-txt-primary text-sm font-semibold">Liên kết đối tác / Tài trợ</p>
          <div className="flex flex-wrap gap-2">
            {PARTNER_LINKS.map(({ label, href, badge }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer sponsored"
                className="border-bd-default bg-bgc-layer2 text-txt-secondary hover:text-txt-primary inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
              >
                <span>{label}</span>
                <span className="text-txt-muted rounded bg-black/20 px-1.5 py-0.5 text-[10px] font-normal">
                  {badge}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
