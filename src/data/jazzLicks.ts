/**
 * Lick jazz viết bằng tên nốt ở giọng Đô (chơi được trên cả kèn chromatic lẫn diatonic: app tự đổi sang tab).
 * `chords`: chuỗi hợp âm lick đi theo, tính từ hợp âm đầu (rel = nửa cung so với gốc hợp âm đầu);
 * `deg`: hợp âm đầu là bậc mấy trong giọng (ii–V: 2, I: 0). Lick khớp mọi chỗ trong vòng có cùng chuỗi hợp âm
 * (vd. ii–V của giọng thứ tương ứng trong vòng Autumn Leaves) — app tự dịch theo gốc hợp âm.
 */
import type { JazzQuality } from '../lib/jazz';

export interface JazzLick {
  id: string;
  title: string;
  level: 1 | 2 | 3;
  deg: number;
  chords: { rel: number; q: JazzQuality; beats: number }[];
  notes: string;
  tip?: string;
}

const IIV = [{ rel: 0, q: 'm7' as const, beats: 4 }, { rel: 5, q: '7' as const, beats: 4 }];
const IIV_MINOR = [{ rel: 0, q: 'm7b5' as const, beats: 4 }, { rel: 5, q: '7' as const, beats: 4 }];
const I_MAJ = [{ rel: 0, q: 'maj7' as const, beats: 4 }, { rel: 0, q: 'maj7' as const, beats: 4 }];
const TURN = [{ rel: 0, q: 'maj7' as const, beats: 2 }, { rel: 9, q: 'm7' as const, beats: 2 }, { rel: 2, q: 'm7' as const, beats: 2 }, { rel: 7, q: '7' as const, beats: 2 }];
const BLUES_I_IV = [{ rel: 0, q: '7' as const, beats: 4 }, { rel: 5, q: '7' as const, beats: 4 }];

export const JAZZ_LICK_PLACES: Record<string, string> = {
  'm7,7': 'ii – V', 'm7b5,7': 'ii – V thứ', 'maj7,maj7': 'Hợp âm I (maj7)', 'maj7,m7,m7,7': 'I – vi – ii – V', '7,7': 'Jazz blues (I7 – IV7)',
};
export const jazzLickPlace = (l: JazzLick) => JAZZ_LICK_PLACES[l.chords.map((c) => c.q).join(',')] ?? '';

export const JAZZ_LICKS: JazzLick[] = [
  { id: 'arp-ii-v', title: 'Rải hợp âm ii – V', level: 1, deg: 2, chords: IIV,
    notes: 'D4:0.5 F4:0.5 A4:0.5 C5:0.5 B4:2 G4:0.5 B4:0.5 D5:0.5 F5:0.5 E5:2',
    tip: 'Rải 4 nốt của Dm7 rồi G7. Nốt cuối (Mi) dẫn sang hợp âm I.' },
  { id: 'guide-ii-v', title: 'Chỉ nốt 3 và 7', level: 1, deg: 2, chords: IIV,
    notes: 'F4:2 C5:2 B4:2 F5:2',
    tip: 'Nốt 3 và 7 của mỗi hợp âm (guide tones): ít nốt nhưng nghe rõ ngay "màu" jazz.' },
  { id: 'enclosure', title: 'Bao vây nốt đích', level: 2, deg: 2, chords: IIV,
    notes: 'A4:0.5 G#4:0.5 A4 F4 D4 C#5:0.5 D5:0.5 B4 G4:2',
    tip: 'Chơi nốt sát bên (nửa cung dưới) rồi mới vào nốt đích: mẹo bebop kinh điển.' },
  { id: 'cliche-ii-v', title: 'Câu ii – V quen tai', level: 2, deg: 2, chords: IIV,
    notes: 'F4:0.5 G4:0.5 A4:0.5 C5:0.5 D5:1.5 C5:0.5 B4:0.5 A4:0.5 G#4:0.5 G4:0.5 F4:2' },
  { id: 'bebop-down', title: 'Bebop đi xuống', level: 3, deg: 2, chords: IIV,
    notes: 'D5:0.5 C5:0.5 B4:0.5 A4:0.5 G4:0.5 F4:0.5 E4:0.5 D4:0.5 F4:0.5 A4:0.5 C5:0.5 E5:0.5 D5:0.5 B4:0.5 G4',
    tip: 'Chạy đều móc đơn, nhấn nhẹ nốt ở phách lẻ (swing "dài – ngắn").' },
  { id: 'minor-arp', title: 'Rải ii – V thứ', level: 1, deg: 2, chords: IIV_MINOR,
    notes: 'D4:0.5 F4:0.5 G#4:0.5 C5:0.5 B4:2 G4:0.5 B4:0.5 D5:0.5 F5:0.5 D#5:2',
    tip: 'Dm7♭5 có nốt Lab (quãng 5 giảm); nốt cuối Mib dẫn về Cm7.' },
  { id: 'minor-b9', title: 'ii – V thứ màu tối', level: 2, deg: 2, chords: IIV_MINOR,
    notes: 'G#4 F4 D4:2 G#4:0.5 G4:0.5 F4:0.5 D#4:0.5 D4 B3' },
  { id: 'maj7-arp', title: 'Rải Cmaj7', level: 1, deg: 0, chords: I_MAJ,
    notes: 'C4:0.5 E4:0.5 G4:0.5 B4:0.5 D5:2 B4:0.5 G4:0.5 E4:0.5 C4:0.5 r:2',
    tip: 'Thêm nốt 9 (Rê) trên đỉnh cho sáng màu maj7.' },
  { id: 'maj7-lydian', title: 'Maj7 có Fa thăng', level: 2, deg: 0, chords: I_MAJ,
    notes: 'E5 D5:0.5 B4:0.5 A4 G4 F#4:0.5 G4:0.5 B4 G4:2',
    tip: 'Fa thăng (#11) là màu "lydian" hay gặp trên hợp âm maj7.' },
  { id: 'turn-1625', title: 'Turnaround I – vi – ii – V', level: 2, deg: 0, chords: TURN,
    notes: 'E4:0.5 G4:0.5 C5 C5:0.5 A4:0.5 E4 F4:0.5 A4:0.5 C5 B4:0.5 G4:0.5 F4',
    tip: 'Mỗi nửa ô một hợp âm: bắt đầu mỗi cụm bằng nốt 3 của hợp âm đó.' },
  { id: 'jazz-blues-1', title: 'Mở đầu jazz blues', level: 1, deg: 0, chords: BLUES_I_IV,
    notes: 'C4:0.5 E4:0.5 G4:0.5 A#4:0.5 A4:2 A4:0.5 C5:0.5 D#5:0.5 C5:0.5 A4:2' },
];
