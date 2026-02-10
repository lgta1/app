import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ProfileMangaUploaded } from "~/components/profile-manga-uploaded";
import { requireLogin } from "@/services/auth.server";
import type { LoaderFunctionArgs } from "react-router-dom";

export async function loader({ request }: LoaderFunctionArgs) {
  // require login so API /api/manga/uploaded can return user-specific data
  await requireLogin(request);
  return null;
}

export const meta = () => [
  { title: "Quản lý truyện - Trang cá nhân" },
  { name: "description", content: "Quản lý truyện bạn đã đăng. Chỉnh sửa, thêm chương hoặc tạo truyện mới." },
];

export default function MangaManage() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[968px] p-4 lg:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-white uppercase">Quản lý truyện</h1>
        <Dialog.Root open={isGuideOpen} onOpenChange={setIsGuideOpen}>
          <Dialog.Trigger asChild>
            <button className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20">
              Hướng dẫn 10 phút trở thành dịch giả
            </button>
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 p-4 backdrop-blur-sm" />
            <Dialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border border-white/10 bg-bgc-layer1 p-6 text-white shadow-lg outline-none">
              <div className="flex items-start justify-between gap-4">
                <Dialog.Title className="text-lg font-semibold">
                  ✍️ HƯỚNG DẪN 10 PHÚT TRỞ THÀNH DỊCH GIẢ TRUYỆN TRANH NGHIỆP DƯ
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/80 transition hover:bg-white/10">
                    Đóng
                  </button>
                </Dialog.Close>
              </div>

              <div className="max-h-[70vh] overflow-y-auto pr-2 text-sm leading-relaxed text-white/90">
                <div className="mb-4">
                  <div className="mb-2 text-base font-semibold text-white">🧾 TÓM TẮT NHANH (ĐỌC 1 PHÚT)</div>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Dịch giả truyện tranh nghiệp dư thường kiêm luôn editor.</li>
                    <li>Không cần Photoshop, dùng công cụ online là đủ.</li>
                    <li>Photopea cho phép chỉnh ảnh và gõ chữ trực tiếp trên web.</li>
                    <li>Font là kiểu chữ, ảnh hưởng lớn đến độ chuyên nghiệp.</li>
                    <li>Nên dùng font truyện tranh đã Việt hóa.</li>
                    <li>Trước khi gõ chữ mới, cần xóa sạch chữ gốc.</li>
                    <li>Có nhiều website hỗ trợ xóa text trên ảnh.</li>
                    <li>Gõ chữ dễ đọc, canh gọn trong bong bóng thoại.</li>
                    <li>Xuất ảnh định dạng WEBP để đăng web.</li>
                    <li>Hoàn thành được một chương tử tế là có thể đăng truyện.</li>
                  </ul>
                </div>

                <div className="mb-2 text-base font-semibold text-white">📖 HƯỚNG DẪN CHI TIẾT</div>
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-white">1️⃣ Dịch giả truyện tranh nghiệp dư là gì?</div>
                    <div>
                      Dịch giả truyện tranh nghiệp dư thường tự làm toàn bộ: dịch nội dung, xóa chữ gốc, gõ chữ mới và xuất ảnh để đăng web. Không cần kỹ thuật cao, chỉ cần làm gọn – dễ đọc – đúng ngữ cảnh.
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">2️⃣ Công cụ chỉnh ảnh: không cần Photoshop</div>
                    <div>Bạn không bắt buộc phải dùng Photoshop. Hiện nay có nhiều công cụ online đủ dùng:</div>
                    <div>
                      Photopea:{" "}
                      <a
                        href="https://www.photopea.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        https://www.photopea.com/
                      </a>
                    </div>
                    <div>Cho phép chỉnh ảnh, gõ chữ và load font trực tiếp trên trình duyệt.</div>
                    <div>Với dịch giả nghiệp dư, Photopea là quá đủ.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">3️⃣ Font là gì và vì sao quan trọng?</div>
                    <div>Font là kiểu chữ. Trong truyện tranh, font ảnh hưởng trực tiếp đến cảm giác đọc. Font phù hợp giúp bản dịch trông gọn gàng và chuyên nghiệp, font sai làm bản dịch nhìn rất ....</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">4️⃣ Bộ font cơ bản nên dùng</div>
                    <div>Bạn có thể dùng bộ font truyện tranh TeddyBear (77 font, đã Việt hóa):</div>
                    <div>
                      👉{" "}
                      <a
                        href="https://drive.google.com/drive/folders/10i9ODtnokxR5yE8jOL96K0EiK0YeIpyt?usp=drive_link"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        https://drive.google.com/drive/folders/10i9ODtnokxR5yE8jOL96K0EiK0YeIpyt?usp=drive_link
                      </a>
                    </div>
                    <div>Cách dùng:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Tải về → giải nén</li>
                      <li>Chuột phải file font → Install</li>
                      <li>Trong Photopea, bật Load Fonts để sử dụng font vừa cài</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-white">5️⃣ Xóa chữ gốc trong bong bóng thoại</div>
                    <div>Trước khi gõ bản dịch, cần xóa sạch chữ gốc. Bạn có thể:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Xóa thủ công trong Photopea</li>
                      <li>Hoặc dùng các website xóa chữ online, ví dụ:</li>
                    </ul>
                    <div>
                      <a
                        href="https://www.pixelcut.ai/cleanup-pictures/remove-text-from-images"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        https://www.pixelcut.ai/cleanup-pictures/remove-text-from-images
                      </a>
                    </div>
                    <div>
                      <a
                        href="https://imagetranslate.ai/text-remover"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        https://imagetranslate.ai/text-remover
                      </a>
                    </div>
                    <div>Ngoài Pixelcut, trên mạng còn rất nhiều web tương tự. Thử vài cái, thấy cái nào hợp tay thì dùng, không cần cố định một công cụ.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">6️⃣ Gõ bản dịch</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Gõ chữ vừa cỡ, nên căn size to nhất có thể cho dễ đọc</li>
                      <li>Canh đều trong bong bóng thoại</li>
                      <li>Không che chi tiết quan trọng của tranh</li>
                      <li>Ưu tiên dễ đọc hơn là “kỹ thuật đẹp”</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-white">7️⃣ Dịch thế nào là ổn?</div>
                    <div>Dịch ổn không phải là dịch từng chữ, mà là:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Đúng ý gốc</li>
                      <li>Đúng ngữ cảnh</li>
                      <li>Đọc tự nhiên như người Việt nói chuyện</li>
                    </ul>
                    <div>Miễn người đọc hiểu và không thấy cấn là đạt.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">9️⃣( Xuất ảnh sau khi dịch (RẤT QUAN TRỌNG)</div>
                    <div>✅ Định dạng khuyên dùng: WEBP – chất lượng 99%</div>
                    <div>WEBP là định dạng ảnh hiện đại, tối ưu cho website.</div>
                    <div>Ở mức 99% chất lượng:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Chỉ mất khoảng 1% chất lượng ảnh (gần như không nhận ra)</li>
                      <li>Giảm ~40% dung lượng so với PNG</li>
                      <li>Ảnh nhẹ hơn → load nhanh hơn → đọc mượt hơn, đặc biệt trên điện thoại.</li>
                    </ul>
                    <div>👉 WEBP 95-99% là lựa chọn cực kỳ tốt cho web truyện.</div>
                    <div>❌ Vì sao KHÔNG nên dùng PNG?</div>
                    <div>PNG là định dạng lưu trữ thông tin ảnh (lossless).</div>
                    <div>Dung lượng nặng gấp khoảng 4 lần WEBP.</div>
                    <div>Chất lượng hiển thị không tốt hơn khi đăng web.</div>
                    <div>Dùng PNG để đăng truyện là thiếu chuyên nghiệp, gây tốn băng thông và load chậm.</div>
                    <div>📌 PNG chỉ nên dùng để lưu file gốc, không dùng để đăng web.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">🧠 Câu chốt</div>
                    <div>Xóa chữ gọn, font phù hợp, dịch tự nhiên, xuất WEBP 99%.</div>
                    <div>Làm được một chương tử tế là bạn đã là dịch giả nghiệp dư rồi.</div>
                  </div>
                </div>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </div>

      <ProfileMangaUploaded />
    </div>
  );
}
