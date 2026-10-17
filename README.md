# Sổ Tab Harmonica

App lưu và tập harptab cho kèn **diatonic 10 lỗ**, **chromatic 12 / 16 lỗ** và **tremolo 21 / 24 lỗ** (kiểu châu Á). Chạy **offline hoàn toàn** (PWA, cài được lên điện thoại, có bản APK Android), chỉ cần mạng khi dùng **AI** để chuyển ảnh khuông nhạc hoặc tên bài hát thành tab.

Bản đang chạy: https://harptabs.pages.dev

## Tính năng

| Phần | Chạy ở đâu | Nội dung |
|---|---|---|
| Thư viện bài | Offline (IndexedDB) | 51 bài mẫu, tìm kiếm không dấu, lọc theo loại kèn / tông / độ khó, sắp xếp A–Z đúng chữ tiếng Việt, yêu thích, xoá nhiều bài, xuất/nhập file `.json` |
| Giao diện | Offline | 6 bảng màu (Thép, Gỗ ấm, Blues đêm, Rừng thông, Hoa đào, Tương phản cao), mỗi bảng có bản sáng và tối, chọn sáng / tối / theo máy trong Cài đặt. Màu nằm ở `src/lib/themes.ts`; test kiểm tra độ tương phản chữ theo chuẩn WCAG cho mọi bảng |
| Giữ an toàn dữ liệu | Offline | Tự lưu nháp khi sửa bài và quét nhạc (tắt app hay tải lại vẫn mở lại được), nhắc xuất file sao lưu khi có 10 bài mới / sửa hoặc 30 ngày chưa sao lưu, Cài đặt hiện bộ nhớ đang dùng và cho bật "giữ dữ liệu lâu dài". Có bản mới thì app hiện nút **Cập nhật**, không tự tải lại giữa chừng. Giữ màn hình sáng khi đang phát bài, chờ nốt, dò nốt (tắt được trong Cài đặt) |
| Xem & phát bài | Offline (Web Audio) | Tab tô màu thổi/hút/bend, lời dưới từng nốt, 9 nhạc cụ giai điệu (harmonica, piano, guitar, sáo trúc, violin, accordion, organ, sax, huýt sáo), 20 kiểu beat (rock, ballad, bolero, cha cha, valse, bossa…), tự chọn kiểu nhịp và nhạc cụ hợp với bài, đệm hợp âm, đếm vào, chỉnh tempo 40–160%, lặp đoạn |
| Đệm hát | Offline | Tắt giai điệu, chỉ còn nhạc đệm (guitar gõ bo, guitar quạt chả, piano, ban nhạc) để hát theo; tuỳ chọn vuốt, rung, lắc |
| Chờ nốt | Offline (micro) | App chỉ chuyển nốt khi bạn thổi đúng cao độ. Tập xong hiện điểm (thổi đúng ngay + độ chuẩn cao độ), các nốt hay lạc để tập lại từ đó, lưu điểm cao nhất của từng bài |
| Chia sẻ bài | Offline | Gửi bài qua menu chia sẻ của điện thoại (Zalo, Messenger…) bằng một đường link chứa cả bài; người nhận bấm link → xem trước → thêm vào thư viện. Dữ liệu nằm sau dấu `#` nên không qua máy chủ |
| Đổi kèn | Offline | Chuyển bài sang kèn khác, tự chọn lỗ dễ thổi nhất (thuật toán quy hoạch động), giữ giọng gốc hoặc dịch giọng |
| Dò nốt | Offline (micro, YIN) | Hiện lỗ/kỹ thuật đang thổi, kim lệch cent để tập bend |
| Học | Offline | 23 bài: cầm kèn, hơi thở, đơn âm, vibrato, wah, tonguing, bend hút/thổi, overblow, vị trí, blues 12 ô nhịp, bảo quản, lỗi thường gặp, lộ trình 30 ngày, kèm bài tập phát được |
| Dán tab từ mạng | Offline | Copy tab trên web (`4 -4`, `4↑ 4↓`, `B4 D4`, `-3b`, `(4)`…) dán vào, app tự nhận dòng tab, lời, tên bài, tông kèn và chuyển sang định dạng của app |
| File nhạc | Offline | Nhập MIDI (`.mid`, `.kar` karaoke có lời), MusicXML (`.musicxml`, `.mxl`) → tab chính xác tuyệt đối; ảnh `.jpg/.png` và `.pdf` được chuyển sang Quét khuông nhạc |
| Quét khuông nhạc | Offline | Chụp ảnh hoặc chọn PDF bản nhạc in (khoá Sol, một bè), máy tự đọc cao độ + trường độ + vạch nhịp ngay trên điện thoại, đọc tên bài (OCR tiếng Việt), hiện số lỗ trên từng nốt để chạm vào sửa |
| Đối chiếu bản thu | Offline (micro / file âm thanh) | Hát, thổi hoặc mở bài gốc có nhạc đệm (MP3, M4A, WAV), app dò giai điệu và gợi ý sửa những nốt quét sai |
| Nhập AI | Online (Gemini) | Nhờ AI đọc ảnh hoặc nhớ bài theo tên → app tự xếp tab, beat, ghép lời. Đọc ảnh bằng AI còn hay sai cao độ, bản in nên dùng Quét khuông nhạc |

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # ~450 test: lý thuyết harp, parser, chuyển tab, YIN, OMR, AI, worker, giao diện
npm run lint       # ESLint (gồm luật react-hooks)
npm run typecheck
npm run build      # xuất ra dist/
npm run preview    # chạy bản build (có service worker offline)
```

Mỗi lần push lên `main`, GitHub Actions chạy lint + test + build rồi deploy `dist/` lên Cloudflare Pages (`.github/workflows/deploy-pages.yml`). Mở https://harptabs.pages.dev bằng trình duyệt điện thoại → "Thêm vào màn hình chính" là app chạy offline.

Các phần nặng (quét nhạc, đọc file, PDF, OCR) chỉ tải khi dùng. Bộ đọc PDF và OCR được lưu lại sau lần dùng đầu, nên muốn dùng offline thì mở thử một lần khi có mạng.

## Quét khuông nhạc (offline)

`src/lib/omr.ts` đọc bản nhạc theo luật, giống cách người học tự đọc:

1. Làm phẳng nền ảnh chụp, co giãn ảnh để khoảng cách dòng kẻ ≈ 13,5 px.
2. Tìm 5 dòng kẻ (hàng điểm ảnh tối dài), xoá dòng kẻ.
3. Tìm đầu nốt (đốm cỡ một khe, phải có thân nốt); nốt trắng nhận qua lòng rỗng.
4. Cao độ = vị trí đầu nốt so với dòng dưới cùng (khoá Sol: dòng dưới = Mi 4), cộng hoá biểu đầu khuông.
5. Trường độ: đầu rỗng/đặc, số móc ở đầu thân, chấm dôi. Vạch nhịp chia ô; ô thiếu phách được chèn dấu lặng.

Chưa đọc: khoá Fa, hợp âm, dấu hoá bất thường giữa bài, liên ba, dấu nhắc lại, lời bài hát, chữ viết tay. Ảnh nghiêng nhiều cũng chưa xử lý.
Kết quả hiện trên ảnh để người dùng sửa từng nốt trước khi lưu.

## Kết nối AI

Có hai cách, chọn trong **Cài đặt → Kết nối AI**:

1. **Gọi thẳng Gemini** (dùng cá nhân): lấy key miễn phí tại https://aistudio.google.com/apikey rồi dán vào app. Key chỉ lưu trên thiết bị đó. Không dùng cách này nếu phát hành app cho người khác.
2. **Qua máy chủ proxy** (khi phát hành, mặc định): Cloudflare Worker trong thư mục `worker/`, tự deploy khi `worker/` hoặc `shared/` thay đổi. Key nằm trên máy chủ. Worker có:
   - giới hạn lượt/ngày theo IP (KV `RATE`, `DAILY_LIMIT`), giữ lượt trước khi gọi AI và trả lại nếu Gemini lỗi;
   - chặn gọi dồn dập 5 lượt/phút/IP (binding `BURST`);
   - chặn trang web có origin ngoài `ALLOWED_ORIGINS` (403);
   - giới hạn dung lượng gửi lên 14 MB, đọc theo luồng nên không lách được bằng cách bỏ `content-length`;
   - mã ứng dụng `APP_TOKEN` tuỳ chọn.

   App là PWA công khai nên `APP_TOKEN` và kiểm tra origin không giữ bí mật được với người cố tình; giới hạn lượt là lớp bảo vệ chính. Nên đặt thêm hạn mức chi tiêu cho key trên Google AI Studio.

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


**Kèn tremolo (21 / 24 lỗ, kiểu châu Á):** mỗi số lỗ chỉ có một nốt — lỗ lẻ thổi, lỗ chẵn hút
(kèn C: thổi G3 C4 E4 G4 C5 E5 G5 C6 E6 G6 C7 E7, hút D4 F4 A4 B4 D5 F5 A5 B5 D6 F6 A6 B6;
theo bảng [Tremolo harmonica — Wikipedia](https://en.wikipedia.org/wiki/Tremolo_harmonica)).
App ghi lỗ hút là `-4` để tô màu, nhưng gõ / dán `4` cũng được. Kèn không có nốt thăng giáng, không bend;
đổi bài sang tremolo thì nên chọn "dịch giọng cho dễ thổi". Một số hãng xếp nốt khác bảng này — nếu kèn của bạn khác, hãy so với bảng in kèm kèn.

## Cấu trúc

```
src/lib/harp.ts        Lý thuyết kèn Richter, 12 tông, bend, overblow, tên nốt
src/lib/tabText.ts     Parser / serializer định dạng tab
src/lib/converter.ts   Chọn lỗ tối ưu (Viterbi), tìm kèn hợp nhất, đổi kèn
src/lib/ai.ts          Gọi AI, nén ảnh, chuyển kết quả AI → tab
src/lib/omr.ts         Đọc khuông nhạc offline (OMR theo luật)
src/lib/tabImport.ts   Nhận tab dán từ mạng (nhiều kiểu ký hiệu) → định dạng của app
src/lib/musicFile.ts   Đọc MIDI / MusicXML → tab
src/lib/pdf.ts         Vẽ trang PDF thành ảnh để quét (pdf.js, tải khi cần)
src/lib/titleOcr.ts    Đọc tên bài trên bản nhạc (Tesseract, tải khi cần)
src/lib/audioAlign.ts  Dò giai điệu bản thu và đối chiếu với bản quét
src/lib/db.ts          IndexedDB (Dexie), sao lưu / khôi phục (kiểm tra từng trường khi nhập)
src/audio/             Tổng hợp âm, beat mẫu, bộ lập lịch phát, dò cao độ YIN
src/pages/             Thư viện, Xem bài, Sửa bài, Nhập bài (quét / AI), Học, Dò nốt, Cài đặt
src/data/              Bài mẫu (public domain) và nội dung bài học
shared/ai.ts           Prompt, JSON schema, kiểm tra kết quả, bảng giá — dùng chung app & worker
worker/                Cloudflare Worker proxy
```

## App Android

Bản Android là **TWA** (Trusted Web Activity) do Bubblewrap tạo: mở https://harptabs.pages.dev toàn màn hình qua Chrome, nên nội dung tự cập nhật theo mỗi lần deploy Pages, không cần build lại APK.

- Cấu hình: `android/twa-manifest.json`. Workflow `build-apk.yml` chỉ chạy khi file này đổi (hoặc bấm chạy tay), rồi đăng APK lên GitHub Releases.
- Cần secret `ANDROID_KEYSTORE_BASE64` và `ANDROID_KEYSTORE_PASSWORD`. Vân tay SHA-256 của khoá ký phải khớp với `public/.well-known/assetlinks.json`, nếu không app sẽ hiện thanh địa chỉ trình duyệt.
