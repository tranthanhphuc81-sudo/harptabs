/** Bài học cho app Sổ Tab Guitar (guitar 6 dây và ukulele 4 dây). Tab ghi dây.phím: 2.3 = dây 2 phím 3. */
import type { Lesson } from './lessons';

const G = { harpKey: 'C' as const, harpType: 'guitar6' as const };
const U = { harpKey: 'C' as const, harpType: 'ukulele4' as const };

export const GUITAR_LESSON_GROUPS = ['Bắt đầu', 'Giai điệu', 'Hợp âm', 'Ukulele', 'Chỉnh dây và mẹo'];

export const GUITAR_LESSONS: Lesson[] = [
  {
    id: 'guitar-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab guitar trong app',
    summary: 'Dây nào là dây 1, số là phím, đọc cột tab.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Dây đánh số từ **dây mảnh nhất (dây 1, Mi cao)** tới **dây to nhất (dây 6, Mi trầm)**.',
        'Tab ghi **dây.phím**: `2.3` là dây 2 bấm phím 3, `1.0` là dây 1 **buông** (không bấm).',
        'Trên màn hình, mỗi nốt vẽ như một **cột tab**: 6 vạch ngang là 6 dây, **vạch trên cùng là dây 1**, số nằm trên dây cần gảy.',
        'Phím 1 là ô sát đầu cần đàn. Bấm ngay **sau** thanh phím (gần thân đàn) cho tiếng rõ, không rè.',
      ] },
      { t: 'diagram', ...G },
      { t: 'tip', text: 'Chạm vào ô bất kỳ trên sơ đồ cần đàn để nghe nốt đó. Bật Cài đặt → Hiện tên nốt để xem Đô-Rê-Mi phía trên tab.' },
    ],
  },
  {
    id: 'guitar-tu-the',
    group: 'Bắt đầu',
    title: 'Tư thế, tay bấm và tay gảy',
    summary: 'Ngồi đúng, đặt ngón, gảy từng dây bằng ngón cái hoặc phím gảy.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Đàn tựa lên đùi phải, cần đàn hơi chếch lên. Lưng thẳng, vai thả lỏng.',
        'Tay trái: ngón cái đặt sau cần, **đầu các ngón** bấm dây (móng tay cắt ngắn). Mỗi ngón phụ trách một phím: ngón 1 phím 1, ngón 2 phím 2…',
        'Tay phải: gảy giai điệu bằng **ngón cái** hoặc **phím gảy (pick)**, gảy xuống dứt khoát từng dây.',
        'Mới tập đau đầu ngón là bình thường; tập 15 phút mỗi ngày, vài tuần sẽ chai tay và hết đau.',
      ] },
      { t: 'tab', caption: 'Gảy các dây buông từ dây 6 lên dây 1', body: '6.0 5.0 4.0 3.0 2.0 1.0:2\n1.0 2.0 3.0 4.0 5.0 6.0:2\n', bpm: 70, style: 'ballad', ...G },
    ],
  },
  {
    id: 'guitar-thang-am',
    group: 'Giai điệu',
    title: 'Thang âm Đô trưởng thế bấm đầu cần',
    summary: 'Tám nốt Đô–Đô trên dây 5 tới dây 2.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Thế bấm đầu cần đàn dùng **ngón 1 cho phím 1, ngón 2 cho phím 2, ngón 3 cho phím 3**. Giữ bàn tay yên một chỗ, chỉ các ngón di chuyển.' },
      { t: 'tab', caption: 'Thang âm Đô trưởng', body: '5.3 4.0 4.2 4.3 3.0 3.2 2.0 2.1:2\n2.1 2.0 3.2 3.0 4.3 4.2 4.0 5.3:2\n', bpm: 72, style: 'ballad', ...G },
      { t: 'tab', caption: 'Twinkle Twinkle Little Star', body: '5.3 5.3 3.0 3.0 3.2 3.2 3.0:2\n4.3 4.3 4.2 4.2 4.0 4.0 5.3:2\n', bpm: 90, style: 'ballad', ...G },
      { t: 'tip', text: 'Nhập bài từ MIDI, ảnh bản nhạc hay mp3: app tự xếp nốt lên cần đàn, ưu tiên dây buông và các phím đầu cần cho dễ bấm.' },
    ],
  },
  {
    id: 'guitar-hop-am-co-ban',
    group: 'Hợp âm',
    title: 'Hợp âm cơ bản: C, G, Am, F, Em, D',
    summary: 'Đọc sơ đồ hợp âm và đổi hợp âm theo bài.',
    minutes: 8,
    blocks: [
      { t: 'list', items: [
        'Sơ đồ hợp âm vẽ **cần đàn dựng đứng**: dây 6 (trầm) bên trái, dây 1 bên phải, thanh ngang trên cùng là đầu cần.',
        '**Chấm** là chỗ bấm, **○** là dây buông, **×** là dây không gảy. Thanh dài là **chặn** (một ngón đè nhiều dây).',
        'Trên trang bài hát, bật nút **Hợp âm**: tên hợp âm hiện trên nốt và sơ đồ các hợp âm của bài hiện dưới tab. Chạm sơ đồ để nghe.',
        'Bộ 4 hợp âm **C – G – Am – F** đệm được rất nhiều bài. F chặn khó, có thể bấm Fmaj7 (xx3210) thay tạm.',
      ] },
      { t: 'tip', text: 'Đổi hợp âm: nhấc các ngón cùng lúc, đặt cùng lúc. Tập đổi chậm C → G → Am → F bốn phách mỗi hợp âm, rồi nhanh dần.' },
    ],
  },
  {
    id: 'guitar-dem-hat',
    group: 'Hợp âm',
    title: 'Điệu đệm cơ bản: quạt chả và gõ bo',
    summary: 'Nghe điệu đệm của app và quạt theo.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        '**Quạt chả** (ballad 4/4): xuống – xuống – lên – lên – xuống – lên. Cổ tay thả lỏng, quạt qua cả 6 dây (bỏ dây × của hợp âm).',
        '**Gõ bo / slow rock**: gảy bass dây trầm rồi quạt hoặc móc các dây cao.',
        'Trong trang bài hát, bấm Phát và chọn **Guitar quạt chả** hay **Guitar gõ bo** ở phần nhạc đệm để nghe mẫu, rồi tắt giai điệu để tự đệm hát.',
      ] },
    ],
  },
  {
    id: 'ukulele-lam-quen',
    group: 'Ukulele',
    title: 'Làm quen ukulele',
    summary: 'Dây G C E A, dây 4 cao hơn dây 3, hợp âm C, Am, F, G.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Ukulele có 4 dây, tính từ dây gần mặt khi ôm đàn: **G – C – E – A**. Dây 1 là La (dây mảnh nhất), dây 4 là **Sol cao** (cao hơn dây 3 Đô).',
        'Tab ghi giống guitar: `3.0` là dây 3 (Đô) buông, `1.3` là dây 1 phím 3.',
        'Bốn hợp âm dễ nhất: **C** (0003), **Am** (2000), **F** (2010), **G** (0232).',
      ] },
      { t: 'diagram', ...U },
      { t: 'tab', caption: 'Thang âm Đô trưởng trên ukulele', body: '3.0 3.2 2.0 2.1 2.3 1.0 1.2 1.3:2\n1.3 1.2 1.0 2.3 2.1 2.0 3.2 3.0:2\n', bpm: 72, style: 'ballad', ...U },
    ],
  },
  {
    id: 'guitar-chinh-day',
    group: 'Chỉnh dây và mẹo',
    title: 'Chỉnh dây bằng app',
    summary: 'Lên dây chuẩn E A D G B E (ukulele G C E A) với trang Dò nốt.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Guitar lên dây chuẩn, từ dây 6 tới dây 1: **Mi2 – La2 – Rê3 – Sol3 – Si3 – Mi4** (E A D G B E).',
        'Ukulele, từ dây 4 tới dây 1: **Sol4 – Đô4 – Mi4 – La4** (G C E A).',
        'Mở **Dò nốt**, gảy từng dây buông. Kim lệch trái là **thấp** → vặn khoá cho căng dây; lệch phải là **cao** → nới dây.',
        'Nên nới thấp một chút rồi vặn lên tới nốt chuẩn: dây giữ tông lâu hơn.',
      ] },
      { t: 'warn', text: 'Vặn từ từ, đừng lên quá cao — dây dễ đứt. Dây mới giãn nhiều, vài ngày đầu phải chỉnh lại thường xuyên.' },
    ],
  },
];
