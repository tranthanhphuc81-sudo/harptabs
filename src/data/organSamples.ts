/**
 * Bài mẫu cho app Sổ Tab Organ: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), ghi lại bằng tên nốt cho tay phải trên
 * đàn organ 61 phím. Đàn có đủ nốt thăng giáng nên giữ đúng giọng gốc, chỉ dời quãng tám cho nằm vùng tay phải (Đô4–Đô6).
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody } from '../lib/converter';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'organ-scale',
  title: 'Thang âm Đô trưởng — tay phải',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'organ61', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'ballad', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Ngón tay phải: Đô 1 (ngón cái), Rê 2, Mi 3, luồn ngón cái xuống dưới bấm Fa 1, rồi Sol 2, La 3, Si 4, Đô 5. Đi xuống làm ngược lại: Đô 5 … Fa 1, vắt ngón 3 qua bấm Mi.',
  body: `# Đi lên
C4 D4 E4 F4 G4 A4 B4 C5:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
C5 B4 A4 G4 F4 E4 D4 C4:2
Đô Si La Sol Fa Mi Rê Đô
`,
};

const FIVE: SampleSong = {
  sampleId: 'organ-five',
  title: 'Năm ngón Đô – Sol',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'organ61', position: 1, songKey: 'C', bpm: 80, timeSig: '4/4', pickupBeats: 0,
  style: 'ballad', difficulty: 1, tags: ['luyện tập'],
  notes: 'Đặt năm ngón tay phải lên năm phím Đô Rê Mi Fa Sol (ngón 1 trên Đô) và không nhấc bàn tay khỏi vị trí suốt bài.',
  body: `C4 D4 E4 F4 G4:2 G4:2
G4 F4 E4 D4 C4:2 C4:2
C4 E4 D4 F4 E4 G4 F4 D4
C4:4
`,
};

export function organSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [FIVE, SCALE];
  for (const s of base) {
    if (s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'C', 'octave', s.harpType ?? 'diatonic', 'organ61');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'C', 'any', s.harpType ?? 'diatonic', 'organ61');
    if (r.fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${s.sampleId}-organ`,
      harpKey: 'C',
      harpType: 'organ61',
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
