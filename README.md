# Sổ Tab Harmonica

App lưu và tập harptab cho kèn **diatonic 10 lỗ**, **chromatic 12 / 16 lỗ** và **tremolo 21 / 24 lỗ** (kiểu châu Á). Chạy **offline hoàn toàn** (PWA, cài được lên điện thoại, có bản APK Android), chỉ cần mạng khi dùng **AI** để chuyển ảnh khuông nhạc hoặc tên bài hát thành tab.

Bản đang chạy: https://harptabs.pages.dev

Trang giới thiệu chung cả năm app (mở app, tải APK mới nhất, hướng dẫn cài): https://sotab.pages.dev — mã trong `landing/`, tự deploy cùng các app.

Cùng mã nguồn này còn build ra bốn app khác cho [sáo](#sổ-tab-sáo), [kalimba](#sổ-tab-kalimba), [guitar / ukulele](#sổ-tab-guitar) và [pianica](#sổ-tab-pianica):

| App | Nhạc cụ | Bản web | APK Android |
|---|---|---|---|
| Sổ Tab Harmonica | Harmonica diatonic, chromatic, tremolo | https://harptabs.pages.dev | [Bản mới nhất `apk-v…`](https://github.com/tranthanhphuc81-sudo/harptabs/releases/latest) |
| Sổ Tab Sáo | Sáo dọc soprano / alto / tenor / bass, sáo trúc 6 lỗ | https://sotabsao.pages.dev | [Releases `sao-apk-v…`](https://github.com/tranthanhphuc81-sudo/harptabs/releases?q=sao-apk&expanded=true) |
| Sổ Tab Kalimba | Kalimba 17, 10, 8 phím | https://sotabkalimba.pages.dev | [Releases `kalimba-apk-v…`](https://github.com/tranthanhphuc81-sudo/harptabs/releases?q=kalimba-apk&expanded=true) |
| Sổ Tab Guitar | Guitar 6 dây, ukulele 4 dây | https://sotabguitar.pages.dev | [Releases `guitar-apk-v…`](https://github.com/tranthanhphuc81-sudo/harptabs/releases?q=guitar-apk&expanded=true) |
| Sổ Tab Pianica | Kèn pianica (melodica) 32 / 37 phím | https://sotabpianica.pages.dev | [Releases `pianica-apk-v…`](https://github.com/tranthanhphuc81-sudo/harptabs/releases?q=pianica-apk&expanded=true) |

Cả năm app có chung thư viện bài, phát nhạc đệm, karaoke, chia sẻ bài, nhập MIDI / MusicXML, quét khuông nhạc, dò nốt, tập ngẫu hứng, chạy offline. Phần riêng của từng app nằm ở các mục bên dưới.

## Tính năng

| Phần | Chạy ở đâu | Nội dung |
|---|---|---|
| Thư viện bài | Offline (IndexedDB) | 51 bài mẫu, tìm kiếm không dấu, lọc theo loại kèn / tông / độ khó, sắp xếp A–Z đúng chữ tiếng Việt, yêu thích, xoá nhiều bài, xuất/nhập file `.json` |
| Giao diện | Offline | 6 bảng màu (Thép, Gỗ ấm, Blues đêm, Rừng thông, Hoa đào, Tương phản cao), mỗi bảng có bản sáng và tối, chọn sáng / tối / theo máy trong Cài đặt. Màu nằm ở `src/lib/themes.ts`; test kiểm tra độ tương phản chữ theo chuẩn WCAG cho mọi bảng |
| Giữ an toàn dữ liệu | Offline | Tự lưu nháp khi sửa bài và quét nhạc (tắt app hay tải lại vẫn mở lại được), nhắc xuất file sao lưu khi có 10 bài mới / sửa hoặc 30 ngày chưa sao lưu, Cài đặt hiện bộ nhớ đang dùng và cho bật "giữ dữ liệu lâu dài". Có bản mới thì app hiện nút **Cập nhật**, không tự tải lại giữa chừng. Giữ màn hình sáng khi đang phát bài, chờ nốt, dò nốt (tắt được trong Cài đặt) |
| Xem & phát bài | Offline (Web Audio) | Tab tô màu thổi/hút/bend, lời dưới từng nốt, 50 nhạc cụ giai điệu chia 8 nhóm (vui nhộn: mèo kêu, vịt kêu, chim hót, ếch kêu, chút chít, bong bóng, laser; độc lạ: theremin và cưa nhạc lướt liền giữa các nốt, 8-bit, kazoo, robot "wah", radio xưa, ly thủy tinh, chuông gió, giọt nước, vũ trụ; dân tộc thêm đàn đá, đàn T'rưng, khèn; harmonica, tremolo; dân tộc Việt: sáo trúc, đàn bầu, đàn tranh, đàn nhị, kèn bầu, đàn nguyệt; kèn & sáo: huýt sáo, ocarina, sax, trumpet, clarinet; đàn dây: guitar, ukulele, banjo, đàn hạc, violin, cello; phím: piano, piano điện, accordion, organ, synth; gõ & giọng: marimba, vibraphone, kalimba, trống thép, hộp nhạc, hợp xướng), 20 kiểu beat (rock, ballad, bolero, cha cha, valse, bossa…), tự chọn kiểu nhịp và nhạc cụ hợp với bài, đệm hợp âm, đếm vào, chỉnh tempo 40–160%, lặp đoạn |
| Đệm hát | Offline | Tắt giai điệu, chỉ còn nhạc đệm (guitar gõ bo, guitar quạt chả, piano, ban nhạc) để hát theo; tuỳ chọn vuốt, rung, lắc |
| Chờ nốt | Offline (micro) | App chỉ chuyển nốt khi bạn thổi đúng cao độ. Tập xong hiện điểm (thổi đúng ngay + độ chuẩn cao độ), các nốt hay lạc để tập lại từ đó, lưu điểm cao nhất của từng bài |
| Chia sẻ bài | Offline | Gửi bài qua menu chia sẻ của điện thoại (Zalo, Messenger…) bằng một đường link chứa cả bài; người nhận bấm link → xem trước → thêm vào thư viện. Dữ liệu nằm sau dấu `#` nên không qua máy chủ |
| Đổi kèn | Offline | Chuyển bài sang kèn khác, tự chọn lỗ dễ thổi nhất (thuật toán quy hoạch động), giữ giọng gốc hoặc dịch giọng |
| Xem cho kèn | Offline | Mặc định mỗi bài tự hiện cho kèn dễ chơi nhất mà vẫn giữ giọng bài (ít nốt thiếu / overblow / bend / bấm gạt nhất; ngang nhau thì giữ kèn của bài, rồi kèn phổ biến, kèn C). Chọn tay "Bản gốc" hoặc loại kèn + tông thì tab xếp lại ngay mà bài gốc không đổi, app nhớ lựa chọn cho mọi bài. "Dễ thổi nhất" chỉ dịch giọng khi bớt được nốt khó; báo số nốt không có / cần bend, overblow. Lưu thành bài mới nếu muốn giữ |
| Dò nốt | Offline (micro, YIN) | Hiện lỗ/kỹ thuật đang thổi, kim lệch cent để tập bend |
| Học | Offline | 23 bài: cầm kèn, hơi thở, đơn âm, vibrato, wah, tonguing, bend hút/thổi, overblow, vị trí, blues 12 ô nhịp, bảo quản, lỗi thường gặp, lộ trình 30 ngày, kèm bài tập phát được |
| Dán tab từ mạng | Offline | Copy tab trên web (`4 -4`, `4↑ 4↓`, `B4 D4`, `-3b`, `(4)`…) dán vào, app tự nhận dòng tab, lời, tên bài, tông kèn và chuyển sang định dạng của app |
| File nhạc | Offline | Nhập MIDI (`.mid`, `.kar` karaoke có lời), MusicXML (`.musicxml`, `.mxl`) → tab chính xác tuyệt đối; ảnh `.jpg/.png` và `.pdf` được chuyển sang Quét khuông nhạc |
| Quét khuông nhạc | Offline | Chụp ảnh hoặc chọn PDF bản nhạc in (khoá Sol hoặc khoá Fa, một bè; mở dấu nhắc lại ‖: :‖; tên hợp âm in trên khuông thành hợp âm đệm), máy tự đọc cao độ + trường độ + vạch nhịp ngay trên điện thoại, đọc tên bài (OCR tiếng Việt), hiện số lỗ trên từng nốt để chạm vào sửa |
| Bản thu → tab | Offline | Thu âm trong app hoặc chọn file (tự hát / ngân nga / thổi kèn, hoặc bài hát MP3): máy dò giai điệu, đoán tempo, làm tròn theo phách rồi xếp tab cho loại kèn đã chọn. Bài có nhạc đệm chỉ là bản nháp |
| Đối chiếu bản thu | Offline (micro / file âm thanh) | Hát, thổi hoặc mở bài gốc có nhạc đệm (MP3, M4A, WAV), app dò giai điệu và gợi ý sửa những nốt quét sai |
| Nhập AI | Online (Gemini) | Nhờ AI đọc ảnh hoặc nhớ bài theo tên → app tự xếp tab, beat, ghép lời. Đọc ảnh bằng AI còn hay sai cao độ, bản in nên dùng Quét khuông nhạc |

## Sổ Tab Sáo

Bản web: https://sotabsao.pages.dev · APK: gói `dev.pages.sotabsao.twa`, tag `sao-apk-v…` trên GitHub Releases.

| Phần | Nội dung |
|---|---|
| Loại sáo | Sáo dọc soprano, alto (mặc định), tenor, bass (Fa trầm); kiểu bấm Baroque hoặc German (chọn trong Cài đặt). Sáo trúc 6 lỗ: chọn tông sáo, tự chọn tông hợp bài, chọn cách gọi nốt "bịt hết lỗ" (Đô … Si) |
| Tab | Ghi tên nốt, dưới mỗi nốt có hình thế bấm; bảng thế bấm đầy đủ cho từng loại sáo. Sửa bài / sửa nốt chọn theo tên nốt |
| Karaoke | Hình thế bấm dưới mỗi nốt và hình thế tay lớn của nốt đang vang |
| Tập ngẫu hứng | Blues (chọn loại sáo, giọng, thang âm và nốt hợp âm hiện theo thế bấm, lick ghi tên nốt) và jazz |
| Học | 8 bài cho sáo alto và 2 bài cho sáo trúc; máy dò nốt hiện thế bấm |

## Sổ Tab Kalimba

Bản web: https://sotabkalimba.pages.dev · APK: gói `dev.pages.sotabkalimba.twa`, tag `kalimba-apk-v…` trên GitHub Releases.

| Phần | Nội dung |
|---|---|
| Đàn | Kalimba 17 phím (tông C: Đô4 → Mi6), 10 phím (Đô4 → Mi5), 8 phím (Đô4 → Đô5), giọng trưởng chọn tông được; phím thấp nhất ở giữa, lên cao xen kẽ trái / phải. Bài mẫu xem được cho đàn nhỏ (tự dịch giọng, báo nốt ngoài tầm) |
| Tab | Kiểu số 1–7 theo tông đàn, chấm `°` = lên một quãng tám (`1` = Đô4, `1°` = Đô5, `1°°` = Đô6; gõ `'` hoặc `*` cũng được). Dưới mỗi nốt có hình phím cần gảy, kèm sơ đồ cả cây đàn |
| Tập ngẫu hứng | Nền blues 12 ô, tô thang ngũ cung 1 2 3 5 6 trên cây đàn (kalimba không có nốt giáng), 13 lick ghi bằng tab số, máy hỏi – bạn đáp |
| Bài và học | Bài mẫu xếp lại cho kalimba, 10 bài học: làm quen, đọc tab, chọn đàn 8 / 10 / 17 phím, hai tay, giữ nhịp, hợp âm I – IV – V, rung tiếng và láy, ngẫu hứng ngũ cung, giai điệu kèm nốt trầm, chỉnh dây |
| Dò nốt | Dùng để chỉnh dây từng phím |

## Sổ Tab Guitar

Bản web: https://sotabguitar.pages.dev · APK: gói `dev.pages.sotabguitar.twa`, tag `guitar-apk-v…` trên GitHub Releases.

| Phần | Nội dung |
|---|---|
| Đàn | Guitar 6 dây và ukulele 4 dây |
| Tab | Ghi `dây.phím` (`2.3` = dây 2 phím 3), mỗi nốt vẽ như một cột tab. Bộ chọn vị trí ưu tiên dây buông, thế đầu cần và dây cao cho giai điệu. Sơ đồ cần đàn chạm để nghe, sửa nốt và soạn bài ngay trên cần đàn |
| Hợp âm | Sơ đồ hợp âm cho các hợp âm trong bài (thế mở, thế chặn, tự dò thế cho hợp âm khác), chạm để nghe. Capo theo từng bài (phím 1–7), gợi ý capo khi bài có nhiều hợp âm chặn khó. Bộ đoán hợp âm ưu tiên các vòng hay gặp (V–I, IV–V, ii–V, vi–IV…) |
| Lời + hợp âm | Tên hợp âm đặt trên chữ chỗ đổi hợp âm, chữ sáng theo nhạc, chạm chữ để phát từ đó, gợi ý điệu quạt theo kiểu nhịp |
| Dán hợp âm | Dán bài lời + hợp âm từ mạng (kiểu `[Am]lời` hoặc dòng hợp âm trên dòng lời), không cần giai điệu: app phát nhạc đệm theo hợp âm. Ở bài đã có giai điệu, dán hợp âm sẽ khớp từng chữ với lời để đặt hợp âm đúng chỗ. Hợp âm lạ (sus, add9, C/G) được đổi về hợp âm chơi được |
| Karaoke | Hình cần đàn và sơ đồ hợp âm đang vang |
| Tập ngẫu hứng | Blues / jazz trên cần đàn, tô cả hình thang blues |
| Bài và học | 34 bài mẫu guitar, 8 bài ukulele, 7 bài học; dò nốt để lên dây |

## Sổ Tab Pianica

Bản web: https://sotabpianica.pages.dev · APK: gói `dev.pages.sotabpianica.twa`, tag `pianica-apk-v…` trên GitHub Releases.

| Phần | Nội dung |
|---|---|
| Kèn | Pianica / melodica 32 phím (Fa3 → Đô6, loại học sinh hay dùng) và 37 phím (Fa3 → Fa6) |
| Tab | Tên nốt có quãng tám (`C4` = Đô giữa, `F#4`, `Bb4`), dưới mỗi nốt là hình cả bàn phím tô phím cần bấm. Sơ đồ bàn phím chạm để nghe; sửa nốt và soạn bài bằng cách chạm phím |
| Bài và học | Bài mẫu ghi lại cho pianica (giữ giọng gốc, giữ hợp âm chuẩn), 5 bài học: làm quen, đọc tab, đặt ngón và thang âm Đô, hơi thổi và đánh lưỡi, bảo quản |
| Tập ngẫu hứng | Blues / jazz với lick xếp thành tên nốt trên bàn phím |

## Chạy thử

Cần Node.js 18 trở lên.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # ~740 test: lý thuyết harp, parser, chuyển tab, YIN, OMR, AI, worker, giao diện
npm run lint       # ESLint (gồm luật react-hooks)
npm run typecheck
npm run build      # xuất ra dist/ (app Harmonica)
npm run preview    # chạy bản build (có service worker offline)
```

Các app còn lại build bằng biến `VITE_APP` (Git Bash / macOS / Linux):

```bash
VITE_APP=recorder npx vite build --outDir dist-recorder   # Sổ Tab Sáo
VITE_APP=kalimba npx vite build --outDir dist-kalimba     # Sổ Tab Kalimba
VITE_APP=guitar npx vite build --outDir dist-guitar       # Sổ Tab Guitar
VITE_APP=pianica npx vite build --outDir dist-pianica     # Sổ Tab Pianica
```

Mỗi lần push lên `main`, GitHub Actions chạy lint + test + build rồi deploy cả năm app lên Cloudflare Pages (`.github/workflows/deploy-pages.yml`): `dist/` → dự án `harptabs`, `dist-recorder/` → `sotabsao`, `dist-kalimba/` → `sotabkalimba`, `dist-guitar/` → `sotabguitar`, `dist-pianica/` → `sotabpianica`. Mở link của app bằng trình duyệt điện thoại → "Thêm vào màn hình chính" là app chạy offline.

Các phần nặng (quét nhạc, đọc file, PDF, OCR) chỉ tải khi dùng. Bộ đọc PDF và OCR được lưu lại sau lần dùng đầu, nên muốn dùng offline thì mở thử một lần khi có mạng.

## Quét khuông nhạc (offline)

`src/lib/omr.ts` đọc bản nhạc theo luật, giống cách người học tự đọc:

1. Làm phẳng nền ảnh chụp, co giãn ảnh để khoảng cách dòng kẻ ≈ 13,5 px.
2. Tìm 5 dòng kẻ (hàng điểm ảnh tối dài), xoá dòng kẻ.
3. Tìm đầu nốt (đốm cỡ một khe, phải có thân nốt); nốt trắng nhận qua lòng rỗng.
4. Cao độ = vị trí đầu nốt so với dòng dưới cùng (khoá Sol: dòng dưới = Mi 4), cộng hoá biểu đầu khuông.
5. Trường độ: đầu rỗng/đặc, số móc ở đầu thân, chấm dôi. Vạch nhịp chia ô; ô thiếu phách được chèn dấu lặng.

Đọc thêm: dấu hoá giữa bài, liên ba có ngoặc, dấu nối, lời in dưới khuông và tên hợp âm in trên khuông (OCR, `src/lib/lyricOcr.ts`, `src/lib/chordOcr.ts`), khoá Fa (dòng dưới = Sol2), dấu nhắc lại ‖: :‖ (đoạn nhắc lại được chơi hai lần khi chuyển tab, lời lần hai để trống).

Chưa đọc: khoá Đô, ngoặc lần 1 / lần 2 (volta), D.C. / D.S. / Coda, liên ba chỉ có số "3" không ngoặc, nhiều bè / hợp âm chồng nốt (giữ nốt cao nhất), chữ viết tay. Ảnh nghiêng nhiều cũng chưa xử lý.
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

Bản Android là **TWA** (Trusted Web Activity) do Bubblewrap tạo: mở trang Pages của app toàn màn hình qua Chrome, nên nội dung tự cập nhật theo mỗi lần deploy Pages, không cần build lại APK.

| App | Cấu hình | Gói | Tag trên Releases |
|---|---|---|---|
| Sổ Tab Harmonica | `android/twa-manifest.json` | `dev.pages.harptabs.twa` | `apk-v…` |
| Sổ Tab Sáo | `android-recorder/twa-manifest.json` | `dev.pages.sotabsao.twa` | `sao-apk-v…` |
| Sổ Tab Kalimba | `android-kalimba/twa-manifest.json` | `dev.pages.sotabkalimba.twa` | `kalimba-apk-v…` |
| Sổ Tab Guitar | `android-guitar/twa-manifest.json` | `dev.pages.sotabguitar.twa` | `guitar-apk-v…` |
| Sổ Tab Pianica | `android-pianica/twa-manifest.json` | `dev.pages.sotabpianica.twa` | `pianica-apk-v…` |

- Workflow `build-apk.yml` build cả bốn app (mỗi app một dòng trong matrix), chỉ chạy khi một trong các file cấu hình trên đổi (hoặc bấm chạy tay), rồi đăng APK lên [GitHub Releases](https://github.com/tranthanhphuc81-sudo/harptabs/releases).
- Cần secret `ANDROID_KEYSTORE_BASE64` và `ANDROID_KEYSTORE_PASSWORD` (cả bốn app dùng chung khoá). Vân tay SHA-256 của khoá ký phải khớp với `public/.well-known/assetlinks.json` (có mục cho từng gói), nếu không app sẽ hiện thanh địa chỉ trình duyệt.

## Bản quyền

© 2026 Trần Thanh Phúc. Liên hệ: 0913.65.65.39
