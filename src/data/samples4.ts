/**
 * Bài mẫu cho kèn C chromatic 12 lỗ: lấy từ bài mẫu diatonic, giữ đúng giọng gốc,
 * để bộ chọn lỗ xếp lại tab cho kèn chromatic (nốt bend / overblow thành nốt bấm gạt).
 */
import { difficultyOf, rekeyBody } from '../lib/converter';
import { countTechniques, parseTab } from '../lib/tabText';
import type { SampleSong } from './samples';

const PICK = [
  'twinkle', 'ode-to-joy', 'amazing-grace', 'silent-night', 'red-river-valley',
  'danny-boy', 'auld-lang-syne', 'scarborough-fair', 'greensleeves',
];

const FUR_ELISE: SampleSong = {
  sampleId: 'fur-elise-chromatic',
  title: 'Für Elise (đoạn đầu)',
  artist: 'Ludwig van Beethoven',
  harpKey: 'C', harpType: 'chromatic', position: 1, songKey: 'Am', bpm: 72, timeSig: '3/4', pickupBeats: 1,
  style: 'none', difficulty: 2, tags: ['cổ điển', 'chromatic'],
  notes: 'Rê thăng là -5< (hút lỗ 5, bấm gạt), Sol thăng là 3< (thổi lỗ 3, bấm gạt). Bấm gạt dứt khoát rồi nhả ngay.',
  body: `# Câu 1
6:0.5 -5<:0.5
6:0.5 -5<:0.5 6:0.5 -4:0.5 -5:0.5 5:0.5
-3 r:0.5 1:0.5 2:0.5 -3:0.5
-4 r:0.5 2:0.5 3<:0.5 -4:0.5
5 r:0.5 2:0.5 6:0.5 -5<:0.5

# Câu 2
6:0.5 -5<:0.5 6:0.5 -4:0.5 -5:0.5 5:0.5
-3 r:0.5 1:0.5 2:0.5 -3:0.5
-4 r:0.5 2:0.5 5:0.5 -4:0.5
-3:3
`,
};

/** cần danh sách bài diatonic để chuyển; gọi từ samples.ts */
export function chromaticSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [];
  for (const id of PICK) {
    const s = base.find((x) => x.sampleId === id);
    if (!s) continue;
    const { body, fit } = rekeyBody(s.body, s.harpKey, 'C', 'octave', 'diatonic', 'chromatic');
    const stats = countTechniques(parseTab(body, 'C', 'chromatic'));
    out.push({
      ...s,
      sampleId: `${id}-chromatic`,
      harpKey: 'C',
      harpType: 'chromatic',
      position: 1,
      songKey: s.songKey,
      body,
      difficulty: difficultyOf({ ...stats, notes: fit.stats.notes }),
      tags: [...s.tags, 'chromatic'],
      notes: undefined,
    });
  }
  out.push(FUR_ELISE);
  return out;
}
