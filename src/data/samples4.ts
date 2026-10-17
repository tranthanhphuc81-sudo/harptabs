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

// ---------- Kèn tremolo 24 lỗ (kiểu châu Á) ----------

const TREMOLO_PICK = ['twinkle', 'ode-to-joy', 'amazing-grace', 'silent-night', 'red-river-valley', 'auld-lang-syne', 'brahms-lullaby'];

const TREMOLO_SCALE: SampleSong = {
  sampleId: 'scale-c-tremolo',
  title: 'Thang âm Đô trưởng (tremolo)',
  harpKey: 'C', harpType: 'tremolo24', position: 1, songKey: 'C', bpm: 80, timeSig: '4/4', pickupBeats: 0,
  style: 'none', difficulty: 1, tags: ['bài tập', 'tremolo'],
  notes: 'Lỗ lẻ thổi, lỗ chẵn hút. Si (-8) và Đô (9) nằm cạnh nhau — giữ môi gọn trong một lỗ, nhích sang từng lỗ một.',
  body: `# Lên
3 -2 5 -4 7 -6 -8 9:2

# Xuống
9 -8 -6 7 -4 5 -2 3:2

# Quãng tám giữa
9 -10 11 -12 13 -14 -16 17:2
17 -16 -14 13 -12 11 -10 9:2
`,
};

/**
 * Bài mẫu cho kèn C tremolo 24 lỗ: lấy từ bài diatonic, cho phép dịch giọng để vừa kèn
 * (tremolo không có nốt thăng giáng); chỉ giữ bài chơi trọn vẹn được.
 */
export function tremoloSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [TREMOLO_SCALE];
  for (const id of TREMOLO_PICK) {
    const s = base.find((x) => x.sampleId === id);
    if (!s) continue;
    const { body, fit } = rekeyBody(s.body, s.harpKey, 'C', 'any', 'diatonic', 'tremolo24');
    if (fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${id}-tremolo`,
      harpKey: 'C',
      harpType: 'tremolo24',
      position: 1,
      // dịch giọng thì giọng bài đổi theo kèn
      songKey: fit.shift % 12 === 0 ? s.songKey : undefined,
      chords: undefined,
      body,
      difficulty: 1,
      tags: [...s.tags, 'tremolo'],
      notes: undefined,
    });
  }
  return out;
}
