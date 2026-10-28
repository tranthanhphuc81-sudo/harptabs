/**
 * Bài mẫu cho app Sổ Tab Đàn Tranh: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), xếp lại cho đàn tranh 17 dây tông Đô (dây Bắc).
 * Nốt không có trên dây (Fa, Si…) được ghi bằng nhấn; bộ chọn ưu tiên dây buông, ít nhấn nhất.
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody } from '../lib/converter';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'tranh-scale',
  title: 'Thang âm ngũ cung — đàn tranh',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'tranh17', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Dây Bắc tông Đô: mỗi 5 dây là Sol La Đô Rê Mi. Gảy bằng ngón cái tay phải đi lên, ngón trỏ đi xuống.',
  body: `# Đi lên
3 4 5 6 7 8 9 10 11:2
Đô Rê Mi Sol La Đô Rê Mi Sol

# Đi xuống
11 10 9 8 7 6 5 4 3:2
Sol Mi Rê Đô La Sol Mi Rê Đô
`,
};

export function tranhSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE];
  for (const s of base) {
    if (s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'C', 'octave', s.harpType ?? 'diatonic', 'tranh17');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'C', 'any', s.harpType ?? 'diatonic', 'tranh17');
    if (r.fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${s.sampleId}-tranh`,
      harpKey: 'C',
      harpType: 'tranh17',
      position: 1,
      songKey: r.fit.shift % 12 === 0 ? s.songKey : undefined,
      chords: transposeChords(s.chords, r.fit.shift),
      body: r.body,
      tags: s.tags.filter((t) => t !== 'tremolo' && t !== 'chromatic' && t !== 'bend'),
      notes: undefined,
    });
  }
  return out;
}
