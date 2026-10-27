/**
 * Bài mẫu cho app Sổ Tab Guitar: lấy từ bài mẫu harmonica (nhạc phạm vi công cộng), xếp lại lên cần guitar
 * (và một ít bài cho ukulele). Bộ chọn vị trí ưu tiên dây buông và các phím đầu cần đàn.
 */
import { transposeChords } from '../audio/harmony';
import { rekeyBody } from '../lib/converter';
import type { HarpType } from '../lib/harp';
import type { SampleSong } from './samples';

const SCALE: SampleSong = {
  sampleId: 'guitar-scale',
  title: 'Thang âm Đô trưởng — guitar',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'guitar6', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm'],
  notes: 'Thế bấm đầu cần đàn: ngón 1 bấm phím 1, ngón 2 phím 2, ngón 3 phím 3. Đô ở dây 5 phím 3.',
  body: `# Đi lên
5.3 4.0 4.2 4.3 3.0 3.2 2.0 2.1:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
2.1 2.0 3.2 3.0 4.3 4.2 4.0 5.3:2
Đô Si La Sol Fa Mi Rê Đô
`,
};

const UKE_SCALE: SampleSong = {
  sampleId: 'ukulele-scale',
  title: 'Thang âm Đô trưởng — ukulele',
  artist: 'Bài luyện',
  harpKey: 'C', harpType: 'ukulele4', position: 1, songKey: 'C', bpm: 72, timeSig: '4/4', pickupBeats: 0,
  style: 'metronome', difficulty: 1, tags: ['luyện tập', 'thang âm', 'ukulele'],
  notes: 'Dây 3 (Đô) buông là nốt Đô. Ngón 2 bấm phím 2, ngón 3 bấm phím 3.',
  body: `# Đi lên
3.0 3.2 2.0 2.1 2.3 1.0 1.2 1.3:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
1.3 1.2 1.0 2.3 2.1 2.0 3.2 3.0:2
Đô Si La Sol Fa Mi Rê Đô
`,
};

/** số bài đầu tiên làm thêm bản ukulele */
const UKULELE_COPIES = 8;

function convert(s: SampleSong, type: HarpType, suffix: string): SampleSong | null {
  const from = s.harpType ?? 'diatonic';
  const octave = rekeyBody(s.body, s.harpKey, 'C', 'octave', from, type);
  // giữ giọng gốc nếu bấm được ở thế dễ; bài phải lên phím cao (ukulele tầm hẹp) thì dịch giọng cho về đầu cần đàn
  const any = rekeyBody(s.body, s.harpKey, 'C', 'any', from, type);
  const notes = Math.max(1, octave.fit.stats.notes);
  const r = any.fit.stats.unplayable === 0 && (octave.fit.stats.unplayable > 0 || any.fit.cost < octave.fit.cost - Math.max(2, notes * 0.15)) ? any : octave;
  if (r.fit.stats.unplayable > 0) return null;
  const moved = r.fit.shift % 12 !== 0;
  return {
    ...s,
    songKey: moved ? undefined : s.songKey,
    chords: moved ? transposeChords(s.chords, r.fit.shift) : s.chords,
    sampleId: `${s.sampleId}-${suffix}`,
    harpKey: 'C',
    harpType: type,
    position: 1,
    body: r.body,
    tags: [...s.tags.filter((t) => t !== 'tremolo' && t !== 'chromatic' && t !== 'bend'), ...(type === 'ukulele4' ? ['ukulele'] : [])],
    notes: undefined,
  };
}

export function guitarSamples(base: SampleSong[]): SampleSong[] {
  const out: SampleSong[] = [SCALE, UKE_SCALE];
  const songs = base.filter((s) => !s.sampleId.startsWith('scale'));
  for (const s of songs) {
    const g = convert(s, 'guitar6', 'guitar');
    if (g) out.push(g);
  }
  let uke = 0;
  for (const s of songs) {
    if (uke >= UKULELE_COPIES) break;
    const u = convert(s, 'ukulele4', 'ukulele');
    if (u) { out.push({ ...u, title: `${u.title} (ukulele)` }); uke++; }
  }
  return out;
}
