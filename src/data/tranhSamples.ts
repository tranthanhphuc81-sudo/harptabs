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

const BAU_SCALE: SampleSong = {
  sampleId: 'danbau-scale',
  title: 'Các điểm bồi — đàn bầu',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'danbau', position: 1, songKey: 'C', bpm: 66, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm', 'đàn bầu'],
  notes: 'Dây Đô: bồi 1/2 ra Đô, 1/3 Sol, 1/4 Đô, 1/5 Mi, 1/6 Sol. Câu sau thêm Rê, La bằng nắn cần lên một cung.',
  body: `# Các điểm bồi
b2 b3 b4 b5 b6:2
Đô Sol Đô Mi Sol

# Thêm nắn cần
b4 b4+2 b5 b6 b6+2 b8:2
Đô Rê Mi Sol La Đô
`,
};

/** số bài đầu tiên làm thêm bản đàn bầu */
const BAU_COPIES = 8;

export function tranhSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE, BAU_SCALE];
  let bau = 0;
  for (const s of base) {
    if (bau >= BAU_COPIES || s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'C', 'octave', s.harpType ?? 'diatonic', 'danbau');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'C', 'any', s.harpType ?? 'diatonic', 'danbau');
    if (r.fit.stats.unplayable > 0) continue;
    bau++;
    out.push({
      ...s, sampleId: `${s.sampleId}-danbau`, title: `${s.title} (đàn bầu)`, harpKey: 'C', harpType: 'danbau', position: 1,
      songKey: r.fit.shift % 12 === 0 ? s.songKey : undefined, chords: transposeChords(s.chords, r.fit.shift), body: r.body,
      tags: [...s.tags.filter((t) => t !== 'tremolo' && t !== 'chromatic' && t !== 'bend'), 'đàn bầu'], notes: undefined,
    });
  }
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
