/**
 * Lick blues ngắn cho kèn diatonic, vị trí 2 (kèn C chơi giọng Sol). Tab tính theo lỗ nên chơi được trên mọi tông kèn.
 * `over`: lick hợp với chỗ nào trong khung 12 ô — I (ô 1–4, 7–8), IV (ô 5–6), V (ô 9–10: V rồi IV), turn (ô 11–12: I rồi V).
 */
import type { Degree } from '../lib/blues';

export interface Lick {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  over: Degree | 'turn';
  bars: 1 | 2;
  body: string;
  tip?: string;
}

export const LICK_PLACES: Record<Lick['over'], string> = {
  I: 'Hợp âm I (ô 1–4, 7–8)',
  IV: 'Hợp âm IV (ô 5–6)',
  V: 'Ô 9–10 (V → IV)',
  turn: 'Turnaround (ô 11–12)',
};

/** hợp âm nền khi nghe lick: mỗi ô một bậc */
export function lickDegrees(l: Lick): Degree[] {
  const two: Record<Lick['over'], Degree[]> = { I: ['I', 'I'], IV: ['IV', 'IV'], V: ['V', 'IV'], turn: ['I', 'V'] };
  return two[l.over].slice(0, l.bars);
}

export const LICKS: Lick[] = [
  { id: 'mo-cau', title: 'Mở câu kinh điển', level: 1, over: 'I', bars: 2,
    body: "-2:0.5 -3':0.5 -3 -2:2 r -2:0.5 -3':0.5 -2:2",
    tip: 'Đi từ -3′ (nốt blue) lên -3 rồi về -2: câu hỏi kinh điển của blues.' },
  { id: 'hoi-ngan', title: 'Câu hỏi ngắn (liên ba)', level: 1, over: 'I', bars: 1,
    body: "-2:1/3 -3':1/3 -3:1/3 -2 r:2",
    tip: 'Ba nốt đầu chạy nhanh trong một phách, rồi để trống cho câu đáp.' },
  { id: 'len-thang-am', title: 'Lên thang âm blues', level: 1, over: 'I', bars: 2,
    body: "-2:0.5 -3':0.5 4:0.5 -4':0.5 -4 -5 6:2 r:2",
    tip: 'Đủ 7 nốt của thang âm blues. Thuộc câu này là có "bản đồ" để ngẫu hứng.' },
  { id: 'xuong-thang-am', title: 'Xuống thang âm', level: 1, over: 'I', bars: 2,
    body: "6:0.5 -5:0.5 -4:0.5 -4':0.5 4 -3' -2:3 r" },
  { id: 'boogie', title: 'Boogie', level: 2, over: 'I', bars: 2,
    body: '-2:0.5 -3:0.5 -4:0.5 5:0.5 -5:0.5 5:0.5 -4:0.5 -3:0.5 -2:0.5 -3:0.5 -4:0.5 5:0.5 -5:0.5 5:0.5 -4:0.5 -3:0.5',
    tip: 'Câu bass boogie-woogie. Nhấn mạnh nốt đầu mỗi phách, giữ nhịp shuffle "dài – ngắn".' },
  { id: 'nhip-tau', title: 'Nhịp tàu hoả', level: 1, over: 'I', bars: 2,
    body: '-2:0.5 -2:0.5 -3:0.5 -3:0.5 -2:0.5 -2:0.5 -3:0.5 -3:0.5 -2:0.5 -2:0.5 -3:0.5 -3:0.5 -2:0.5 -2:0.5 -3:0.5 -3:0.5',
    tip: 'Thay nốt đơn bằng hút cả lỗ 1–3 (hoặc 1–4) cùng lúc thì ra tiếng đệm hợp âm như đoàn tàu.' },
  { id: 'bend-khoc', title: 'Bend "khóc" lỗ 3', level: 2, over: 'I', bars: 2,
    body: "-3'':1 -3' -3:2 -2:3 r",
    tip: 'Bắt đầu nốt đã bend sẵn rồi nhả dần lên -3: tiếng rên đặc trưng của blues.' },
  { id: 'lay-4-5', title: 'Láy -4 / -5', level: 2, over: 'I', bars: 2,
    body: "-4:0.5 -5:0.5 -4:0.5 -5:0.5 -4:0.5 -5:0.5 -4 -3' -2:3",
    tip: 'Lắc nhanh kèn giữa lỗ 4 và 5 (warble), càng nhanh càng rộn ràng.' },
  { id: 'chicago', title: 'Kiểu Chicago', level: 2, over: 'I', bars: 2,
    body: "-4':0.5 -4:0.5 -4 -4:0.5 -5:0.5 -4 -3' -2 -2:2",
    tip: 'Trượt từ -4′ lên -4: bend nhẹ rồi nhả ngay vào nốt.' },
  { id: 'dai-cao', title: 'Lên dải cao', level: 2, over: 'I', bars: 2,
    body: '6 -6:0.5 7:0.5 -8 7 6:2 r:2',
    tip: 'Lỗ 7 trở lên: nốt hút và thổi đổi chỗ, chú ý 7 là thổi, -8 là hút.' },
  { id: 'cao-9', title: 'Đỉnh câu ở lỗ 9', level: 2, over: 'I', bars: 2,
    body: '-9 9:0.5 -8:0.5 8 7 6:2 r:2' },
  { id: 'bend-1-cung', title: 'Bend 1 cung lỗ 2', level: 3, over: 'I', bars: 2,
    body: "-2'' -2 -3' -2':0.5 -2:0.5 -1 -2:3",
    tip: 'Hút lỗ 2 bend 1 cung ra nốt ♭7, khó nhưng rất "đắt".' },
  { id: 'iv-co-ban', title: 'Câu trên hợp âm IV', level: 1, over: 'IV', bars: 2,
    body: "4 5:0.5 6:0.5 5 4 -3':2 4:2",
    tip: 'Ô 5–6 đổi sang hợp âm IV: thổi 4 5 6 là các nốt của hợp âm đó.' },
  { id: 'iv-blue', title: 'IV có nốt blue', level: 2, over: 'IV', bars: 2,
    body: "-5 -4:0.5 -4':0.5 4:2 -3' 4:3" },
  { id: 'iv-cao', title: 'IV dải cao', level: 1, over: 'IV', bars: 2,
    body: '7 6:0.5 5:0.5 6:2 5 4:3' },
  { id: 'v-iv', title: 'Câu V → IV', level: 1, over: 'V', bars: 2,
    body: "-4 -5:0.5 -4:0.5 -4:2 4 5:0.5 4:0.5 -3':2",
    tip: 'Ô 9 là hợp âm V (hút 4 là nốt gốc), ô 10 về IV (thổi 4).' },
  { id: 'v-bend', title: 'V có bend', level: 2, over: 'V', bars: 2,
    body: "-4:0.5 -4':0.5 4 -3'' -4 4:2 -3':2" },
  { id: 'turn-co-ban', title: 'Turnaround cơ bản', level: 1, over: 'turn', bars: 2,
    body: '-2 -3 -4 -3 -2:2 -1:2',
    tip: 'Kết ở -1 (nốt V) để "mời" vòng 12 ô tiếp theo.' },
  { id: 'turn-di-xuong', title: 'Turnaround đi xuống', level: 2, over: 'turn', bars: 2,
    body: "6 -5:0.5 5:0.5 -4 -4' 4 -3' -4:2" },
  { id: 'ket-bai', title: 'Kết bài', level: 1, over: 'turn', bars: 2,
    body: "-4 -3 -3' -2 -2:4",
    tip: 'Dùng ở vòng cuối thay cho turnaround: ngân dài nốt gốc -2.' },
];
