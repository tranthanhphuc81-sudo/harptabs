# Sổ Tab Harmonica

App lưu và tập harptab cho kèn **diatonic 10 lỗ**. Chạy **offline hoàn toàn** (PWA, cài được lên điện thoại), chỉ cần mạng khi dùng **AI** để chuyển ảnh khuông nhạc hoặc tên bài hát thành tab.

## Tính năng

| Phần | Chạy ở đâu | Nội dung |
|---|---|---|
| Thư viện bài | Offline (IndexedDB) | Tìm kiếm không dấu, lọc theo kèn/độ khó, yêu thích, xuất/nhập file `.json` |
| Xem & phát bài | Offline (Web Audio) | Tab tô màu thổi/hút/bend, lời dưới từng nốt, giai điệu giả giọng harp, 8 kiểu beat mẫu (Rock, Ballad, Blues shuffle, Slow rock, Train, Bolero, Cha cha, Valse), đếm vào, chỉnh tempo 40–160%, lặp đoạn |
| Chờ nốt | Offline (micro) | App chỉ chuyển nốt khi bạn thổi đúng cao độ |
| Đổi kèn | Offline | Chuyển bài sang kèn khác, tự chọn lỗ dễ thổi nhất (thuật toán quy hoạch động), giữ giọng gốc hoặc dịch giọng |
| Dò nốt | Offline (micro, YIN) | Hiện lỗ/kỹ thuật đang thổi, kim lệch cent để tập bend |
| Học | Offline | 18 bài: cầm kèn, hơi thở, đơn âm, vibrato, wah, tonguing, bend hút/thổi, overblow, vị trí, blues 12 ô nhịp, bảo quản, lỗi thường gặp, lộ trình 30 ngày, kèm bài tập phát được |
| Nhập AI | Online (Gemini) | Chụp tối đa 4 trang khuông nhạc hoặc nhập tên bài, AI trả giai điệu → app tự xếp tab, beat, ghép lời |

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 50+ unit test: lý thuyết harp, parser, chuyển tab, YIN, AI, worker
npm run build      # xuất ra dist/
npm run preview    # chạy bản build (có service worker offline)
```

Để cài lên điện thoại như app thật, đưa thư mục `dist/` lên một host HTTPS tĩnh bất kỳ (Cloudflare Pages, Netlify, Vercel, GitHub Pages). Mở bằng trình duyệt điện thoại → "Thêm vào màn hình chính". Từ đó app chạy offline.

## Kết nối AI

Có hai cách, chọn trong **Cài đặt → Kết nối AI**:

1. **Gọi thẳng Gemini** (dùng cá nhân): lấy key miễn phí tại https://aistudio.google.com/apikey rồi dán vào app. Key chỉ lưu trên thiết bị đó. Không dùng cách này nếu phát hành app cho người khác.
2. **Qua máy chủ proxy** (khi phát hành): deploy Cloudflare Worker trong thư mục `worker/`. Key nằm trên máy chủ, có giới hạn lượt/ngày theo IP và mã ứng dụng tuỳ chọn.

```bash
cd worker
npm install
npx wrangler login
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put APP_TOKEN          # tuỳ chọn
# bật giới hạn lượt: npx wrangler kv namespace create RATE → dán id vào wrangler.toml
npx wrangler deploy
```

Dán địa chỉ `https://harptabs-ai.<tài-khoản>.workers.dev` vào app.

### Chi phí AI (tham khảo, giá Gemini tháng 10/2026)

Mỗi lần chuyển khoảng 2.500 token vào và 2.000 token ra:

| Model | USD / 1 triệu token (vào / ra) | Mỗi bài |
|---|---|---|
| gemini-3.1-flash-lite | 0,25 / 1,50 | khoảng 95đ |
| gemini-3.5-flash-lite (mặc định) | 0,25 / 1,50 | khoảng 95đ |

Các model 2.5 không còn mở cho tài khoản Gemini mới (10/2026).

App ghi lại số token thực tế của từng lần gọi và hiện chi phí ước tính trong trang Nhập AI và Cài đặt. Bảng giá nằm ở `shared/ai.ts` (`PRICE_TABLE`), sửa khi Google đổi giá. Model đặt trong Cài đặt; nếu dùng proxy thì model phải có trong `ALLOWED_MODELS`.

**Về lời bài hát:** prompt yêu cầu AI không tự viết lời từ trí nhớ (bản quyền). Ở chế độ tên bài, người dùng tự dán lời và AI ghép vào nốt. Ở chế độ ảnh, AI đọc lời in trên bản nhạc người dùng chụp.

## Định dạng tab

Mỗi bài lưu dưới dạng văn bản, gõ tay được:

```
# Điệp khúc
4 4 -4 4 7 -7:2
Hap-py birth-day to you
6:0.75 6:0.25 -6 6 -8 7:2 r
```

- `4` thổi, `-4` hút, `-3'` bend nửa cung, `-3''` bend 1 cung, `8'` bend thổi, `6o` overblow, `-7o` overdraw
- `:2` = 2 phách, `:0.5` hoặc `:1/2` = nửa phách, `r` = nghỉ, `|` vạch nhịp (bỏ qua)
- Dòng dưới dòng tab là lời; gạch nối tách âm tiết, `_` là nốt luyến
- Chấp nhận `+4` và các dấu nháy copy từ web (’ ″)

## Cấu trúc

```
src/lib/harp.ts        Lý thuyết kèn Richter, 12 tông, bend, overblow, tên nốt
src/lib/tabText.ts     Parser / serializer định dạng tab
src/lib/converter.ts   Chọn lỗ tối ưu (Viterbi), tìm kèn hợp nhất, đổi kèn
src/lib/ai.ts          Gọi AI, nén ảnh, chuyển kết quả AI → tab
src/lib/db.ts          IndexedDB (Dexie), sao lưu / khôi phục
src/audio/             Tổng hợp âm, beat mẫu, bộ lập lịch phát, dò cao độ YIN
src/pages/             Thư viện, Xem bài, Sửa bài, Nhập AI, Học, Dò nốt, Cài đặt
src/data/              Bài mẫu (public domain) và nội dung bài học
shared/ai.ts           Prompt, JSON schema, kiểm tra kết quả, bảng giá — dùng chung app & worker
worker/                Cloudflare Worker proxy
```

## Đóng gói thành app Android/iOS (tuỳ chọn)

PWA đã đủ để dùng offline. Nếu muốn lên store, bọc bằng Capacitor:

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "So Tab Harmonica" vn.harptabs.app --web-dir dist
npm run build && npx cap add android && npx cap open android
```
