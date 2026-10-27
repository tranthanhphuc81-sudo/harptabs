/** Bài học cho app Sổ Tab Kalimba (kalimba 17 phím tông C). Tab ghi số 1–7, chấm trên = quãng tám cao. */
import type { Lesson } from './lessons';

const K = { harpKey: 'C' as const, harpType: 'kalimba17' as const };

export const KALIMBA_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật', 'Bảo quản và mẹo'];

export const KALIMBA_LESSONS: Lesson[] = [
  {
    id: 'kalimba-lam-quen',
    group: 'Bắt đầu',
    title: 'Làm quen với kalimba',
    summary: 'Cầm đàn, gảy bằng ngón cái, phím nào ra nốt nào.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Cầm đàn bằng hai tay, hai **ngón cái** đặt lên phím, các ngón còn lại đỡ mặt sau.',
        'Gảy bằng **mép móng / đầu ngón cái**, đẩy phím xuống rồi thả trượt ra. Gảy nhẹ cũng đủ vang.',
        '**Phím dài nhất ở giữa** là nốt thấp nhất (Đô = 1). Lên cao thì **xen kẽ sang trái, sang phải**: Rê bên trái, Mi bên phải, Fa bên trái…',
        'Nốt bên trái gảy tay trái, bên phải gảy tay phải — hai tay thay nhau rất tự nhiên.',
      ] },
      { t: 'diagram', ...K },
      { t: 'tip', text: 'Nhiều kalimba có số / chấm khắc sẵn trên phím: số 1–7 là Đô–Si, chấm trên là lên quãng tám — giống hệt tab trong app.' },
    ],
  },
  {
    id: 'kalimba-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab kalimba',
    summary: 'Số 1–7, chấm quãng tám, hình phím nhỏ dưới mỗi nốt.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        '**1 2 3 4 5 6 7** = Đô Rê Mi Fa Sol La Si (theo tông kalimba; kalimba C thì 1 = Đô).',
        '**Chấm trên** số (1°) = lên một quãng tám; hai chấm = lên hai quãng tám.',
        'Hình nhỏ dưới mỗi số: 17 phím, **phím tô màu là phím cần gảy**.',
        'Ô dài hơn = ngân lâu hơn; dấu – là nghỉ. Muốn tên Đô-Rê-Mi phía trên: Cài đặt → Hiện tên nốt.',
      ] },
      { t: 'tab', caption: 'Twinkle Twinkle Little Star', body: '1 1 5 5 6 6 5:2\n4 4 3 3 2 2 1:2\n', bpm: 90, style: 'ballad', ...K },
    ],
  },
  {
    id: 'kalimba-hai-tay',
    group: 'Kỹ thuật',
    title: 'Hai tay thay nhau và gảy hai phím',
    summary: 'Luyện đi thang âm xen kẽ trái phải, rồi gảy hai nốt cùng lúc.',
    minutes: 6,
    blocks: [
      { t: 'tab', caption: 'Thang âm Đô trưởng: tay trái – tay phải luân phiên', body: '1 2 3 4 5 6 7 1°:2\n1° 7 6 5 4 3 2 1:2\n', bpm: 72, style: 'metronome', ...K },
      { t: 'p', text: 'Hai phím **cạnh nhau** (ví dụ 1 và 3, ở hai bên phím giữa) gảy cùng lúc bằng một ngón cái là ra **quãng 3** — hợp âm nhỏ rất hay. Thử gảy 1+3, rồi 3+5.' },
      { t: 'tip', text: 'Tiếng rè: phím chạm nhau hoặc vật lạ dưới cầu đàn. Tiếng tắt nhanh: ngón tay chạm vào phím vừa gảy.' },
    ],
  },
  {
    id: 'kalimba-chinh-day',
    group: 'Bảo quản và mẹo',
    title: 'Chỉnh dây kalimba bằng app',
    summary: 'Dùng trang Dò nốt, gõ nhẹ phím lên / xuống để chỉnh.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Mở **Dò nốt**, gảy từng phím, xem kim lệch bao nhiêu cent.',
        'Nốt **thấp** (kim lệch trái): gõ nhẹ đầu phím **vào trong** cho phần rung ngắn lại.',
        'Nốt **cao** (kim lệch phải): gõ nhẹ phím **ra ngoài** cho phần rung dài ra.',
        'Gõ từng chút bằng búa chỉnh đi kèm đàn, đo lại sau mỗi lần.',
      ] },
      { t: 'warn', text: 'Đừng bẻ cong phím. Kalimba gỗ nên tránh nắng và nơi ẩm; lau phím khô sau khi chơi để không gỉ.' },
    ],
  },
];
