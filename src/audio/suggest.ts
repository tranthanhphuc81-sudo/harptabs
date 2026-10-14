/**
 * Tự chọn kiểu nhịp hợp với bài (chạy offline): dựa vào nhịp, từ khoá trong tên/thẻ/ghi chú,
 * tiết tấu giai điệu (chùm ba, chấm dôi, lệch nhịp), giọng trưởng/thứ, tốc độ và ngôn ngữ lời.
 */
import type { BeatStyle } from './patterns';
import { estimateTonality, parseTonality } from './harmony';

/** bỏ dấu tiếng Việt, chữ thường (để so từ khoá) */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

export interface SongLike {
  title?: string;
  artist?: string;
  tags?: string[];
  notes?: string;
  timeSig: string;
  bpm: number;
  pickupBeats?: number;
  songKey?: string;
}

interface NoteLike { start: number; beats: number; midi: number | null; lyric?: string }

export interface StyleSuggestion { style: BeatStyle; reason: string }

/** từ khoá thể loại (đã bỏ dấu, chữ thường) → kiểu nhịp; xét theo thứ tự, khớp trước thắng */
const GENRES: [RegExp, BeatStyle, string][] = [
  [/\bbolero\b/, 'bolero', 'có chữ "bolero"'],
  [/\brumba\b/, 'rumba', 'có chữ "rumba"'],
  [/\btango\b/, 'tango', 'có chữ "tango"'],
  [/cha ?cha/, 'chacha', 'có chữ "cha cha"'],
  [/\bbossa\b/, 'bossa', 'có chữ "bossa"'],
  [/\bsamba\b/, 'samba', 'có chữ "samba"'],
  [/\bsalsa\b/, 'salsa', 'có chữ "salsa"'],
  [/\breggae\b/, 'reggae', 'có chữ "reggae"'],
  [/\bska\b/, 'ska', 'có chữ "ska"'],
  [/\bdisco\b/, 'disco', 'có chữ "disco"'],
  [/\bjazz|\bswing\b/, 'jazz', 'nhạc jazz'],
  [/\bpolka\b/, 'polka', 'có chữ "polka"'],
  [/\bmarch\b|hanh khuc/, 'march', 'hành khúc'],
  [/\bvalse\b|\bwaltz\b/, 'waltz', 'điệu valse'],
  [/\bblues\b/, 'shuffle', 'nhạc blues'],
  [/slow ?rock/, 'slowrock', 'có chữ "slow rock"'],
  [/\brock\b/, 'rock', 'nhạc rock'],
];

const COUNTRY = /\bcountry\b|dong que|cao boi|fiddle|bluegrass/;
const LYRICAL = /tru tinh|thanh ca|ru con|lullaby|hymn/;
const FOLK = /dan ca|dong que|folk/;
const FESTIVE = /giang sinh|christmas|nam moi/;

const VIET_CHARS = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;

/** Đặc điểm tiết tấu của giai điệu */
export function rhythmFeatures(notes: NoteLike[], pickupBeats = 0) {
  const played = notes.filter((n) => n.midi !== null);
  const total = played.length || 1;
  const frac = (x: number) => x - Math.floor(x);
  const near = (a: number, b: number) => Math.abs(a - b) < 0.02;
  // chùm ba: độ dài 1/3, 2/3 hoặc bắt đầu ở 1/3, 2/3 phách
  const triplet = played.filter((n) => [1 / 3, 2 / 3].some((d) => near(frac(n.beats), d) || near(frac(n.start - pickupBeats), d))).length / total;
  // chấm dôi kiểu lắc: nốt 3/4 phách theo sau là nốt 1/4 phách
  let dotted = 0;
  for (let i = 0; i + 1 < played.length; i++) if (near(played[i].beats, 0.75) && near(played[i + 1].beats, 0.25)) dotted++;
  // lệch nhịp: nốt bắt đầu ở nửa phách mà ngân từ 1 phách trở lên (vắt qua phách)
  const synco = played.filter((n) => near(frac(n.start - pickupBeats), 0.5) && n.beats >= 1 - 1e-6).length / total;
  const lyrics = notes.map((n) => n.lyric ?? '').join(' ');
  return { triplet, dotted: (2 * dotted) / total, synco, vietnamese: VIET_CHARS.test(lyrics) };
}

export function suggestStyle(song: SongLike, notes: NoteLike[]): StyleSuggestion {
  const text = fold([song.title, song.artist, song.notes, ...(song.tags ?? [])].filter(Boolean).join(' '));
  for (const [re, style, why] of GENRES) if (re.test(text)) return { style, reason: `Bài ${why}` };

  const beats = Number(song.timeSig.split('/')[0]) || 4;
  const bpm = song.bpm;
  if (beats === 3) return { style: 'waltz', reason: 'Nhịp 3/4' };
  if (beats === 6) return { style: 'waltz', reason: 'Nhịp 6/8 đung đưa' };
  if (LYRICAL.test(text)) return { style: 'ballad', reason: 'Bài trữ tình, êm' };
  if (COUNTRY.test(text)) {
    return bpm >= 100
      ? { style: 'train', reason: 'Nhạc đồng quê, nhịp nhanh' }
      : { style: 'country', reason: 'Nhạc đồng quê, nhịp vừa' };
  }

  if (beats === 2) {
    if (bpm >= 112) return { style: 'polka', reason: 'Nhịp 2/4, nhanh' };
    return { style: 'march', reason: 'Nhịp 2/4' };
  }

  const f = rhythmFeatures(notes, song.pickupBeats);
  const key = parseTonality(song.songKey) ?? estimateTonality(notes);
  if (f.triplet > 0.25 || f.dotted > 0.25) {
    return bpm < 80
      ? { style: 'slowrock', reason: 'Giai điệu chùm ba, chậm' }
      : { style: 'shuffle', reason: 'Giai điệu lắc (chùm ba / chấm dôi)' };
  }

  if (f.vietnamese && key.minor && bpm <= 110) return { style: 'bolero', reason: 'Lời Việt, giọng thứ, chậm vừa' };
  if (key.minor && f.synco > 0.15) return { style: 'rumba', reason: 'Giọng thứ, nhiều nốt lệch nhịp' };
  if (key.minor && bpm >= 100) return { style: 'tango', reason: 'Giọng thứ, nhịp vừa nhanh' };

  if (FESTIVE.test(text) && bpm >= 115) return { style: 'train', reason: 'Bài Giáng sinh / năm mới, nhịp nhanh' };
  if (f.synco > 0.2) return { style: bpm >= 110 ? 'rock' : 'rumba', reason: 'Nhiều nốt lệch nhịp' };
  if (bpm < 92) return { style: f.vietnamese ? 'rumba' : 'ballad', reason: f.vietnamese ? 'Lời Việt, chậm' : 'Nhịp chậm, êm' };
  if (bpm >= 110) {
    return FOLK.test(text)
      ? { style: 'train', reason: 'Dân ca, nhịp vừa nhanh' }
      : { style: 'rock', reason: 'Nhịp vừa nhanh' };
  }
  return { style: 'ballad', reason: 'Nhịp vừa' };
}
