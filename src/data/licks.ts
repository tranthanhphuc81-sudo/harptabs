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
  { id: 'octave-nhay', title: 'Nhảy quãng tám', level: 2, over: 'I', bars: 2,
    body: "-2 6:0.5 -2:0.5 6 -5 -4 -3' -2:2",
    tip: 'Nhảy từ -2 lên 6 (cùng nốt Sol, cách nhau quãng tám) tạo câu rộng mở.' },
  { id: 'wah-wah', title: 'Wah-wah tay phải', level: 1, over: 'I', bars: 2,
    body: '-4 -4 -4 -4 -4 -4 -4 -4',
    tip: 'Giữ nguyên nốt -4, chỉ đóng mở tay phải theo nhịp. Nhanh = rộn ràng, chậm = da diết.' },
  { id: 'shake-45', title: 'Shake lỗ 4–5', level: 2, over: 'I', bars: 1,
    body: '-4:0.5 5:0.5 -4:0.5 5:0.5 -4:0.5 5:0.5 -4:0.5 5:0.5',
    tip: 'Lắc nhanh giữa -4 (hút) và 5 (thổi) bằng cách trượt kèn — hiệu ứng rung đặc trưng của Chicago blues.' },
  { id: 'cau-hoi-tram', title: 'Câu hỏi trầm', level: 1, over: 'I', bars: 2,
    body: "-1 -2' -2 -3' -2:4",
    tip: 'Bắt đầu từ lỗ 1 (nốt trầm nhất), leo dần lên tới -3′: câu hỏi chờ câu đáp.' },
  { id: 'riff-ngat', title: 'Riff ngắt nhịp', level: 2, over: 'I', bars: 2,
    body: "-2:0.5 r:0.5 -3':0.5 4:0.5 -4':0.5 -4:1.5 4 -3' -2:2",
    tip: 'Dấu lặng ngắn tạo nhấn nhá. Nhịp điệu quan trọng hơn số nốt.' },
  { id: 'doi-chieu', title: 'Hỏi đáp đơn giản', level: 1, over: 'I', bars: 2,
    body: "-2 -3' -3 r -4 -3' -2 r",
    tip: 'Câu đầu đi lên (hỏi), câu sau đi xuống (đáp). Cấu trúc blues cơ bản nhất.' },
  { id: 'iv-day', title: 'Riff đầy trên IV', level: 2, over: 'IV', bars: 2,
    body: "4:0.5 5:0.5 6:0.5 5:0.5 4:0.5 5:0.5 6 5 -3':2 r",
    tip: 'Chạy nhanh lỗ 4–5–6 rồi kết ở -3′: câu trang sức trên hợp âm IV.' },
  { id: 'v-truot-xuong', title: 'V trượt xuống', level: 1, over: 'V', bars: 2,
    body: "-5 -4 4 -3' -4 4:0.5 -3':0.5 -2:2",
    tip: 'Từ nốt gốc V (-5/Fa) trượt xuống nốt gốc I (-2/Sol): kết ô 9–10 tự nhiên.' },
  { id: 'turn-lac', title: 'Turnaround lắc', level: 2, over: 'turn', bars: 2,
    body: '-4:0.5 -3:0.5 -4:0.5 -3:0.5 -2:0.5 -1:0.5 -2:0.5 -1:0.5 -2:2 -1:2',
    tip: 'Lắc (shake) nốt kép đi xuống: câu kết đầy năng lượng.' },
  { id: 'turn-dut', title: 'Turnaround dứt khoát', level: 1, over: 'turn', bars: 2,
    body: '-4 -3 -2 r -2:4',
    tip: 'Ba nốt đi xuống rồi dừng hẳn: kết bài dứt khoát.' },
];
