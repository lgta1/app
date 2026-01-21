import { useMemo } from "react";
import { ArrowRight, BookOpen, Shield, Sparkles, Trophy } from "lucide-react";
import { Link, useLoaderData } from "react-router-dom";
import type { LoaderFunctionArgs, MetaFunction } from "react-router-dom";

export async function loader({ request }: LoaderFunctionArgs) {
  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");
  return {
    origin: getCanonicalOrigin(request as any),
  };
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  const origin = data?.origin || "";
  const canonicalUrl = origin ? `${origin}/gioi-thieu` : "/gioi-thieu";

  return [
    { title: "Giới thiệu Vinahentai – Website đọc truyện hentai 18+ chất lượng" },
    {
      name: "description",
      content:
        "VinaHentai – Trang web đọc truyện 18+ đa dạng thể loại: NTR, MILF, 3D, doujinshi… Truy cập ngay để trải nghiệm nội dung hấp dẫn, không quảng cáo.",
    },
    { property: "og:title", content: "Giới thiệu Vinahentai – Website đọc truyện hentai 18+ chất lượng" },
    {
      property: "og:description",
      content:
        "VinaHentai – Trang web đọc truyện 18+ đa dạng thể loại: NTR, MILF, 3D, doujinshi… Truy cập ngay để trải nghiệm nội dung hấp dẫn, không quảng cáo.",
    },
    { property: "og:url", content: canonicalUrl },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: "Giới thiệu Vinahentai – Website đọc truyện hentai 18+ chất lượng" },
    {
      name: "twitter:description",
      content:
        "VinaHentai – Trang web đọc truyện 18+ đa dạng thể loại: NTR, MILF, 3D, doujinshi… Truy cập ngay để trải nghiệm nội dung hấp dẫn, không quảng cáo.",
    },
  ];
};

export default function GioiThieuPage() {
  const { origin } = useLoaderData<typeof loader>();
  const canonicalUrl = `${origin}/gioi-thieu`;
  const organizationSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Vinahentai",
      url: origin,
      logo: `${origin}/images/logo.webp`,
    }),
    [origin],
  );

  const breadcrumbSchema = useMemo(
    () => ({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Trang chủ",
          item: `${origin}/`,
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Giới thiệu",
          item: canonicalUrl,
        },
      ],
    }),
    [canonicalUrl, origin],
  );

  return (
    <div className="bg-bgc-layer1 text-txt-primary">
      <div className="container-page mx-auto px-4 py-10 lg:py-14">
        <div className="mb-10 flex flex-col gap-6 lg:mb-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4 lg:w-3/5">
            <p className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500/10 to-rose-500/10 px-3 py-1 text-sm font-semibold uppercase tracking-wide text-fuchsia-300">
              Vinahentai.fun
            </p>
            <div className="rounded-2xl border border-white/5 bg-bgc-layer2/60 p-4 text-sm leading-relaxed text-txt-secondary">
              <strong className="text-txt-primary">Cảnh báo 18+:</strong> Đây là trang web 18+, nghiêm cấm người dưới 18 tuổi truy cập.
            </div>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
              Giới thiệu Vinahentai – Website đọc truyện hentai 18+ chất lượng
            </h1>
            <p className="text-lg text-txt-secondary sm:text-xl">
              Nơi bạn khám phá truyện hentai 18+ với trải nghiệm mượt, không quảng cáo làm phiền, cập nhật liên tục và phân loại rõ ràng để tìm nhanh thể loại yêu thích.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/genres/ntr"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-transform hover:translate-y-[-2px]"
              >
                Bắt đầu đọc ngay
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/search/advanced"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-txt-primary transition-colors hover:border-fuchsia-400 hover:text-white"
              >
                Tìm truyện nhanh
              </Link>
            </div>
          </div>
          <div className="grid w-full grid-cols-2 gap-4 rounded-2xl bg-bgc-layer2 p-5 shadow-lg lg:w-2/5">
            <FeatureCard icon={Sparkles} title="Nội dung chọn lọc" desc="Doujinshi, 3D, anime hentai… được duyệt kỹ để giữ chất lượng." />
            <FeatureCard icon={Shield} title="Không quảng cáo" desc="Tập trung đọc, không bị làm phiền bởi pop-up khó chịu." />
            <FeatureCard icon={BookOpen} title="Trải nghiệm mượt" desc="Tải nhanh, tối ưu cho mobile và desktop." />
            <FeatureCard icon={Trophy} title="Cộng đồng nhiệt" desc="Bình luận, theo dõi, leaderboard cập nhật theo tuần." />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.6fr_1fr]">
          <section className="space-y-6 rounded-2xl bg-bgc-layer2 p-6 shadow-lg lg:p-8">
            <header className="space-y-2">
              <h2 className="text-2xl font-bold sm:text-3xl">Sứ mệnh và trải nghiệm</h2>
              <p className="text-txt-secondary">
                Vinahentai hướng tới việc trở thành điểm đến an toàn, nhanh và thân thiện cho người yêu thích hentai 18+ tại Việt Nam.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoCard
                title="Kho truyện đa dạng"
                desc="NTR, MILF, 3D, doujinshi… được phân loại rõ ràng và cập nhật liên tục."
                bullet="Ưu tiên truyện hot, tránh trùng lặp"
              />
              <InfoCard
                title="Tối ưu tốc độ"
                desc="Ảnh nén hợp lý, CDN, lazy-load để đọc mượt trên mạng di động."
                bullet="Giảm giật lag trên mobile"
              />
              <InfoCard
                title="Theo dõi & gợi ý"
                desc="Theo dõi truyện, lưu lịch sử, gợi ý dựa trên thể loại bạn thích."
                bullet="Leaderboard, bình luận realtime"
              />
              <InfoCard
                title="Tôn trọng người dùng"
                desc="Không chèn quảng cáo gây khó chịu; ưu tiên nội dung sạch, nguồn rõ ràng."
                bullet="Có nút báo cáo nội dung vi phạm"
              />
            </div>

            <div className="rounded-xl border border-white/5 bg-bgc-layer1 p-5">
              <h3 className="text-xl font-semibold">Liên kết nhanh các thể loại được tìm nhiều</h3>
              <p className="mt-2 text-txt-secondary">
                Truy cập trực tiếp để xem danh sách truyện mới nhất theo thể loại:
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <GenreLink to="/genres/ntr" label="NTR" />
                <GenreLink to="/genres/milf" label="MILF" />
                <GenreLink to="/genres/3d-hentai" label="3D" />
                <GenreLink to="/genres/doujinshi" label="Doujinshi" />
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl bg-bgc-layer2 p-6 shadow-lg">
              <h3 className="text-xl font-bold">Cam kết nội dung</h3>
              <ul className="mt-3 space-y-3 text-txt-secondary">
                <li>- Chỉ hiển thị truyện dành cho 18+, có cảnh báo rõ ràng.</li>
                <li>- Ưu tiên nguồn gốc minh bạch, hạn chế trùng lặp.</li>
                <li>- Xóa bỏ nội dung vi phạm khi có báo cáo.</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-fuchsia-600 to-rose-600 p-6 text-white shadow-lg">
              <h3 className="text-xl font-bold">Trải nghiệm ngay</h3>
              <p className="mt-2 text-white/90">Khám phá truyện mới, theo dõi tác giả yêu thích và tham gia bình luận.</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  to="/search/advanced"
                  className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/20"
                >
                  Tìm nâng cao
                </Link>
                <Link
                  to="/leaderboard/manga"
                  className="inline-flex items-center gap-2 rounded-lg bg-black/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-black/30"
                >
                  Xem bảng xếp hạng
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof ArrowRight;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-bgc-layer1 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-fuchsia-200">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold">{title}</p>
          <p className="text-sm text-txt-secondary">{desc}</p>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, desc, bullet }: { title: string; desc: string; bullet: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-bgc-layer1 p-4 shadow-sm">
      <h4 className="text-lg font-semibold">{title}</h4>
      <p className="mt-2 text-sm text-txt-secondary">{desc}</p>
      <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-fuchsia-200">
        <Sparkles className="h-4 w-4" />
        {bullet}
      </p>
    </div>
  );
}

function GenreLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-sm font-semibold text-txt-primary transition-colors hover:border-fuchsia-400 hover:text-white"
    >
      <ArrowRight className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
