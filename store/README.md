# Đưa 7 app Sổ Tab lên Google Play

Thư mục này có sẵn mọi thứ cần điền trên Play Console cho từng app:

| App | Gói | Nội dung cửa hàng | File tải lên (GitHub Releases) |
|---|---|---|---|
| Sổ Tab Harmonica | `dev.pages.harptabs.twa` | [harmonica/listing.md](harmonica/listing.md) | `harptabs-1.0.x.aab` (tag `apk-v…`) |
| Sổ Tab Sáo | `dev.pages.sotabsao.twa` | [recorder/listing.md](recorder/listing.md) | `sotabsao-1.0.x.aab` (tag `sao-apk-v…`) |
| Sổ Tab Kalimba | `dev.pages.sotabkalimba.twa` | [kalimba/listing.md](kalimba/listing.md) | `sotabkalimba-1.0.x.aab` |
| Sổ Tab Guitar | `dev.pages.sotabguitar.twa` | [guitar/listing.md](guitar/listing.md) | `sotabguitar-1.0.x.aab` |
| Sổ Tab Pianica | `dev.pages.sotabpianica.twa` | [pianica/listing.md](pianica/listing.md) | `sotabpianica-1.0.x.aab` |
| Sổ Tab Đàn Tranh – Đàn Bầu | `dev.pages.sotabdantranh.twa` | [tranh/listing.md](tranh/listing.md) | `sotabdantranh-1.0.x.aab` |
| Sổ Tab Organ | `dev.pages.sotaborgan.twa` | [organ/listing.md](organ/listing.md) | `sotaborgan-1.0.x.aab` |

Mỗi thư mục app có: `listing.md` (tên, mô tả ngắn, mô tả đầy đủ — đã kiểm giới hạn ký tự của Play), `listing.en.md` (bản tiếng Anh, thêm làm bản dịch en-US; mô tả ghi rõ giao diện app là tiếng Việt), `feature.png` (ảnh bìa 1024×500), `screenshots/` (5 ảnh điện thoại 1080×1920). Biểu tượng 512×512 nằm ở `public/…/icon-512.png` (đường dẫn ghi trong từng `listing.md`).

## 1. Lấy file AAB

Workflow **Build APK Android** giờ đăng kèm file `.aab` (Android App Bundle, đã ký bằng khoá tải lên `ANDROID_KEYSTORE_BASE64`) vào cùng bản phát hành với file `.apk`. Lần build đầu sau thay đổi này: vào GitHub → **Actions → Build APK Android → Run workflow** (workflow chỉ tự chạy khi `twa-manifest.json` đổi). Tải file `.aab` của từng app ở trang **Releases**.

`versionCode` lấy theo số lần chạy workflow nên luôn tăng; mỗi lần muốn đăng bản mới lên Play thì chạy lại workflow. Nội dung app (trang web) vẫn tự cập nhật theo mỗi lần deploy Pages, không cần đăng bản mới.

## 2. Tài khoản nhà phát triển (bạn tự làm)

1. Đăng ký tại https://play.google.com/console — phí một lần 25 USD, cần xác minh danh tính.
2. Tài khoản **cá nhân** tạo mới phải **thử nghiệm kín** trước khi được phát hành chính thức (theo quy định Google công bố: tối thiểu 12 người thử liên tục 14 ngày — kiểm tra lại con số trên Play Console vì Google có thể đổi). Có thể dùng chung một nhóm người thử cho cả 7 app.

## 3. Tạo từng app trên Play Console

1. **Create app** → tên theo `listing.md`, ngôn ngữ mặc định Tiếng Việt, loại **App**, **Free**.
2. **Testing → Closed testing** (hoặc Internal testing để tự thử trước) → tạo bản phát hành → tải file `.aab` → Play hỏi **Play App Signing**: chọn để Google quản lý khoá ký (mặc định).
3. **Main store listing**: dán tên, mô tả ngắn, mô tả đầy đủ từ `listing.md`; tải biểu tượng, `feature.png` và các ảnh trong `screenshots/`. Danh mục gợi ý: **Âm nhạc và âm thanh** (Music & Audio) hoặc **Giáo dục**.
4. **App content** (xem mục 5 bên dưới).

## 4. Việc bắt buộc sau lần tải lên đầu tiên: vân tay khoá ký của Google

Khi bật Play App Signing, bản cài từ Play được Google ký bằng **khoá khác** với khoá trong GitHub. App là TWA nên Chrome kiểm tra vân tay khoá ký trong `public/.well-known/assetlinks.json`; thiếu vân tay của Google thì bản cài từ Play sẽ **hiện thanh địa chỉ trình duyệt** ở đầu màn hình.

1. Play Console → app → **Test and release → App integrity → App signing** → copy dòng **SHA-256 certificate fingerprint** của *App signing key certificate*.
2. Thêm vân tay đó vào mảng `sha256_cert_fingerprints` của đúng gói trong `public/.well-known/assetlinks.json` (giữ nguyên vân tay cũ để bản APK trên GitHub vẫn chạy), push để deploy lại Pages.
3. Gửi vân tay cho Claude cũng được — chỉ là sửa một file.

## 5. Mục "App content"

Các câu trả lời dưới đây dựa theo trang chính sách quyền riêng tư (`public/privacy.html`, có trên mọi tên miền app, vd. https://harptabs.pages.dev/privacy). Bạn là người khai báo với Google, hãy đọc lại và chỉnh nếu app thay đổi.

| Mục | Trả lời |
|---|---|
| Privacy policy | `https://<tên-miền-của-app>/privacy` — đường dẫn có sẵn trong từng `listing.md` (vd. `https://harptabs.pages.dev/privacy`). Không dùng `sotab.pages.dev/privacy.html`: trang giới thiệu chung không có trang này |
| Ads | Không có quảng cáo |
| App access | Mọi chức năng dùng được không cần đăng nhập |
| Content rating | Bảng hỏi IARC: app tiện ích / giáo dục âm nhạc, không bạo lực, không nội dung người lớn, không mua bán, người dùng không trò chuyện với nhau trong app |
| Target audience | 13 tuổi trở lên (khớp chính sách), không nhắm tới trẻ em |
| News app / Government app / Health | Không |

**Data safety** (an toàn dữ liệu):

- *Có thu thập hoặc chia sẻ dữ liệu không?* Có (thống kê ẩn danh và tính năng AI).
- *Mã hoá khi truyền:* Có (HTTPS). *Người dùng yêu cầu xoá được:* Có (qua email, mục 5 của chính sách).
- Các loại dữ liệu:

| Loại dữ liệu (theo Play) | Thu thập | Chia sẻ | Bắt buộc? | Mục đích | Ghi chú |
|---|---|---|---|---|---|
| Device or other IDs | Có | Không | Không (tắt được trong Cài đặt) | Analytics | Mã ngẫu nhiên app tự tạo, không phải mã quảng cáo |
| App activity → App interactions | Có | Không | Không | Analytics | Số lần mở app, phiên bản, loại app |
| Photos | Có | Có (Google Gemini API xử lý) | Không (chỉ khi bấm dùng AI) | App functionality | Chọn "processed ephemerally" — không lưu |
| Other user-generated content (tên bài, lời bài hát nhập cho AI) | Có | Có (Google Gemini API) | Không | App functionality | Xử lý tạm, không lưu |
| Địa chỉ IP (giới hạn lượt AI) | Cân nhắc khai trong Device or other IDs | Không | — | Fraud prevention, security | Tự xoá sau ~26 giờ |

Micro, bản thu, bài hát, nhật ký luyện tập **không** rời máy nên không khai.

## 6. Kiểm tra trước khi gửi duyệt

- [ ] Cài bản thử từ Play, mở app: không có thanh địa chỉ (đã thêm vân tay ở mục 4).
- [ ] Play Console không báo lỗi **target API level**. Nếu báo, cần nâng phiên bản Bubblewrap trong `.github/workflows/build-apk.yml` (hiện `@bubblewrap/cli@1.27.0`) rồi build lại.
- [ ] Đủ người thử kín đủ ngày (tài khoản cá nhân), sau đó **Production → Create release** dùng lại file `.aab`.

## Làm lại ảnh

Ảnh chụp và ảnh bìa được tạo tự động: ảnh chụp bằng Chrome headless (giả lập máy 360×640 @3x) mở máy chủ chạy thử của từng app (`.claude/launch.json`), ảnh bìa vẽ từ biểu tượng app. Khi giao diện đổi nhiều, nhờ Claude chụp lại.
