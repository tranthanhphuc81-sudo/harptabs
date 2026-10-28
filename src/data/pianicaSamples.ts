/**
 * Bài mẫu cho app Sổ Tab Pianica: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), ghi lại bằng tên nốt cho pianica 32 phím.
 * Pianica có đủ nốt thăng giáng nên giữ đúng giọng gốc, chỉ dời quãng tám cho nằm giữa bàn phím.
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody } from '../lib/converter';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'pianica-scale',
  title: 'Thang âm Đô trưởng — pianica',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'pianica32', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Tay phải: ngón 1 (cái) Đô, 2 Rê, 3 Mi, luồn ngón cái xuống bấm Fa, rồi 2 Sol, 3 La, 4 Si, 5 Đô. Đi xuống làm ngược lại.',
  body: `# Đi lên
C4 D4 E4 F4 G4 A4 B4 C5:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
C5 B4 A4 G4 F4 E4 D4 C4:2
Đô Si La Sol Fa Mi Rê Đô
`,
};

export function pianicaSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE];
  for (const s of base) {
    if (s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'C', 'octave', s.harpType ?? 'diatonic', 'pianica32');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'C', 'any', s.harpType ?? 'diatonic', 'pianica32');
    if (r.fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${s.sampleId}-pianica`,
      harpKey: 'C',
      harpType: 'pianica32',
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
