/** Bài học cho app Sổ Tab Đàn Tranh (đàn tranh 16 / 17 dây, dây Bắc tông Đô). Tab ghi số dây, ^ = nhấn. */
import type { Lesson } from './lessons';

const T = { harpKey: 'C' as const, harpType: 'tranh17' as const };

export const TRANH_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật', 'Bảo quản và mẹo'];

export const TRANH_LESSONS: Lesson[] = [
  {
    id: 'tranh-lam-quen',
    group: 'Bắt đầu',
    title: 'Làm quen đàn tranh',
    summary: 'Tư thế, móng gảy, dây nào trầm, dây nào cao.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Đặt đàn nằm ngang trước mặt, **đầu to (dây trầm) phía xa người, hơi chếch sang trái**; ngồi thẳng lưng, vai thả lỏng.',
        'Tay phải đeo **móng gảy** ở ngón cái, trỏ, giữa; gảy dây **phía bên phải nhạn** (con ngựa đỡ dây).',
        'Tay trái đặt **phía bên trái nhạn**: dùng để **nhấn** (cho nốt cao lên), rung, vuốt.',
        'App đánh số dây từ **dây 1 = dây trầm nhất** (dây xa người nhất). Đàn 17 dây tông Đô lên dây Bắc: dây 1 là Sol, rồi La, Đô, Rê, Mi lặp lại.',
      ] },
      { t: 'diagram', ...T },
      { t: 'tip', text: 'Chạm vào dây trên sơ đồ để nghe. Bật Cài đặt → Hiện tên nốt để thấy Đô-Rê-Mi phía trên số dây.' },
    ],
  },
  {
    id: 'tranh-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab đàn tranh',
    summary: 'Số dây, dấu nhấn, hình dây đàn dưới mỗi nốt.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        'Tab ghi **số dây cần gảy**: `3` là dây 3 (Đô giữa), `6` là dây 6 (Sol)…',
        'Dưới mỗi số có **hình các dây**, dây tô màu là dây cần gảy, dây 1 nằm bên trái.',
        '**↑½** (gõ `^`): tay trái nhấn dây đó cho cao lên **nửa cung**. **↑1** (gõ `^^`): nhấn cho cao lên **một cung**.',
        'Ô dài hơn = để dây ngân lâu hơn; dấu – là nghỉ (chặn dây cho tắt tiếng).',
      ] },
      { t: 'tab', caption: 'Thang âm ngũ cung Đô – Rê – Mi – Sol – La', body: '3 4 5 6 7 8:2\n8 7 6 5 4 3:2\n', bpm: 72, style: 'metronome', ...T },
    ],
  },
  {
    id: 'tranh-nhan',
    group: 'Kỹ thuật',
    title: 'Kỹ thuật nhấn',
    summary: 'Nhấn nửa cung, một cung để có Fa, Si và các nốt thiếu.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Dây Bắc chỉ có Sol La Đô Rê Mi. Muốn có **Fa**: gảy dây Mi rồi **nhấn nửa cung** (`5^`). Muốn có **Si**: gảy dây La rồi **nhấn một cung** (`7^^`).',
        'Cách nhấn: ngón trỏ + giữa tay trái đặt lên dây, **cách nhạn khoảng một gang tay**, ấn xuống đều. Gảy trước rồi nhấn, hoặc nhấn sẵn rồi gảy.',
        'Nhấn bao nhiêu là đủ? Mở **Dò nốt**, gảy dây vừa nhấn và nhìn kim: kim chỉ đúng nốt là đạt.',
        'Nhấn một cung cần lực mạnh hơn nhiều so với nửa cung — tập chậm, nghe kỹ.',
      ] },
      { t: 'tab', caption: 'Twinkle Twinkle Little Star (Fa = Mi nhấn nửa cung)', body: '3 3 6 6 7 7 6:2\n5^ 5^ 5 5 4 4 3:2\n', bpm: 80, style: 'ballad', ...T },
    ],
  },
  {
    id: 'tranh-rung-vuot',
    group: 'Kỹ thuật',
    title: 'Rung, vỗ, vuốt — làm tiếng đàn có hồn',
    summary: 'Các kỹ thuật tay trái đặc trưng của đàn tranh.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '**Rung**: sau khi gảy, tay trái nhấn – nhả nhẹ liên tục phía trái nhạn cho tiếng ngân lượn sóng.',
        '**Vỗ**: gảy xong, tay trái ấn nhanh rồi nhả một lần — tiếng nảy lên rồi trở về.',
        '**Vuốt (luyến)**: gảy dây rồi nhấn dần để nốt trượt lên nốt kế (ví dụ Mi trượt lên Fa).',
        '**Á**: gảy dây khi đang nhấn, rồi nhả ra — nốt trượt xuống.',
        'App phát nốt nhấn như nốt bình thường; các kỹ thuật này bạn tự thêm khi đã thuộc bài.',
      ] },
    ],
  },
  {
    id: 'tranh-len-day',
    group: 'Bảo quản và mẹo',
    title: 'Lên dây bằng app',
    summary: 'Dây Bắc / Đảo, chỉnh từng dây với Dò nốt.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Chọn kiểu lên dây trong **Cài đặt → Lên dây đàn tranh**: **dây Bắc** (Sol La Đô Rê Mi — phổ biến, người mới học) hoặc **dây Đảo** (Sol La Đô Rê Fa).',
        'Mở **Dò nốt**, gảy từng dây buông từ dây 1. Kim lệch trái (thấp) → vặn trục cho căng dây; lệch phải (cao) → nới dây. Dời nhạn chỉnh tinh.',
        'Bài ở tông khác: chọn **tông đàn** trong bài (tông Rê: cả bộ dây cao lên một cung, dây 1 thành La).',
      ] },
      { t: 'warn', text: 'Đàn tranh dây kim loại, vặn từng chút — lên quá căng dễ đứt dây. Để đàn nơi khô ráo, tránh nắng.' },
    ],
  },
];
