/**
 * Lick ngắn cho kalimba (blues giọng trưởng, vị trí 1: kalimba C chơi blues giọng Đô).
 * Kalimba không có nốt giáng nên dùng thang ngũ cung 1 2 3 5 6 và nốt của hợp âm đang vang.
 * Tab số tính theo tông kalimba nên chơi được trên mọi tông đàn.
 */
import type { Lick } from './licks';

export const KALIMBA_LICKS: Lick[] = [
  { id: 'k-mo-cau', title: 'Mở câu ngũ cung', level: 1, over: 'I', bars: 2,
    body: '1:0.5 2:0.5 3 5:2 r 3:0.5 2:0.5 1:2',
    tip: 'Lên 1 2 3 5 rồi về lại 1: câu hỏi – đáp gọn nhất trên kalimba.' },
  { id: 'k-hoi-ngan', title: 'Câu hỏi ngắn (liên ba)', level: 1, over: 'I', bars: 1,
    body: '5:1/3 6:1/3 5:1/3 3 1 r',
    tip: 'Ba nốt đầu gảy nhanh trong một phách bằng hai ngón cái xen kẽ.' },
  { id: 'k-len', title: 'Lên thang ngũ cung', level: 1, over: 'I', bars: 2,
    body: '1:0.5 2:0.5 3:0.5 5:0.5 6:0.5 1°:0.5 6 5:2 r:2',
    tip: 'Đủ 5 nốt ngũ cung: gảy nốt nào trong số này cũng hợp nền nhạc.' },
  { id: 'k-xuong', title: 'Xuống thang ngũ cung', level: 1, over: 'I', bars: 2,
    body: '1°:0.5 6:0.5 5:0.5 3:0.5 2:0.5 1:0.5 r 1:2 r:2',
    tip: 'Chiều ngược lại của câu trên, kết ở nốt gốc 1.' },
  { id: 'k-iv', title: 'Đáp ở hợp âm IV', level: 1, over: 'IV', bars: 2,
    body: '4:0.5 6:0.5 1° 6:2 r 4:0.5 6:0.5 4:2',
    tip: '4 6 1° là ba nốt của hợp âm IV, hai phím nằm sát nhau bên trái.' },
  { id: 'k-v', title: 'V rồi IV', level: 1, over: 'V', bars: 2,
    body: '5:0.5 7:0.5 2° 7:2 6:0.5 4:0.5 6 4:2',
    tip: 'Ô 9 gảy nốt của hợp âm V (5 7 2°), ô 10 chuyển sang IV (4 6).' },
  { id: 'k-turn', title: 'Turnaround đơn giản', level: 1, over: 'turn', bars: 2,
    body: '1°:0.5 6:0.5 5:0.5 3:0.5 1 r 2:0.5 5:0.5 7 5:2',
    tip: 'Xuống về 1 ở ô 11, rồi 2 5 7 dẫn lại vòng mới.' },
  { id: 'k-cao', title: 'Câu ở quãng cao', level: 2, over: 'I', bars: 2,
    body: '3°:0.5 2°:0.5 1° 6:0.5 5:0.5 3 5:2 r:2',
    tip: 'Bắt đầu ở phím ngắn hai bên mép đàn, đi dần vào giữa.' },
  { id: 'k-nhac-lai', title: 'Nhắc lại một nốt', level: 2, over: 'I', bars: 1,
    body: '1°:0.5 1°:0.5 6:0.5 5:0.5 1° r',
    tip: 'Gảy lặp một phím hai lần liền: luân phiên hai ngón cái cho đều tiếng.' },
  { id: 'k-iv-2', title: 'Chạy ở hợp âm IV', level: 2, over: 'IV', bars: 2,
    body: '6:0.5 1°:0.5 2°:0.5 1°:0.5 6 4:2 r:3',
    tip: 'Câu ngắn rồi để trống gần hết ô thứ hai cho câu đáp.' },
  { id: 'k-v-2', title: 'V rồi IV, đi xuống', level: 2, over: 'V', bars: 2,
    body: '2°:0.5 1°:0.5 7:0.5 5:0.5 2° r 1°:0.5 6:0.5 4 6:2',
    tip: 'Mỗi ô một câu đi xuống, ô sau thấp hơn ô trước.' },
  { id: 'k-lay', title: 'Láy 3 – 2', level: 3, over: 'I', bars: 2,
    body: '3:0.25 2:0.25 3:0.25 2:0.25 3 5:0.5 6:0.5 5 3:0.5 2:0.5 1:2 r',
    tip: 'Hai phím 3 và 2 nằm hai bên phím giữa: gảy xen kẽ hai ngón cái thật nhanh.' },
  { id: 'k-turn-2', title: 'Turnaround liên ba', level: 3, over: 'turn', bars: 2,
    body: '3:1/3 5:1/3 6:1/3 1° 6:1/3 5:1/3 3:1/3 1 5:0.5 7:0.5 2° 5:2',
    tip: 'Liên ba lên rồi xuống ở ô 11, ô 12 dừng ở 5 để quay lại vòng.' },
];
