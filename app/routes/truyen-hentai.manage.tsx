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
            <button className="inline-flex items-center gap-2 text-xs font-semibold text-purple-300 transition hover:text-purple-200">
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-purple-300/70 text-[10px] leading-none">
                i
              </span>
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
                    <li>Dịch giả truyện tranh nghiệp dư thường kiêm luôn 2 công đoạn: Dịch (dịch thoại gốc sang tiếng Việt) và Edit (xóa thoại gốc trên ảnh, chèn bản dịch tiếng Việt vào).</li>
                    <li>Không bắt buộc phải tải Photoshop để edit. Dùng công cụ online là đủ. Photopea là web cho phép edit trực tiếp trên trình duyệt.</li>
                    <li>Bắt buộc cần biết dùng font chữ Việt hóa.</li>
                    <li>Phải xóa sạch chữ gốc trước khi chèn bản dịch. Có nhiều website hỗ trợ xóa text online.</li>
                    <li>Thoại cần rõ ràng, gọn trong bong bóng thoại.</li>
                    <li>Xuất ảnh định dạng WEBP (95–99%) để đăng web.</li>
                    <li>Hoàn thành một chương tử tế là có thể đăng truyện.</li>
                  </ul>
                </div>

                <div className="mb-4 rounded-xl border border-purple-300/20 bg-purple-300/10 p-4 text-purple-200">
                  <div className="mb-2 text-base font-semibold text-purple-300">
                    🚀 Muốn trở thành Dịch Giả chính thức?
                  </div>
                  <div>
                    Chỉ cần đăng đủ 3 truyện có chất lượng dịch ổn định, bạn sẽ được xét cấp role Dịch Giả.
                  </div>
                  <div className="mt-2">Khi đạt role, bạn sẽ nhận được quyền:</div>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>⚡ Truyện được duyệt ngay lập tức – không cần chờ admin</li>
                    <li>💎 Nhận dâm ngọc hàng tuần</li>
                    <li>🎖 Được công nhận là Dịch Giả chính thức trong hệ thống</li>
                    <li>🔥Bạn rất ngầu, là rồng phượng trong loài người</li>
                  </ul>
                  <div className="mt-2">3 truyện đạt chuẩn là bạn đã bước lên một cấp độ mới.</div>
                  <div className="mt-1">Bắt đầu từ chương đầu tiên hôm nay. 💪</div>
                </div>

                <div className="mb-2 text-base font-semibold text-white">📖 HƯỚNG DẪN CHI TIẾT</div>
                <div className="space-y-3">
                  <div>
                    <div className="font-semibold text-white">1️⃣ Dịch giả truyện tranh nghiệp dư là gì?</div>
                    <div>Là người tự làm toàn bộ quy trình:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Dịch nội dung</li>
                      <li>Xóa thoại gốc</li>
                      <li>Chèn bản dịch tiếng Việt</li>
                      <li>Xuất ảnh để đăng web</li>
                    </ul>
                    <div>Không cần kỹ thuật cao. Chỉ cần: Gọn – Dễ đọc – Đúng ngữ cảnh.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">2️⃣ Công cụ chỉnh ảnh (Không cần Photoshop)</div>
                    <div>Bạn không bắt buộc phải dùng Photoshop.</div>
                    <div>👉 Khuyên dùng: Photopea</div>
                    <div>
                      <a
                        href="https://www.photopea.com/"
                        target="_blank"
                        rel="noreferrer"
                        className="text-purple-300 underline hover:text-purple-200"
                      >
                        https://www.photopea.com/
                      </a>
                    </div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Chạy trực tiếp trên trình duyệt</li>
                      <li>Chỉnh ảnh</li>
                      <li>Chèn thoại tiếng Việt</li>
                      <li>Load font tùy chỉnh</li>
                    </ul>
                    <div>Với dịch giả nghiệp dư, Photopea là quá đủ.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">3️⃣ Font là gì và vì sao quan trọng?</div>
                    <div>Font = kiểu chữ.</div>
                    <div>Trong truyện tranh, font ảnh hưởng trực tiếp đến cảm giác đọc.</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Font phù hợp → nhìn gọn gàng, chuyên nghiệp</li>
                      <li>Font sai → lỗi cơ bản</li>
                    </ul>
                    <div>👉 Đừng xem nhẹ font.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">4️⃣ Bộ font cơ bản nên dùng</div>
                    <div>Bạn có thể dùng bộ font truyện tranh TeddyBear (77 font đã Việt hóa):</div>
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
                    <div>Cách cài:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Tải về → Giải nén</li>
                      <li>Chuột phải file font → Install</li>
                      <li>Trong Photopea → bật Load Fonts</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-white">5️⃣ Xóa chữ gốc trong bong bóng thoại</div>
                    <div>Trước khi chèn bản dịch, phải xóa sạch chữ gốc.</div>
                    <div>Cách 1:</div>
                    <div>Xóa thủ công trong Photopea.</div>
                    <div>Cách 2:</div>
                    <div>Dùng web xóa chữ online, ví dụ:</div>
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
                    <div>(Dành cho trường hợp trung bình – khó. Bôi đen chữ cần xóa, AI sẽ redraw, tức là vẽ lại các chi tiết bị mất trong quá trình xóa thoại gốc.)</div>
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
                    <div>(Xóa text hàng loạt trong các bong bóng thoại đơn giản.)</div>
                    <div>Có rất nhiều web tương tự. Thử vài cái, thấy cái nào hợp tay thì dùng.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">6️⃣ Gõ / chèn bản dịch tiếng Việt</div>
                    <div>Khi chèn bản dịch:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Canh đều trong bong bóng thoại</li>
                      <li>Chọn size to nhất có thể để dễ đọc</li>
                      <li>Không che chi tiết quan trọng</li>
                      <li>Ưu tiên dễ đọc hơn “kỹ thuật đẹp”</li>
                    </ul>
                  </div>
                  <div>
                    <div className="font-semibold text-white">7️⃣ Dịch thế nào là ổn?</div>
                    <div>Quan trọng nhất: font chuẩn, edit sạch (nghiệp dư bị lem nhẹ một chút cũng không sao).</div>
                    <div>Về bản dịch, chỉ cần:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Đúng ý gốc</li>
                      <li>Đúng ngữ cảnh</li>
                      <li>Tự nhiên như người Việt nói chuyện</li>
                    </ul>
                    <div>Miễn người đọc không thấy “cấn” là đạt.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">8️⃣ Xuất ảnh sau khi dịch (RẤT QUAN TRỌNG)</div>
                    <div>✅ Định dạng khuyên dùng: WEBP (95–99%)</div>
                    <div>WEBP là định dạng ảnh tối ưu cho website.</div>
                    <div>Ở mức chất lượng 95–99%:</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Chất lượng ảnh gần như giữ nguyên so với ảnh gốc (mắt thường khó phân biệt), nhưng dung lượng có thể giảm khoảng 30–50%.</li>
                      <li>Ảnh nhẹ hơn → load nhanh hơn → đọc mượt hơn (nhất là trên điện thoại).</li>
                    </ul>
                    <div>👉 WEBP 95–99% là lựa chọn rất tốt cho web truyện.</div>
                    <div>❌ Về PNG</div>
                    <div>PNG là định dạng lossless.</div>
                    <ul className="list-disc space-y-1 pl-5">
                      <li>Dung lượng nặng hơn nhiều</li>
                      <li>Không hiển thị đẹp hơn khi đăng web</li>
                    </ul>
                    <div>📌 PNG nên dùng để lưu file gốc. Không nên dùng để đăng truyện nếu muốn tối ưu tốc độ.</div>
                  </div>
                  <div>
                    <div className="font-semibold text-white">🧠 CÂU CHỐT</div>
                    <div>Xóa chữ gọn. Font phù hợp. Dịch tự nhiên. Xuất WEBP 95–99%.</div>
                    <div>Làm được một chương tử tế là bạn đã trở thành dịch giả truyện tranh nghiệp dư rồi.</div>
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
