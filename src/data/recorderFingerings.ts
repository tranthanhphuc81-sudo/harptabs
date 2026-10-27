/**
 * Thế bấm sáo dọc (recorder) kiểu Baroque, viết cho sáo soprano tông C (nốt viết từ C4).
 * Sáo alto tông F dùng đúng các thế bấm này, cao độ thấp hơn một quãng 4 đúng: thế "C" của soprano là F4 trên alto.
 *
 * Mỗi thế bấm 8 ký tự theo thứ tự: ngón cái (lỗ sau), ngón 1–3 tay trái, ngón 4–7 tay phải.
 *   x = bịt kín, o = mở, h = bịt nửa (ngón cái hé ở quãng cao; nửa lỗ đôi ở ngón 6, 7)
 * Nguồn: bảng thế bấm Baroque phổ biến (Yamaha / Aulos / Moeck). Kiểm lại với bảng đi kèm sáo nếu thấy lệch.
 */

/** độ khó: 0 = thế thường, 1 = thế chéo / ngón cái hé, 1.5 = bịt nửa lỗ, 2.5 = nốt rất cao, khó ra tiếng */
export interface RecorderFingering { fingers: string; cost: number; kind: 'normal' | 'cross' | 'half' | 'high' }

/** chỉ số 0 = C4 viết của soprano (= F4 trên alto), mỗi bước một nửa cung, tới D6 (27 nốt) */
export const RECORDER_FINGERINGS: RecorderFingering[] = [
  { fingers: 'xxxxxxxx', cost: 0, kind: 'normal' }, // C
  { fingers: 'xxxxxxxh', cost: 1.5, kind: 'half' }, // C#
  { fingers: 'xxxxxxxo', cost: 0, kind: 'normal' }, // D
  { fingers: 'xxxxxxho', cost: 1.5, kind: 'half' }, // Eb
  { fingers: 'xxxxxxoo', cost: 0, kind: 'normal' }, // E
  { fingers: 'xxxxxoxx', cost: 1, kind: 'cross' }, // F
  { fingers: 'xxxxoxxo', cost: 1, kind: 'cross' }, // F#
  { fingers: 'xxxxoooo', cost: 0, kind: 'normal' }, // G
  { fingers: 'xxxoxxho', cost: 1.5, kind: 'half' }, // G#
  { fingers: 'xxxooooo', cost: 0, kind: 'normal' }, // A
  { fingers: 'xxoxxooo', cost: 1, kind: 'cross' }, // Bb
  { fingers: 'xxoooooo', cost: 0, kind: 'normal' }, // B
  { fingers: 'xoxooooo', cost: 0, kind: 'normal' }, // C (quãng 2)
  { fingers: 'oxxooooo', cost: 0.5, kind: 'normal' }, // C#
  { fingers: 'ooxooooo', cost: 0, kind: 'normal' }, // D
  { fingers: 'ooxxxxxo', cost: 1, kind: 'cross' }, // Eb
  { fingers: 'hxxxxxoo', cost: 1, kind: 'high' }, // E
  { fingers: 'hxxxxoxo', cost: 1, kind: 'high' }, // F
  { fingers: 'hxxxoxoo', cost: 1, kind: 'high' }, // F#
  { fingers: 'hxxxoooo', cost: 1, kind: 'high' }, // G
  { fingers: 'hxxoxooo', cost: 1.5, kind: 'high' }, // G#
  { fingers: 'hxxooooo', cost: 1, kind: 'high' }, // A
  { fingers: 'hxxoxxxo', cost: 2, kind: 'high' }, // Bb
  { fingers: 'hxxoxxoo', cost: 2, kind: 'high' }, // B
  { fingers: 'hxooxxoo', cost: 2.5, kind: 'high' }, // C (quãng 3)
  { fingers: 'hxoxxoxx', cost: 3, kind: 'high' }, // C#
  { fingers: 'hxoxxoxo', cost: 2.5, kind: 'high' }, // D
];

/**
 * Kiểu bấm German (hay gặp ở sáo học sinh rẻ): khác Baroque ở nốt thứ 6 của thang (F trên soprano / Bb trên alto)
 * cho dễ bấm, đổi lại nốt kế bên (F# / B) và F quãng 2 khó hơn. Chỉ số như bảng trên.
 * Kiểm lại với bảng đi kèm sáo: các hãng ghi hơi khác nhau ở quãng cao.
 */
export const GERMAN_OVERRIDES: Record<number, RecorderFingering> = {
  5: { fingers: 'xxxxxooo', cost: 0, kind: 'normal' }, // F (soprano) / Bb (alto): nhấc lần lượt như thang thường
  6: { fingers: 'xxxxoxxx', cost: 1.5, kind: 'cross' }, // F#: thế chéo khó hơn Baroque
  17: { fingers: 'hxxxxooo', cost: 1, kind: 'high' }, // F quãng 2
};
