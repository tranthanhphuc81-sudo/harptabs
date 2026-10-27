/** Bài học cho app Sổ Tab Sáo (sáo dọc alto, bấm Baroque). Tab ghi tên nốt; dưới mỗi nốt app vẽ thế bấm. */
import type { Lesson } from './lessons';

const ALTO = { harpKey: 'F' as const, harpType: 'recorderAlto' as const };

export const RECORDER_LESSON_GROUPS = ['Bắt đầu', 'Kỹ thuật', 'Âm nhạc', 'Sáo trúc', 'Bảo quản và mẹo'];

const SAO_DO = { harpKey: 'C' as const, harpType: 'saoTruc6' as const };

export const RECORDER_LESSONS: Lesson[] = [
  {
    id: 'chon-va-cam-sao',
    group: 'Bắt đầu',
    title: 'Chọn và cầm sáo alto',
    summary: 'Sáo alto khác soprano thế nào, tay nào ở trên, ngón cái đặt đâu.',
    minutes: 5,
    blocks: [
      { t: 'list', items: [
        '**Sáo alto (tông Fa)** dài hơn, tiếng trầm ấm; nốt thấp nhất là Fa4. **Sáo soprano (tông Đô)** nhỏ, tiếng cao, hay dùng ở trường. Hai loại **bấm giống hệt nhau**, chỉ khác tên nốt.',
        'Chọn sáo **bấm Baroque** (thường ghi chữ B hoặc "Baroque" trên thân): lỗ thứ 4 nhỏ hơn lỗ thứ 5. App dùng thế bấm Baroque.',
        '**Tay trái ở trên**: ngón cái bịt lỗ sau, ngón trỏ, giữa, áp út bịt 3 lỗ trên. **Tay phải ở dưới**: 4 ngón bịt 4 lỗ dưới, ngón cái tay phải đỡ thân sáo.',
        'Bịt bằng **đệm ngón tay** (phần thịt), không bằng đầu ngón. Ngón thả lỏng, cong tự nhiên.',
      ] },
      { t: 'tip', text: 'Nốt kêu rè hoặc sai: 9/10 lần là có lỗ bịt chưa kín. Ấn nhẹ nhưng phủ hết lỗ.' },
    ],
  },
  {
    id: 'hoi-va-danh-luoi',
    group: 'Bắt đầu',
    title: 'Hơi thở và đánh lưỡi "tu"',
    summary: 'Sáo dọc cần rất ít hơi. Mỗi nốt bắt đầu bằng đầu lưỡi như nói "tu".',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Ngậm nhẹ đầu sáo giữa hai môi (không cắn bằng răng). Thổi **ấm và nhẹ** như hà hơi lên kính. Thổi mạnh quá nốt sẽ vọt lên cao và chói.' },
      { t: 'p', text: 'Mỗi nốt bắt đầu bằng **đánh lưỡi**: đầu lưỡi chạm sau răng trên rồi rời ra như nói "tu" (hoặc "du" cho mềm). Đừng "phù" hơi bằng cổ họng.' },
      { t: 'tab', caption: 'Nốt Đô (tay trái: ngón cái + 3 ngón) giữ đều, mỗi nốt một chữ "tu"', body: 'C5:2 C5:2 C5 C5 C5:2\ntu tu tu tu tu\n', bpm: 72, ...ALTO },
      { t: 'tip', text: 'Nghe kim ở trang **Dò nốt**: giữ hơi đều thì kim đứng yên giữa.' },
    ],
  },
  {
    id: 'not-tay-trai',
    group: 'Bắt đầu',
    title: 'Ba nốt đầu tiên: Mi, Rê, Đô',
    summary: 'Chỉ dùng tay trái, đủ để thổi bài đầu tiên.',
    minutes: 6,
    blocks: [
      { t: 'p', text: 'Trên sáo alto: **Mi5** = ngón cái + ngón trỏ, **Rê5** = thêm ngón giữa, **Đô5** = thêm ngón áp út. Nhìn hình thế bấm dưới từng nốt.' },
      { t: 'tab', caption: 'Bài "Hot cross buns"', body: 'E5 D5 C5:2\nE5 D5 C5:2\nC5:0.5 C5:0.5 C5:0.5 C5:0.5 D5:0.5 D5:0.5 D5:0.5 D5:0.5\nE5 D5 C5:2\n', bpm: 84, style: 'ballad', ...ALTO },
      { t: 'tip', text: 'Đổi nốt bằng cách nhấc / đặt ngón cùng lúc với tiếng "tu", không ngắt hơi giữa chừng.' },
    ],
  },
  {
    id: 'them-tay-phai',
    group: 'Kỹ thuật',
    title: 'Thêm tay phải: xuống tới Fa thấp',
    summary: 'Nốt càng thấp càng phải thổi nhẹ và bịt thật kín.',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Thêm lần lượt ngón tay phải: La4, Sol4, Fa4. **Fa4** bịt kín cả 8 lỗ — nốt khó nhất cho người mới: thổi thật nhẹ, bịt thật kín.' },
      { t: 'tab', caption: 'Thang âm Fa trưởng', body: 'F4 G4 A4 Bb4 C5 D5 E5 F5:2\nF5 E5 D5 C5 Bb4 A4 G4 F4:2\n', bpm: 66, style: 'metronome', ...ALTO },
      { t: 'diagram', ...ALTO },
    ],
  },
  {
    id: 'the-cheo-nua-lo',
    group: 'Kỹ thuật',
    title: 'Thế chéo và bịt nửa lỗ',
    summary: 'Sib, Fa#, Sol# không bấm "lần lượt" mà phải bấm chéo hoặc bịt nửa lỗ đôi.',
    minutes: 8,
    blocks: [
      { t: 'list', items: [
        '**Thế chéo** (cross fingering): mở một lỗ giữa nhưng vẫn bịt các lỗ dưới. Ví dụ **Sib4** trên alto. Trong bảng thế bấm, ô thế chéo có nền đậm hơn.',
        '**Bịt nửa lỗ đôi**: hai lỗ dưới cùng là lỗ đôi; bịt một nửa (một lỗ nhỏ) để ra nốt thăng, như **Fa#4**, **Sol#4**.',
      ] },
      { t: 'tab', caption: 'Luyện Sib: đi qua lại La – Sib – Đô', body: 'A4 Bb4 C5 Bb4 A4:2\nA4 Bb4 C5 D5 C5 Bb4 A4:2\n', bpm: 72, style: 'metronome', ...ALTO },
    ],
  },
  {
    id: 'quang-cao',
    group: 'Kỹ thuật',
    title: 'Quãng cao: hé ngón cái',
    summary: 'Từ Mi6 trở lên, ngón cái chỉ che một nửa lỗ sau (bằng móng hoặc đầu ngón).',
    minutes: 8,
    blocks: [
      { t: 'p', text: 'Gập nhẹ ngón cái để lộ một khe nhỏ ở lỗ sau (hình nửa tròn trong thế bấm). Thổi nhanh hơi hơn một chút nhưng **không mạnh hơn**.' },
      { t: 'tab', caption: 'Lên quãng cao', body: 'C6 D6 E6 F6 G6:2\nG6 F6 E6 D6 C6:2\n', bpm: 66, style: 'metronome', ...ALTO },
      { t: 'tip', text: 'Khe hở ngón cái quá to: nốt bị "vỡ"; quá nhỏ: nốt tụt về quãng dưới. Dùng trang Dò nốt để tìm đúng chỗ.' },
    ],
  },
  {
    id: 'doc-tab-sao',
    group: 'Âm nhạc',
    title: 'Đọc tab sáo trong app',
    summary: 'Tên nốt kèm hình thế bấm, đổi kiểu tên Đô-Rê-Mi trong Cài đặt.',
    minutes: 4,
    blocks: [
      { t: 'list', items: [
        'Mỗi ô là một nốt: **tên nốt** (số nhỏ là quãng tám) và **hình thế bấm**: ● bịt kín, ○ mở, ◐ bịt nửa; lỗ trên cùng lệch trái là ngón cái.',
        'Ô dài hơn = giữ lâu hơn; dấu – là nghỉ.',
        'Muốn tên **Đô Rê Mi** thay cho C D E: vào **Cài đặt → Tên nốt**.',
        'Nhập bài: file MIDI / MusicXML, ảnh khuông nhạc, file mp3 đều được xếp lại cho sáo alto.',
      ] },
      { t: 'link', to: '/jam', label: 'Tập ngẫu hứng jazz trên nền nhạc', text: 'Nền nhạc swing chạy các vòng ii–V–I, hiện thế bấm các nốt của hợp âm đang vang.' },
    ],
  },
  {
    id: 'sao-truc-cam-va-thoi',
    group: 'Sáo trúc',
    title: 'Sáo trúc: cầm sáo và lấy hơi',
    summary: 'Thổi chếch qua lỗ thổi, tay trái gần miệng, bịt bằng đệm ngón.',
    minutes: 6,
    blocks: [
      { t: 'list', items: [
        'Sáo trúc gọi tên theo **tông**: sáo Đô, sáo Rê… Chọn tông sáo ở ô **Tông** khi soạn / xem bài; khi nhập bài, để **Tự chọn** thì app tìm tông sáo hợp nhất.',
        '**Cách gọi nốt** trong app: sáo Đô bịt hết 6 lỗ ra **Sol**, mở dần từ lỗ dưới: La, Si, **Đô** (bịt 3 lỗ trên), Rê, Mi, mở hết ra Fa.',
        'Tay trái bịt 3 lỗ gần lỗ thổi, tay phải 3 lỗ dưới. Bịt bằng đệm ngón tay, ngón thả lỏng.',
        'Môi mím nhẹ, thổi **chếch** vào mép lỗ thổi (như thổi miệng chai). Xoay sáo ra / vào một chút đến khi tiếng tròn nhất.',
      ] },
      { t: 'tip', text: 'Quãng 2: giữ nguyên thế bấm, mím môi hẹp hơn và thổi nhanh hơi hơn (không phải mạnh hơn).' },
    ],
  },
  {
    id: 'sao-truc-the-bam',
    group: 'Sáo trúc',
    title: 'Bảng thế bấm sáo trúc 6 lỗ',
    summary: 'Thang âm sáo Đô và cách bịt nửa lỗ để ra nốt thăng / giáng.',
    minutes: 8,
    blocks: [
      { t: 'diagram', ...SAO_DO },
      { t: 'tab', caption: 'Thang âm trên sáo Đô (bịt hết lỗ = Sol)', body: 'G4 A4 B4 C5 D5 E5 F5 G5:2\nG5 F5 E5 D5 C5 B4 A4 G4:2\n', bpm: 66, style: 'metronome', ...SAO_DO },
      { t: 'p', text: 'Nốt thăng / giáng (Đô#, Rê#, Sib…): **bịt nửa lỗ** ngay dưới lỗ đang mở — trong hình thế bấm là ô nửa tròn. Fa# khó, dùng thế chéo ở quãng 2.' },
      { t: 'warn', text: 'Mỗi nơi dạy sáo trúc có thể gọi tên tông / nốt hơi khác. Nếu sáo của bạn bịt hết lỗ không ra Sol (với sáo Đô), hãy báo để chỉnh lại.' },
    ],
  },
  {
    id: 'bao-quan-sao',
    group: 'Bảo quản và mẹo',
    title: 'Bảo quản sáo dọc',
    summary: 'Làm ấm trước khi thổi, lau hơi nước sau khi thổi.',
    minutes: 3,
    blocks: [
      { t: 'list', items: [
        'Mùa lạnh: ủ đầu sáo trong tay vài phút trước khi thổi để hơi nước không đọng làm tiếng khàn.',
        'Tiếng bị nghẹt giữa bài: bịt lỗ thoát hơi (khe ở đầu) và thổi mạnh một hơi ngắn để đẩy nước ra.',
        'Thổi xong: tháo các khúc, lau khô bằng que lau, để khô tự nhiên. Không phơi nắng.',
        'Sáo nhựa rửa được bằng nước ấm (không nóng). Sáo gỗ thỉnh thoảng lau dầu chuyên dụng theo hướng dẫn hãng.',
      ] },
    ],
  },
];
