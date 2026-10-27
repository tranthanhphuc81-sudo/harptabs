/**
 * Bài mẫu cho app Sổ Tab Kalimba: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), xếp lại cho kalimba 17 phím tông C.
 * Kalimba chỉ có nốt trong giọng Đô trưởng: giữ giọng gốc nếu chơi được, không thì dịch giọng; bài còn thiếu nốt thì bỏ.
 */
import { rekeyBody } from '../lib/converter';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'kalimba-scale',
  title: 'Thang âm Đô trưởng — kalimba',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'kalimba17', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Gảy bằng hai ngón cái: nốt bên trái gảy tay trái, bên phải gảy tay phải. Nốt đi lên xen kẽ hai bên.',
  body: `# Đi lên
1 2 3 4 5 6 7 1°:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
1° 7 6 5 4 3 2 1:2
Đô Si La Sol Fa Mi Rê Đô
`,
};

export function kalimbaSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE];
  for (const s of base) {
    if (s.position === 2 || s.tags.includes('bend') || s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'C', 'octave', s.harpType ?? 'diatonic', 'kalimba17');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'C', 'any', s.harpType ?? 'diatonic', 'kalimba17');
    if (r.fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${s.sampleId}-kalimba`,
      harpKey: 'C',
      harpType: 'kalimba17',
      position: 1,
      songKey: r.fit.shift % 12 === 0 ? s.songKey : undefined,
      chords: undefined,
      body: r.body,
      tags: s.tags.filter((t) => t !== 'tremolo' && t !== 'chromatic'),
      notes: undefined,
    });
  }
  return out;
}
