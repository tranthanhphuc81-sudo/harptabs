/** Bài học cho app Sổ Tab Organ (đàn organ 61 phím, piano). Tab ghi tên nốt: C4 = Đô giữa; tay phải chơi giai điệu. */
import type { Lesson } from './lessons';

const O = { harpKey: 'C' as const, harpType: 'organ61' as const };

export const ORGAN_LESSON_GROUPS = ['Bắt đầu', 'Tay phải', 'Tay trái và đệm', 'Mẹo tập'];

export const ORGAN_LESSONS: Lesson[] = [
  {
    id: 'organ-lam-quen',
    group: 'Bắt đầu',
    title: 'Làm quen đàn organ',
    summary: 'Tư thế ngồi, tìm Đô giữa, đánh số ngón tay 1–5.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Ngồi **giữa đàn**, lưng thẳng, khuỷu tay ngang mặt phím. **Đô giữa (C4)** nằm khoảng trước rốn.',
        'Tìm Đô: phím trắng **ngay bên trái nhóm hai phím đen**. Đàn 61 phím có 6 phím Đô, từ Đô2 bên trái tới Đô7 bên phải.',
        '**Số ngón tay**: ngón cái là 1, trỏ 2, giữa 3, áp út 4, út 5 — cả hai tay đều đánh số như vậy.',
        'Bàn tay **khum tròn** như đang úp một quả cam, bấm bằng đầu ngón; cổ tay thả lỏng, không gục xuống.',
      ] },
      { t: 'diagram', ...O },
      { t: 'tip', text: 'Chạm phím trên sơ đồ để nghe; kéo ngang để xem cả bàn phím. Đàn có nút "Touch" (cảm ứng lực): bật lên thì bấm mạnh to, bấm nhẹ nhỏ — giống piano.' },
    ],
  },
  {
    id: 'organ-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab organ',
    summary: 'Tên nốt có số quãng tám, hình bàn phím dưới mỗi nốt, dòng hợp âm cho tay trái.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        'Tab ghi **tên nốt kèm quãng tám**: `C4` là Đô giữa, `D4` Rê ngay bên phải, `C5` là Đô cao hơn một quãng tám. `#` là thăng (phím đen bên phải), `b` là giáng (phím đen bên trái).',
        'Dưới mỗi nốt có **hình 3 quãng tám** quanh nốt đó, phím tô màu là phím cần bấm — tay phải chơi các nốt này.',
        '**Ô dài hơn** = giữ phím lâu hơn; dấu `–` là nghỉ (nhấc tay).',
        'Dòng **hợp âm** phía trên (C, F, G7…) là phần **tay trái**: xem bài "Tay trái bấm hợp âm".',
      ] },
      { t: 'tab', caption: 'Năm nốt đầu tiên: Đô Rê Mi Fa Sol', body: 'C4 D4 E4 F4 G4:2 G4:2\nG4 F4 E4 D4 C4:4\n', bpm: 72, style: 'ballad', ...O },
    ],
  },
  {
    id: 'organ-nam-ngon',
    group: 'Tay phải',
    title: 'Thế năm ngón',
    summary: 'Mỗi ngón một phím, không nhấc tay: chơi được cả bài.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Đặt **ngón 1 lên Đô4**, các ngón 2 3 4 5 lần lượt lên Rê Mi Fa Sol. Đây là **thế năm ngón Đô** — rất nhiều bài thiếu nhi chỉ dùng năm nốt này.',
        'Bấm xong nhấc ngón lên ngay khi sang nốt kế — hai nốt không kêu chồng lên nhau.',
        'Nhìn tab, đọc tên nốt, **không nhìn tay**: tay đã nằm sẵn đúng chỗ.',
      ] },
      { t: 'tab', caption: 'Ode to Joy (Beethoven) — chỉ dùng năm ngón', body: 'E4 E4 F4 G4 G4 F4 E4 D4\nC4 C4 D4 E4 E4:1.5 D4:0.5 D4:2\nE4 E4 F4 G4 G4 F4 E4 D4\nC4 C4 D4 E4 D4:1.5 C4:0.5 C4:2\n', bpm: 90, style: 'ballad', ...O },
    ],
  },
  {
    id: 'organ-luon-ngon',
    group: 'Tay phải',
    title: 'Luồn ngón: chơi hết thang âm',
    summary: 'Ngón cái luồn dưới bàn tay để đi tiếp, không phải nhấc tay.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Đi lên: Đô **1**, Rê **2**, Mi **3**, rồi **luồn ngón cái xuống dưới** ngón 3 để bấm Fa **1**; tiếp Sol 2, La 3, Si 4, Đô 5.',
        'Đi xuống: Đô 5 … Fa 1, rồi **vắt ngón 3 qua** ngón cái để bấm Mi 3, Rê 2, Đô 1.',
        'Tập thật chậm, tiếng phải liền mạch — không có khoảng trống lúc luồn ngón.',
      ] },
      { t: 'tab', caption: 'Thang âm Đô trưởng: lên rồi xuống', body: 'C4 D4 E4 F4 G4 A4 B4 C5:2\nC5 B4 A4 G4 F4 E4 D4 C4:2\n', bpm: 66, style: 'ballad', ...O },
      { t: 'link', to: '/nghe-dap', label: 'Tập nghe – đáp', text: 'Máy chơi một câu ngắn, bạn tìm và bấm lại trên đàn — app nghe micro và chấm. Cách nhanh nhất để thuộc vị trí phím.' },
    ],
  },
  {
    id: 'organ-tay-trai',
    group: 'Tay trái và đệm',
    title: 'Tay trái bấm hợp âm',
    summary: 'Ba hợp âm Đô, Fa, Sol đệm được rất nhiều bài.',
    minutes: 8,
    blocks: [
      { t: 'list', items: [
        'Tay trái chơi **quanh Đô3** (Đô thấp hơn Đô giữa một quãng tám).',
        '**C (Đô trưởng)**: Đô – Mi – Sol, ngón **5 – 3 – 1**.',
        '**F (Fa trưởng)**: Đô – Fa – La, ngón **5 – 2 – 1** (thế đảo: chỉ dời ngón 2 và 1 lên, ngón 5 giữ nguyên Đô).',
        '**G (Sol trưởng)**: Si – Rê – Sol, ngón **5 – 3 – 1** (dời cả bàn tay xuống một chút). **G7**: Si – Fa – Sol.',
        '**Am (La thứ)**: Đô – Mi – La, ngón 5 – 3 – 1. Đổi hợp âm theo dòng hợp âm trên tab, bấm ngay đầu ô nhịp.',
        'Mẹo: chuyển C → F → G chỉ cần dời một hai ngón, các ngón còn lại giữ yên — tay đổi rất nhanh.',
      ] },
      { t: 'diagram', ...O },
      { t: 'tip', text: 'Trong trang bài, chạm vào tên hợp âm trên dòng hợp âm để xem hợp âm đó tô trên bàn phím và nghe thử.' },
    ],
  },
  {
    id: 'organ-dem-tu-dong',
    group: 'Tay trái và đệm',
    title: 'Đệm tự động trên đàn organ',
    summary: 'Chọn điệu, bấm hợp âm tay trái — đàn tự đệm trống, bass, hợp âm.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Bấm **Style** (hoặc Rhythm), chọn điệu: Slow Rock, Bolero, Cha Cha, Waltz… rồi chỉnh **Tempo** cho vừa.',
        'Bật **ACC / Auto Accompaniment**: vùng phím bên trái (thường dưới Fa#3) thành vùng đệm — tay trái bấm hợp âm ở đó, đàn tự chơi bass và hợp âm theo điệu.',
        '**Single finger** (bấm một ngón): bấm một phím là ra hợp âm trưởng; hợp âm thứ, hợp âm 7 bấm thêm phím theo quy ước của từng hãng (Yamaha, Casio khác nhau) — xem sách hướng dẫn của đàn. **Fingered**: bấm đủ ba nốt như bài trước.',
        'Bật **Sync Start**: đàn chờ, tay trái vừa bấm hợp âm là nhạc đệm chạy. Nút **Intro / Ending** để có đoạn dạo đầu và kết bài.',
        'Khi tập trong app: bấm **Phát** để nghe nhạc đệm của app theo điệu bài, tay phải chơi giai điệu theo.',
      ] },
    ],
  },
  {
    id: 'organ-meo-tap',
    group: 'Mẹo tập',
    title: 'Ghép hai tay và tập mỗi ngày',
    summary: 'Tập tay phải trước, tay trái sau, rồi ghép thật chậm.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        'Mỗi bài: **tay phải** cho thuộc → **tay trái** chỉ đổi hợp âm theo nhịp → **ghép hai tay** ở tốc độ chậm (kéo thanh tốc độ trong app xuống 60–70%).',
        'Ghép tay: chỉ bấm hợp âm ở **phách 1** mỗi ô nhịp, giữ nguyên tới ô sau. Quen rồi mới bấm theo kiểu đệm (bass – hợp âm – hợp âm).',
        'Mỗi ngày 15 phút đều đặn tốt hơn 2 tiếng cuối tuần. Xem **Nhật ký luyện tập** để giữ chuỗi ngày tập.',
        'Đeo **tai nghe** vào đàn để tập khuya không phiền ai; dùng tai nghe với app khi tập nhịp để có nền trống.',
      ] },
      { t: 'link', to: '/tap-nhip', label: 'Tập nhịp', text: 'Chơi theo nền trống, app chấm từng tiếng sớm / muộn — tay trái đệm vững nhịp là bài nghe hay hẳn.' },
    ],
  },
];
