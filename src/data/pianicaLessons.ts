/** Bài học cho app Sổ Tab Pianica (kèn pianica / melodica 32 phím). Tab ghi tên nốt: C4 = Đô giữa. */
import type { Lesson } from './lessons';

const P = { harpKey: 'C' as const, harpType: 'pianica32' as const };

export const PIANICA_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật', 'Bảo quản và mẹo'];

export const PIANICA_LESSONS: Lesson[] = [
  {
    id: 'pianica-lam-quen',
    group: 'Bắt đầu',
    title: 'Làm quen kèn pianica',
    summary: 'Lắp ống thổi, cách cầm, phím nào ra nốt nào.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '**Ống thổi dài** (ống mềm): đặt kèn lên bàn, tay phải bấm phím — dễ nhất cho người mới. **Ống ngắn**: cầm kèn dựng đứng trước mặt, tay trái giữ quai sau.',
        'Thổi hơi đều vào ống, **bấm phím nào thì phím đó kêu**. Không bấm phím thì không ra tiếng dù có thổi.',
        'Phím trắng là Đô Rê Mi Fa Sol La Si; phím đen là các nốt thăng / giáng. Đô nằm **ngay bên trái nhóm hai phím đen**.',
        'Pianica 32 phím có ba nốt Đô: Đô3 (gần đầu trái), **Đô4 (Đô giữa)** và Đô5. Bài trong app thường nằm quanh Đô4 – Đô5.',
      ] },
      { t: 'diagram', ...P },
      { t: 'tip', text: 'Chạm vào phím trên sơ đồ để nghe. Bật Cài đặt → Hiện tên nốt để xem Đô-Rê-Mi phía trên tab.' },
    ],
  },
  {
    id: 'pianica-doc-tab',
    group: 'Bắt đầu',
    title: 'Đọc tab pianica',
    summary: 'Tên nốt có số quãng tám, hình bàn phím dưới mỗi nốt.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        'Tab ghi **tên nốt**: `C4` là Đô giữa, `D4` Rê, `E4` Mi… `C5` là Đô cao hơn một quãng tám.',
        'Số sau chữ là **quãng tám**: cùng chữ C nhưng `C5` cao hơn `C4`. Dấu `#` là thăng (phím đen bên phải), `b` là giáng (phím đen bên trái).',
        'Dưới mỗi nốt có **hình bàn phím nhỏ**, phím cần bấm được tô màu — nhìn vị trí là bấm được, không cần thuộc tên nốt.',
        'Ô dài hơn = giữ phím lâu hơn; dấu – là nghỉ (ngừng thổi).',
      ] },
      { t: 'tab', caption: 'Twinkle Twinkle Little Star', body: 'C4 C4 G4 G4 A4 A4 G4:2\nF4 F4 E4 E4 D4 D4 C4:2\n', bpm: 90, style: 'ballad', ...P },
    ],
  },
  {
    id: 'pianica-ngon-tay',
    group: 'Kỹ thuật',
    title: 'Đặt ngón tay và thang âm Đô',
    summary: 'Năm ngón tay phải, luồn ngón cái để đi hết thang âm.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Đánh số ngón tay phải: **1 = ngón cái**, 2 trỏ, 3 giữa, 4 áp út, 5 út.',
        'Đặt ngón 1 lên Đô4: năm ngón phủ Đô Rê Mi Fa Sol — chơi được rất nhiều bài thiếu nhi mà không cần dời tay.',
        'Thang âm Đô đủ tám nốt: 1-2-3 (Đô Rê Mi), **luồn ngón cái** xuống dưới bấm Fa, rồi 2-3-4-5 (Sol La Si Đô).',
        'Cổ tay thả lỏng, ngón hơi cong như đang cầm quả cam; bấm bằng đầu ngón.',
      ] },
      { t: 'tab', caption: 'Thang âm Đô trưởng', body: 'C4 D4 E4 F4 G4 A4 B4 C5:2\nC5 B4 A4 G4 F4 E4 D4 C4:2\n', bpm: 72, style: 'metronome', ...P },
    ],
  },
  {
    id: 'pianica-hoi-tho',
    group: 'Kỹ thuật',
    title: 'Hơi thổi và đánh lưỡi',
    summary: 'Thổi đều, tách nốt bằng lưỡi "tu", nốt dài giữ hơi.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        'Thổi **nhẹ và đều** như thổi nguội cốc trà; thổi mạnh quá tiếng bị rè và nhanh hết hơi.',
        'Hai nốt giống nhau liền nhau (C4 C4): giữ phím, **đánh lưỡi "tu – tu"** để tách nốt, không cần nhấc tay.',
        'Nốt dài: giữ phím và giữ hơi đến hết ô; lấy hơi ở chỗ nghỉ hoặc cuối câu.',
        'Có thể bấm **hai ba phím cùng lúc** để ra hợp âm (Đô + Mi + Sol = hợp âm C).',
      ] },
      { t: 'tab', caption: 'Mary Had a Little Lamb', body: 'E4 D4 C4 D4 E4 E4 E4:2\nD4 D4 D4:2 E4 G4 G4:2\n', bpm: 96, style: 'ballad', ...P },
      { t: 'link', to: '/tap-cao-do?mode=hold', label: 'Tập giữ hơi nốt dài', text: 'Thổi một nốt thật đều: app đo giữ được bao lâu và cao độ có chao không.' },
    ],
  },
  {
    id: 'pianica-bao-quan',
    group: 'Bảo quản và mẹo',
    title: 'Giữ kèn sạch và bền',
    summary: 'Xả hơi ẩm, rửa ống thổi, cất đúng cách.',
    minutes: 3,
    blocks: [
      { t: 'list', items: [
        'Sau khi thổi: bấm **nút xả nước** (phía dưới / bên hông kèn) và thổi nhẹ để đẩy hơi ẩm ra.',
        'Rửa **ống thổi** bằng nước ấm, để khô rồi mới cất. Mỗi người một ống thổi riêng.',
        'Không để kèn dưới nắng hay trong xe nóng: lưỡi gà bên trong dễ lệch tiếng.',
        'Kèn kêu sai nốt hoặc kẹt phím: dùng Dò nốt trong app để kiểm tra, mang ra tiệm nhạc chỉnh lưỡi gà.',
      ] },
    ],
  },
];
