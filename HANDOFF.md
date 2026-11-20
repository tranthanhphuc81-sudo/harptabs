# BÀN GIAO DỰ ÁN (PROJECT HANDOFF)

> **Dự án**: HarpTabs / Sổ Tab — Sổ tab và ứng dụng luyện tập nhạc cụ chạy Offline-first PWA  
> **Tác giả**: Trần Thanh Phúc (0913.65.65.39)  
> **Thời điểm bàn giao**: 19/11/2026  
> **Trạng thái kiểm thử**: 86/86 test suites passed (912 tests), TypeScript check 0 lỗi.

---

## 1. TỔNG QUAN DỰ ÁN

Dự án là một **Monorepo / Single Codebase** xây dựng ứng dụng web/PWA hỗ trợ đọc, chuyển soạn, nghe thử, nhập liệu và luyện tập âm nhạc cho **7 dòng nhạc cụ riêng biệt** (được phân phối thành 7 ứng dụng PWA / Google Play độc lập):

1. **Harmonica (Sổ Tab Harmonica)**: Diatonic 10 lỗ (Richter), Chromatic 12/14/16 lỗ, Chromatic Tombo S-50, Tremolo 24 lỗ, Trochilus Solo tuning.
2. **Guitar & Ukulele (Sổ Tab Guitar)**: Guitar 6 dây tiêu chuẩn, Ukulele 4 dây tiêu chuẩn; hỗ trợ Capo, sơ đồ thế bấm Fretboard, quạt chả Strumming, Chord sheet lời + hợp âm.
3. **Kalimba (Sổ Tab Kalimba)**: Đàn Kalimba 17 phím (phím Đô ở giữa toả ra hai bên).
4. **Sáo (Sổ Tab Sáo)**: Sáo Recorder (Alto/Soprano), Sáo trúc 6 lỗ (hệ Mão Mèo / nốt nhạc Việt Nam), Ocarina 6 lỗ / 12 lỗ.
5. **Pianica / Melodica (Sổ Tab Pianica)**: Đàn melodica / pianica 32 phím và 37 phím.
6. **Đàn Tranh & Đàn Bầu (Sổ Tab Đàn Tranh)**: Đàn tranh Việt Nam (16 dây, 17 dây, 19 dây) và Đàn Bầu (thang âm bội + cần uốn nốt).
7. **Organ & Piano (Sổ Tab Organ)**: Organ 61 phím, Piano 88 phím; tính năng tự động gợi ý số ngón tay phải (fingering) thông minh.

---

## 2. NGĂN XẾP CÔNG NGHỆ (TECH STACK)

- **Frontend Core**: React 18 (Strict Mode), TypeScript 5.6, Vite 6, React Router DOM v6 (HashRouter cho tương thích offline & app nhúng).
- **Lưu trữ Offline**: IndexedDB thông qua thư viện `dexie` & `dexie-react-hooks`. Toàn bộ bài hát, cấu hình, nhật ký luyện tập, file đính kèm được lưu cục bộ trên thiết bị người dùng.
- **Xử lý âm thanh (Web Audio API)**:
  - Bộ tổng hợp âm thanh đa dạng: kèn harmonica, sáo, guitar acoustic/nylon, piano/organ, kalimba, bộ gõ drum kit, metronome.
  - Phân tích cao độ theo thời gian thực (Pitch Detection): thuật toán Autocorrelation + YIN + lọc nhiễu + FFT để bắt nốt qua micro.
  - Nhận diện nhịp và onset (Onset Detection): chấm điểm độ chính xác khi dậm nhịp / gõ phách.
  - Bộ phối nhạc nền tự động (Accompaniment & Backing Track generator): hỗ trợ các điệu ballad, waltz, march, swing, shuffle, slow rock, bossa nova, train beat...
- **Nhận diện thị giác & Nhập liệu thông minh**:
  - **OMR (Optical Music Recognition)**: Thuật toán Canvas/SVG tự phát triển đọc bản nhạc in, khuông nhạc (staff), khoá Sol, khoá Fa, hoá biểu thăng/giáng, nốt móc, vạch nối, dấu nhắc lại, ngoặc lần 1/lần 2.
  - **OCR**: `tesseract.js` nhận diện lời bài hát tiếng Việt/Anh và tên hợp âm từ ảnh chụp.
  - **Audio Transcribe**: Tự động chuyển đổi bản thu micro / file ghi âm thành tab.
- **PWA & Build System**: `vite-plugin-pwa` tạo Service Worker, bộ nhớ đệm cache-first chạy hoàn toàn khi không có mạng.
- **Backend / Worker**: Cloudflare Workers (`worker/`) cho các tác vụ AI tùy chọn (Gemini API) với cơ chế bảo vệ quota, trả lại lượt khi lỗi.

---

## 3. CẤU TRÚC THƯ MỤC CHÍNH

```
harptabs/
├── index.html                   # HTML gốc, nạp font Barlow, Barlow Condensed
├── package.json                 # Định nghĩa dependencies, scripts build/test
├── tsconfig.json                # Cấu hình TypeScript
├── vite.config.ts               # Cấu hình Vite & PWA
├── HANDOFF.md                   # File tài liệu bàn giao hiện tại
├── scripts/                     # Scripts build tiện ích (copy worker OCR, asset...)
├── store/                       # Thư mục chứa tài nguyên Google Play cho cả 7 app (ảnh chụp màn hình, mô tả, logo)
├── landing/                     # Trang web giới thiệu sotab.pages.dev
├── worker/                      # Cloudflare Worker hỗ trợ AI & rate limit
└── src/
    ├── appConfig.ts             # Nhận diện app hiện tại dựa trên biến VITE_APP
    ├── App.tsx                  # Điều hướng chính, thanh điều hướng dưới đáy (Nav)
    ├── main.tsx                 # Điểm khởi đầu React
    ├── state.tsx                # Context quản lý trạng thái toàn cục & Settings
    ├── audio/                   # Toàn bộ logic Web Audio API
    │   ├── engine.ts            # Khởi tạo AudioContext, nạp synth
    │   ├── player.ts            # Trình phát nốt & giai điệu
    │   ├── backingPlayer.ts     # Phát nhạc đệm và hoà âm
    │   ├── pitch.ts             # Dò cao độ (tuner, luyện tập)
    │   ├── harmony.ts           # Thuật toán đoán hợp âm & dịch giọng
    │   ├── harmonyBench.ts      # Bộ đối chiếu kiểm thử độ chuẩn hợp âm
    │   └── patterns.ts          # Các mẫu tiết tấu trống & bass đệm
    ├── components/              # Các UI components tái sử dụng
    │   ├── TabView.tsx          # Hiển thị ô nốt / tab harmonica, sáo, kalimba...
    │   ├── Fretboard.tsx        # Cần đàn guitar & ukulele
    │   ├── Keyboard.tsx         # Bàn phím piano / organ / pianica
    │   ├── HarpDiagram.tsx      # Sơ đồ nốt kèn harmonica 10 lỗ
    │   ├── DanBau.tsx / Tranh.tsx # Sơ đồ nốt đàn bầu và đàn tranh
    │   ├── ChordSheet.tsx       # Hiển thị lời kèm hợp âm
    │   ├── StrumStrip.tsx       # Dải biểu diễn điệu quạt chả guitar
    │   └── SongNotes.tsx        # Ô ghi chú bài hát có nút xem thêm / thu gọn
    ├── data/                    # Dữ liệu bài hát mẫu & bài học
    │   ├── lessons.ts           # Bài học Harmonica offline (6 nhóm)
    │   ├── guitarLessons.ts, kalimbaLessons.ts, organLessons.ts, ... # Bài học từng nhạc cụ
    │   ├── samples.ts           # Bài mẫu cơ bản & gộp danh sách
    │   ├── samples2.ts          # Bài mẫu bổ sung (nhi đồng, giáng sinh...)
    │   ├── samples3.ts          # Bài mẫu folk, blues, country, vị trí 2 & 3
    │   ├── samples4.ts          # Bài mẫu cho Chromatic & Tremolo
    │   └── licks.ts, jazzLicks.ts # Thư viện lick blues & jazz
    ├── lib/                     # Thư viện thuật toán cốt lõi
    │   ├── db.ts                # Cơ sở dữ liệu Dexie IndexedDB
    │   ├── harp.ts              # Nhạc lý kèn harmonica, nốt từng lỗ, vị trí (positionKey)
    │   ├── tabText.ts           # Parser cú pháp harptab, tính phách
    │   ├── converter.ts         # Thuật toán chuyển đổi bài hát giữa các nhạc cụ
    │   ├── omr.ts               # Nhận diện khuông nhạc từ hình ảnh
    │   ├── lyricOcr.ts          # OCR nhận diện lời tiếng Việt
    │   ├── audioTranscribe.ts   # Dò tab từ file âm thanh / micro
    │   └── autoScroll.ts        # Thuật toán tự cuộn trang theo nhịp
    └── pages/                   # Các màn hình ứng dụng
        ├── Library.tsx          # Thư viện bài hát (nhớ vị trí cuộn & bộ lọc)
        ├── SongView.tsx         # Trang xem và chơi bài hát
        ├── SongEdit.tsx         # Trang sửa bài & sửa nốt trực tiếp
        ├── Learn.tsx            # Trang danh sách bài học & chi tiết bài học
        ├── Jam.tsx / JazzJam.tsx# Trang tập ngẫu hứng trên nền nhạc Blues / Jazz
        ├── Tuner.tsx            # Máy dò nốt & so cao độ qua micro
        ├── PitchPractice.tsx    # Luyện cao độ & kỹ thuật bend
        ├── RhythmPractice.tsx   # Luyện tập nhịp và dậm chân
        ├── EarPractice.tsx      # Luyện nghe và phản xạ câu nhạc (Call & Response)
        ├── ScanImport.tsx       # Quét bản nhạc qua camera / ảnh chụp
        ├── FileImport.tsx       # Nhập file MIDI, MusicXML, PDF
        └── Settings.tsx         # Cài đặt giao diện, bảng màu, sao lưu dữ liệu
```

---

## 4. CƠ CHẾ MULTI-APP & PHÂN BIỆT NHẠC CỤ

Mỗi app được đóng gói độc lập thông qua biến môi trường `VITE_APP`:
- `VITE_APP=harmonica` (mặc định)
- `VITE_APP=guitar`
- `VITE_APP=kalimba`
- `VITE_APP=recorder`
- `VITE_APP=pianica`
- `VITE_APP=tranh`
- `VITE_APP=organ`

File `src/appConfig.ts` xuất các cờ Boolean (`IS_GUITAR_APP`, `IS_ORGAN_APP`, `IS_TRANH_APP`...) để:
1. Nạp đúng danh mục bài học (`LESSONS`).
2. Tự động chuyển đổi thư viện bài mẫu phù hợp với âm vực và thế bấm của nhạc cụ đó.
3. Ẩn/hiện các công cụ phù hợp (ví dụ: app Harmonica có bảng tra vị trí kèn và Jam blues; app Guitar có Capo và quạt chả; app Tranh có nốt ngũ cung Hò Xự Xang Xê Cống; app Organ có số ngón tay).
4. Áp dụng bảng màu và biểu tượng nhạc cụ tương ứng trên thanh tiêu đề và manifest PWA.

---

## 5. CÁC TÍNH NĂNG CỐT LÕI ĐÃ HOÀN THÀNH

- **Thư viện bài hát (Library)**: Hỗ trợ tìm kiếm, phân loại theo nhạc cụ, đánh dấu bài yêu thích. Gần đây nhất đã hoàn thiện tính năng nhớ đúng vị trí cuộn trang và bộ lọc khi người dùng bấm quay lại từ trang chi tiết bài hát.
- **Trình xem tab (SongView)**: Giao diện trực quan phân biệt nốt thổi (vàng đồng), nốt hút (xanh dương), nốt bend (dấu phẩy đỏ), trường độ nốt. Chế độ **Tự cuộn (Auto-scroll)** theo nhịp từ 30% đến 200% tempo. Nút đổi kèn / đổi tông tự động tối ưu hóa lỗ thổi ít bend nhất.
- **Nhập liệu & Chuyển đổi**:
  - Đọc và phân tích file MIDI, MusicXML, PDF bản nhạc.
  - Bộ quét OMR đọc ảnh bản nhạc thật, nhận diện nốt móc, nốt chấm dôi, dấu thăng/giáng, ngoặc nhắc lại.
  - Chuyển đổi qua lại giữa kèn diatonic, chromatic, tremolo, guitar, ukulele, kalimba, sáo, pianica, đàn tranh, organ.
- **Luyện tập tương tác qua Micro**:
  - **Tập nhịp**: Máy đếm nhịp + micro lắng nghe tiếng vỗ/gõ, đo độ sai lệch mili-giây và vẽ biểu đồ nhịp nhanh/chậm.
  - **Tập nghe - đáp**: Máy chơi câu mẫu trích từ bài quen, người dùng chơi lại qua micro, hệ thống chấm điểm từng nốt.
  - **Luyện bend & cao độ**: Bắt chính xác từng nấc bend nửa cung, 1 cung, 1 cung rưỡi.
  - **Nhật ký luyện tập**: Tự động lưu lịch sử tập, chuỗi ngày tập liên tục (streak), biểu đồ 7 ngày.
- **Dò nốt (Tuner)**: Giao diện trực quan hiển thị tên nốt, độ lệch cent, thế bấm/lỗ kèn tương ứng cho từng nhạc cụ.

---

## 6. CHI TIẾT TÍNH NĂNG VỪA BỔ SUNG TRONG PHIÊN NÀY

Theo yêu cầu số 3 từ phiên làm việc trước:
### 1. Bổ sung 5 bài học chuyên sâu trong `src/data/lessons.ts`:
- **`vi-tri-2-cross-harp` ("Vị trí 2: Cross harp & Blues")**:
  - Hướng dẫn bản chất Cross harp: kèn C chơi giọng Sol (G) — nâng cao một quãng 5.
  - Nốt chủ âm: hút lỗ 2 (`-2`) hoặc thổi lỗ 6 (`6`). Hợp âm hút 1–4 là Sol trưởng (G).
  - Thang âm Blues Sol đầy đủ: `-2`, `-3'` (nốt blue bậc 3), `4`, `-4'` (nốt blue bậc 5 giáng), `-4`, `-5`, `6`.
  - Có bài tập Tab mẫu tương tác kèm mini-player phát điệu shuffle trực tiếp trong bài học.
- **`vi-tri-3-slant-harp` ("Vị trí 3: Giai điệu thứ (Slant harp)")**:
  - Hướng dẫn bản chất Slant harp: kèn C chơi giọng Rê thứ (`Dm`) / Rê Dorian.
  - Nốt chủ âm: hút lỗ 4 (`-4`) ở quãng trung, hút lỗ 8 (`-8`) ở quãng cao, hút lỗ 1 (`-1`) ở quãng trầm.
  - Ưu thế độc đáo: quãng giữa (lỗ 4 đến 8) chứa đầy đủ thang âm Dorian tự nhiên (`-4 5 -5 6 -6 -7 7 -8`) mà **không cần bend**, cực kỳ êm ái cho nhạc ballad, dân ca Ireland/Celtic, nhạc phim trữ tình.
  - Kỹ thuật nâng cao: bend lỗ 4 (`-4'`) lấy nốt Đô# dẫn về Rê và bend lỗ 6 (`-6'`) cho Minor Blues.
- **`blues-turnaround` ("Turnaround và câu kết blues")**:
  - Hướng dẫn turnaround ô 11–12 (I → V), turnaround có bend từ lỗ 6 hạ về `-1`, và câu kết bài dứt khoát trên `-2:4`.
- **`chuyen-vi-tri-1-2` ("Chuyển giữa vị trí 1 và 2")**:
  - Kỹ thuật kết hợp vị trí 1 (hát giai điệu) và vị trí 2 (solo ngẫu hứng) trong cùng một bài, sử dụng nốt Sol làm cầu nối chung.
- **`minor-pentatonic-vi-tri-3` ("Thang âm thứ ngũ cung ở vị trí 3")**:
  - 5 nốt an toàn của Rê thứ ngũ cung (`-4`, `-5`, `6`, `-6`, `7`) và nốt blue `-4'` tạo lực kéo về `-4`.

### 2. Bổ sung 6 bài mẫu (Sample Songs) chuẩn mực trong `src/data/samples3.ts`:
- **Vị trí 2 (Cross harp - kèn C chơi giọng Sol)**:
  - `careless-love`: Blues/Folk kinh điển, shuffle 84 bpm, nốt bend `-3'`.
  - `when-the-saints`: Bản hành khúc tâm linh nổi tiếng, march 110 bpm, 48 phách chuẩn.
  - `swing-low`: Giai điệu tâm linh da diết, slow-rock 76 bpm, nốt chủ `-2` và bend `-3'`.
- **Vị trí 3 (Slant harp - kèn C chơi giọng Rê thứ Dm)**:
  - `drunken-sailor`: Dân ca thủy thủ sôi động, train style 110 bpm, không cần bend.
  - `wayfaring-stranger`: Ballad tâm linh trầm buồn, 72 bpm, nốt blue `-4'`.
  - `god-rest-ye`: Ca khúc Giáng sinh truyền thống Anh, march 100 bpm, thang âm tự nhiên.

### 3. Bổ sung 10 câu lick blues mới trong `src/data/licks.ts`:
- Nhảy quãng tám (`octave-nhay`), Wah-wah tay phải (`wah-wah`), Shake lỗ 4–5 (`shake-45`), Câu hỏi trầm (`cau-hoi-tram`), Riff ngắt nhịp (`riff-ngat`), Hỏi đáp đơn giản (`doi-chieu`), Riff đầy trên IV (`iv-day`), V trượt xuống (`v-truot-xuong`), Turnaround lắc (`turn-lac`), Turnaround dứt khoát (`turn-dut`).

### 4. Đảm bảo kiểm thử:
- Đã chạy qua `samples.test.ts` (172 tests), `licks.test.ts` (31 tests), `accompPlan.test.ts` (7 tests).
- Toàn bộ 86 test suites với **912 bài test** trong `npm test` đều vượt qua xuất sắc 100%.

---

## 7. HƯỚNG DẪN DÀNH CHO LẬP TRÌNH VIÊN / AGENT TIẾP THEO

- **Chạy kiểm tra kiểu dữ liệu**:
  ```bash
  cmd /c npm run typecheck
  ```
- **Chạy toàn bộ unit & smoke tests**:
  ```bash
  cmd /c npm test
  ```
- **Chạy môi trường phát triển (Dev server)**:
  ```bash
  cmd /c npm run dev
  ```
- **Lưu ý trên môi trường Windows**: Do PowerShell Execution Policy có thể hạn chế thực thi script `.ps1`, hãy luôn gọi các lệnh qua `cmd /c npm ...` hoặc `npm.cmd ...`.
- **Nguyên tắc đóng góp code**:
  - Không phá vỡ tương thích của 7 app: khi sửa các component dùng chung (`TabView`, `SongView`, `SongNotes`...), luôn chạy lại smoke test (`src/test/app-*.test.tsx`).
  - Bài mẫu thêm mới phải tuân thủ nghiêm ngặt quy tắc phách nhịp trong `samples.test.ts` (tổng số phách phải khớp với số đo ô nhịp và nhịp lấy đà).
  - **Song ngữ Việt / Anh** (`src/lib/i18n.ts`, từ điển `src/lib/i18n.en.ts`): mọi chữ hiển thị viết tiếng Việt trong `t('...')`; câu tiếng Việt chính là khoá tra từ điển. Tham số theo vị trí: `t('Đã xoá {0} bài', n)`; trong bản dịch có thể dùng `{0|song|songs}` cho số ít / số nhiều. Thêm chữ mới thì bọc `t()` **và** thêm dòng vào `i18n.en.ts` (thiếu thì bản English hiện nguyên tiếng Việt). Ngôn ngữ chọn lúc mở app (đã chọn trong Cài đặt → theo máy: có tiếng Việt hoặc múi giờ Việt Nam thì tiếng Việt, còn lại English); đổi ngôn ngữ thì tải lại trang. Khi chạy test luôn là tiếng Việt. Không so sánh với chữ đã dịch (ví dụ `BRAND.verb === 'thổi'`) — dùng cờ như `IS_BLOWN_APP`. Nội dung dài (bài học, lick, tên / tác giả / ghi chú bài mẫu, tên đoạn trong tab) dịch riêng bằng `tl()` (`src/lib/i18nData.ts`), từ điển khoá bằng mã băm câu tiếng Việt ở `src/data/en/dataEn.ts`; bài mẫu đã lưu trong máy được dịch lúc đọc ra (hook `reading` của Dexie trong `db.ts`), câu người dùng đã sửa thì giữ nguyên. Sửa / thêm nội dung bài học thì chạy `node scripts/i18n-data.mjs missing` để xem câu chưa dịch, rồi `node scripts/i18n-data.mjs build <file.json>` (JSON `[{ "vi": "...", "en": "..." }]`). Trang Google Play (`store/`) và landing **chưa dịch**.
