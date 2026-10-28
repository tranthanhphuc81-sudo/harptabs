/**
 * Bài mẫu cho app Sổ Tab Sáo: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), bộ chọn nốt xếp lại cho sáo alto.
 * Giữ giọng gốc nếu vừa tầm sáo, không thì dịch giọng cho vừa; bỏ bài luyện riêng cho kèn (bend, vị trí 2).
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody } from '../lib/converter';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'recorder-scale-f',
  title: 'Thang âm Fa trưởng — sáo alto',
  artist: 'Bài luyện',
  harpKey: 'F', harpType: 'recorderAlto', position: 1, songKey: 'F', bpm: 70, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Nốt Fa thấp bịt kín cả 8 lỗ: thổi thật nhẹ. Sib (Bb4) là thế chéo — nhìn hình thế bấm dưới nốt.',
  body: `# Đi lên
F4 G4 A4 Bb4 C5 D5 E5 F5:2
Fa Sol La Si Đô Rê Mi Fa

# Đi xuống
F5 E5 D5 C5 Bb4 A4 G4 F4:2
Fa Mi Rê Đô Si La Sol Fa
`,
};

export function recorderSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE];
  for (const s of base) {
    if (s.position === 2 || s.tags.includes('bend') || s.sampleId.startsWith('scale')) continue;
    let r = rekeyBody(s.body, s.harpKey, 'F', 'octave', s.harpType ?? 'diatonic', 'recorderAlto');
    if (r.fit.stats.unplayable > 0) r = rekeyBody(s.body, s.harpKey, 'F', 'any', s.harpType ?? 'diatonic', 'recorderAlto');
    if (r.fit.stats.unplayable > 0) continue;
    out.push({
      ...s,
      sampleId: `${s.sampleId}-recorder`,
      harpKey: 'F',
      harpType: 'recorderAlto',
      position: 1,
      songKey: r.fit.shift % 12 === 0 ? s.songKey : undefined,
      chords: transposeChords(s.chords, r.fit.shift),
      body: r.body,
      tags: s.tags.filter((t) => t !== 'tremolo' && t !== 'chromatic'),
      notes: undefined,
    });
  }
  return out;
}
