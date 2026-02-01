import { Link } from "react-router-dom";
import { useMediaQuery } from "~/hooks/use-media-query";
import { getPosterVariantForContext } from "~/utils/poster-variants.utils";

import type { Route } from "./+types/truyen-hentai._index";

import type { MangaType } from "~/database/models/manga.model";

type PillarManga = Pick<MangaType, "id" | "slug" | "title" | "poster" | "updatedAt" | "createdAt" | "genres" | "userStatus" | "chapters"> & {
  latestChapterTitle?: string | null;
};

export async function loader({ request }: Route.LoaderArgs) {
  // Dynamic imports keep server-only code out of client bundles.
  const [leaderboardQuery, mangaQuery] = await Promise.all([
    import("@/queries/leaderboad.query"),
    import("@/queries/manga.query"),
  ]);

  const { getLeaderboard } = leaderboardQuery as any;
  const { getNewManga } = mangaQuery as any;

  const { getCanonicalOrigin } = await import("~/.server/utils/canonical-url");
  const origin = getCanonicalOrigin(request as any);

  const [weeklyRaw, monthlyRaw, updatedRaw] = await Promise.all([
    getLeaderboard("weekly"),
    getLeaderboard("monthly"),
    // "last_chapter_updated_at" is not a stored field in current schema; getNewManga uses updatedAt desc.
    getNewManga(1, 12),
  ]);

  const weekly = (Array.isArray(weeklyRaw) ? weeklyRaw : []).slice(0, 20);
  const monthly = (Array.isArray(monthlyRaw) ? monthlyRaw : []).slice(0, 30);

  // Section 1: 20 featured = top weekly (10) + top monthly (10) with no duplicate slug.
  const seen = new Set<string>();
  const featured: PillarManga[] = [];

  for (const it of weekly) {
    const slug = String((it as any)?.slug ?? "").toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    featured.push(it as any);
    if (featured.length >= 10) break;
  }

  for (const it of monthly) {
    const slug = String((it as any)?.slug ?? "").toLowerCase();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    featured.push(it as any);
    if (featured.length >= 20) break;
  }

  // If monthly has too many overlaps, keep filling from the remaining monthly pool.
  if (featured.length < 20) {
    for (const it of monthly.slice(10)) {
      const slug = String((it as any)?.slug ?? "").toLowerCase();
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      featured.push(it as any);
      if (featured.length >= 20) break;
    }
  }

  // Section 2: recently updated, only stories with real content (chapters > 0), no pagination.
  const updatedCandidates = (updatedRaw?.manga ?? []) as any[];
  const updated = updatedCandidates.filter((m) => Number((m as any)?.chapters ?? 0) > 0).slice(0, 10) as PillarManga[];

  return {
    origin,
    featured,
    updated,
  };
}

export const meta: Route.MetaFunction = ({ data }) => {
  const origin = data?.origin ?? "";
  const canonical = origin ? `${origin}/truyen-hentai` : "/truyen-hentai";

  const title = "Truyện hentai – Đọc hentai truyện vietsub miễn phí | Vinahentai";
  const description =
    "Trung tâm đọc truyện hentai vietsub miễn phí tại Vinahentai: chọn lọc truyện nổi bật theo tuần/tháng, cập nhật chương mới nhanh, phân loại theo thể loại để bạn tìm đúng gu dễ dàng. Không quảng cáo gây khó chịu.";

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:url", content: canonical },
  ];
};

export default function TruyenHentaiPillar({ loaderData }: Route.ComponentProps) {
  const { featured, updated, origin } = loaderData;

  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const canonicalUrl = `${origin}/truyen-hentai`;

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "Truyện hentai là gì?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Truyện hentai là nội dung truyện tranh/ảnh minh hoạ 18+ (thường từ Nhật Bản) tập trung vào yếu tố người lớn. Tại Vinahentai, bạn có thể đọc hentai truyện vietsub theo từng thể loại và cập nhật chương mới thường xuyên.",
        },
      },
      {
        "@type": "Question",
        name: "Có cần đăng ký khi đọc truyện hentai không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Bạn có thể đọc truyện hentai miễn phí mà không cần đăng ký. Tuy nhiên, đăng ký giúp bạn tham gia bình luận, theo dõi truyện và trải nghiệm các tính năng cộng đồng tiện hơn.",
        },
      },
      {
        "@type": "Question",
        name: "Website có quảng cáo không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Vinahentai ưu tiên trải nghiệm đọc mượt và hạn chế tối đa quảng cáo gây khó chịu (pop-up, chuyển hướng). Mục tiêu là giúp bạn đọc truyện hentai tập trung, không bị làm phiền.",
        },
      },
      {
        "@type": "Question",
        name: "Truyện có vietsub không?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Phần lớn nội dung trên Vinahentai được dịch vietsub để bạn dễ theo dõi. Một số truyện có thể đang trong quá trình hoàn thiện bản dịch và sẽ được cập nhật liên tục.",
        },
      },
    ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Trang chủ", item: `${origin}/` },
      { "@type": "ListItem", position: 2, name: "Truyện hentai", item: canonicalUrl },
    ],
  };

  return (
    <div className="container-page mx-auto px-4 py-10">
      {/* Breadcrumb (UX) */}
      <nav className="mb-4 text-sm text-txt-secondary">
        <Link to="/" className="hover:text-white">
          Trang chủ
        </Link>
        <span className="mx-2">›</span>
        <span className="text-txt-primary">Truyện hentai</span>
      </nav>

      {/* H1 + Intro */}
      <header className="max-w-3xl space-y-4">
        <h1 className="text-txt-primary text-4xl font-semibold leading-tight">
          Truyện hentai – Đọc hentai truyện vietsub miễn phí
        </h1>
        <div className="h-1 w-28 rounded-full bg-gradient-to-r from-lav-600 to-lav-500" />
        <div className="text-base leading-relaxed text-txt-secondary space-y-3">
          <p className="rounded-2xl border border-white/5 bg-bgc-layer2/60 p-4 text-sm leading-relaxed text-txt-secondary">
            <strong className="text-txt-primary">Cảnh báo 18+:</strong> Đây là trang web 18+, nghiêm cấm người dưới 18 tuổi truy cập.
          </p>
          <p>
            Truyện hentai là dòng truyện 18+ (thường là manga/ảnh minh hoạ) tập trung vào yếu tố người lớn và được phân
            loại rất rõ theo sở thích như NTR, MILF, 3D, học đường, giả tưởng… Nếu bạn đang tìm nơi <strong>đọc truyện hentai</strong>
            nhanh, dễ lọc đúng gu và cập nhật đều, thì trang này là trung tâm tổng hợp dành cho bạn.
          </p>
          <p>
            Tại Vinahentai, bạn có thể đọc <strong>hentai truyện</strong> vietsub miễn phí, xem truyện nổi bật theo tuần/tháng và
            theo dõi các truyện mới cập nhật mà không cần lướt qua quá nhiều danh sách. Các liên kết bên dưới giúp bạn đi thẳng
            tới đúng trang truyện và đúng thể loại, tối ưu thời gian tìm kiếm.
          </p>
        </div>
      </header>

      {/* Section 1: Featured */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-txt-primary text-2xl font-semibold">Truyện hentai nổi bật</h2>
          <span className="text-sm text-txt-secondary">Top tuần + Top tháng (không trùng)</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {featured.map((m) => (
            <Link
              key={m.slug}
              to={`/truyen-hentai/${m.slug}`}
              className="group rounded-2xl border border-white/5 bg-bgc-layer2/80 p-3 transition hover:-translate-y-1 hover:border-lav-500"
            >
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                {(() => {
                  const variant = getPosterVariantForContext(m, isDesktop ? "cardDesktop" : "cardMobile");
                  return (
                <img
                  src={variant?.url || m.poster}
                  alt={m.title}
                  loading="lazy"
                  decoding="async"
                  width={variant?.width}
                  height={variant?.height}
                  className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]"
                />
                  );
                })()}
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-txt-primary group-hover:text-white">
                {m.title}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 2: Updated */}
      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-txt-primary text-2xl font-semibold">Truyện hentai mới cập nhật</h2>
          <span className="text-sm text-txt-secondary">Không phân trang</span>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {updated.map((m) => (
            <Link
              key={m.slug}
              to={`/truyen-hentai/${m.slug}`}
              className="group rounded-2xl border border-white/5 bg-bgc-layer2/80 p-3 transition hover:-translate-y-1 hover:border-lav-500"
            >
              <div className="aspect-[3/4] w-full overflow-hidden rounded-xl bg-black">
                {(() => {
                  const variant = getPosterVariantForContext(m, isDesktop ? "cardDesktop" : "cardMobile");
                  return (
                <img
                  src={variant?.url || m.poster}
                  alt={m.title}
                  loading="lazy"
                  decoding="async"
                  width={variant?.width}
                  height={variant?.height}
                  className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]"
                />
                  );
                })()}
              </div>
              <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-txt-primary group-hover:text-white">
                {m.title}
              </h3>
            </Link>
          ))}
        </div>
      </section>

      {/* Section 3: Popular genres (internal links) */}
      <section className="mt-10 rounded-2xl border border-white/5 bg-bgc-layer2/80 p-6">
        <h2 className="text-txt-primary text-2xl font-semibold">Thể loại hentai phổ biến</h2>
        <p className="mt-2 text-txt-secondary">
          Chọn nhanh theo gu của bạn. Các link dẫn tới trang thể loại chuẩn tại /genres.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {[
            { to: "/genres/ntr", label: "truyện hentai NTR" },
            { to: "/genres/milf", label: "hentai MILF" },
            { to: "/genres/3d-hentai", label: "hentai 3D" },
            { to: "/genres/doujinshi", label: "truyện hentai Doujinshi" },
            { to: "/genres/hoc-duong", label: "hentai học đường" },
            { to: "/genres/anh-cosplay", label: "hentai ảnh cosplay" },
          ].map((g) => (
            <Link
              key={g.to}
              to={g.to}
              className="rounded-full border border-white/10 bg-bgc-layer1 px-4 py-2 text-sm font-semibold text-txt-primary transition hover:border-lav-500 hover:text-white"
            >
              {g.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Extended SEO content */}
      <section className="mt-10 max-w-4xl text-txt-secondary space-y-4 leading-relaxed">
        <h2 className="text-txt-primary text-2xl font-semibold">Đọc truyện hentai tại Vinahentai có gì khác?</h2>
        <p>
          Nhu cầu đọc truyện hentai tại Việt Nam vài năm gần đây tăng mạnh vì người dùng muốn tìm nội dung đúng gu và đọc mượt
          trên điện thoại. Thay vì phải lục từng trang lẻ, một hub như /truyen-hentai giúp bạn đi thẳng vào các truyện nổi bật,
          truyện mới cập nhật và các thể loại phổ biến. Với cách tổ chức này, Google cũng hiểu rõ đây là trang trung tâm cho từ
          khoá “truyện hentai”, đồng thời người đọc có thêm lối tắt để khám phá nội dung.
        </p>
        <p>
          Về xu hướng, các nhóm thể loại như NTR, MILF, 3D, doujinshi, học đường hay giả tưởng thường thay đổi theo thời điểm.
          Có người thích cốt truyện kịch tính, có người chỉ cần tranh đẹp và nhịp đọc nhanh. Vì vậy Vinahentai ưu tiên phân loại
          rõ ràng, giúp bạn chuyển từ trang hub sang trang thể loại chỉ với một cú click. Từ trang thể loại, bạn tiếp tục đi tới
          từng truyện và từng chương.
        </p>
        <p>
          Một điểm được người dùng đánh giá cao là trải nghiệm: tốc độ tải nhanh, giao diện tối ưu mobile và hạn chế tối đa quảng
          cáo gây khó chịu. Ngoài việc đọc truyện, Vinahentai còn có các tính năng cộng đồng như bình luận, theo dõi, bảng xếp hạng
          và hệ thống waifu/triệu hồi (gacha) mang tính giải trí riêng—giúp bạn vừa đọc vừa tương tác theo cách khác biệt so với
          các trang tổng hợp thông thường.
        </p>
        <p>
          Nếu bạn mới bắt đầu, hãy thử đi theo luồng đơn giản: mở danh sách “nổi bật” để xem trend tuần/tháng, sau đó chọn một thể
          loại bạn thích, rồi lưu lại vài truyện để theo dõi. Với người đọc lâu năm, mục “mới cập nhật” sẽ là nơi tiết kiệm thời gian
          nhất để không bỏ lỡ chương mới.
        </p>
      </section>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
    </div>
  );
}
