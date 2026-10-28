import { HarpType, isFretted, isPianica, isKalimba, isRecorder, isSaoTruc, isTremolo } from '../lib/harp';
/**
 * Tự chọn kiểu nhịp hợp với bài (chạy offline): dựa vào nhịp, từ khoá trong tên/thẻ/ghi chú,
 * tiết tấu giai điệu (chùm ba, chấm dôi, lệch nhịp), giọng trưởng/thứ, tốc độ và ngôn ngữ lời.
 */
import type { BeatStyle } from './patterns';
import type { Instrument } from './engine';
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
  harpType?: HarpType;
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

export interface InstrumentSuggestion { instrument: Instrument; reason: string }

/** tên nhạc cụ nhắc trong tên / thẻ / ghi chú (đã bỏ dấu) → nhạc cụ đó */
const NAMED_INSTRUMENTS: [RegExp, Instrument][] = [
  [/sao truc|\bflute\b/, 'flute'],
  // phải đứng trước "piano"
  [/piano dien|electric piano|\brhodes\b/, 'epiano'],
  [/\bpiano\b|duong cam/, 'piano'],
  [/\bguitar\b|ghi ?ta\b/, 'guitar'],
  [/\bviolin\b|vi ?cam\b|\bfiddle\b/, 'violin'],
  [/accordion|phong cam/, 'accordion'],
  [/\borgan\b/, 'organ'],
  [/\bsax/, 'sax'],
  [/huyt sao|\bwhistl/, 'whistle'],
  [/dan bau|monochord/, 'danbau'],
  [/dan tranh|\bzither\b/, 'dantranh'],
  [/trumpet|ken dong/, 'trumpet'],
  [/clarinet/, 'clarinet'],
  [/\bcello\b|vi ?ong ?can|violoncell/, 'cello'],
  [/marimba|xylophone|moc cam/, 'marimba'],
  [/hop nhac|music ?box/, 'musicbox'],
  // không dùng "chorus": trong tab đó là tên đoạn điệp khúc
  [/hop xuong|\bchoir\b/, 'choir'],
  [/dan nhi|\berhu\b|dan co\b/, 'dannhi'],
  [/ken bau|\bsuona\b/, 'kenbau'],
  [/dan nguyet|dan kim|mandolin|vong co|cai luong/, 'dannguyet'],
  [/ukulele|hawaii|aloha/, 'ukulele'],
  [/\bbanjo\b|bluegrass/, 'banjo'],
  // không dùng "harp": "blues harp" là kèn harmonica
  [/dan hac/, 'danhac'],
  [/ocarina/, 'ocarina'],
  [/vibraphone|\bvibes\b/, 'vibraphone'],
  [/kalimba|mbira/, 'kalimba'],
  [/\bsynth|nhac dien tu/, 'synth'],
  [/steel ?drum|steel ?pan|trong thep|calypso/, 'steeldrum'],
  [/theremin/, 'theremin'],
  [/8 ?-?bit|chiptune|nhac game|\bmario\b|tetris|pokemon/, 'chiptune'],
  [/kazoo/, 'kazoo'],
  [/talkbox|\brobot\b/, 'talkbox'],
  [/\bmeow\b|meo keu|tieng meo/, 'meow'],
  [/giot nuoc|water ?drop/, 'waterdrop'],
  [/ly thuy tinh|glass ?harp|glass harmonica/, 'glassharp'],
  [/vu tru|\bspace\b|galaxy|ngan ha|thien ha/, 'space'],
  // từ dễ trùng sau khi bỏ dấu: "đàn đá" ~ "dân dã", "khèn" ~ "khen", "t'rưng" ~ "Trung thu", "saw" = "đã thấy" → chỉ dùng cụm rõ nghĩa
  [/vit keu|tieng vit|\bquack|\bduck\b/, 'duck'],
  [/chim hot|tieng chim|\bbirds? ?song|\bchirp/, 'bird'],
  [/ech keu|tieng ech|ech op|\bfrogs?\b/, 'frog'],
  [/chut chit|\bsqueak/, 'squeak'],
  [/bong bong|\bbubbles?\b/, 'bubble'],
  [/\blaser\b|piu piu/, 'laser'],
  [/chuong gio|wind ?chimes?/, 'windchime'],
  [/cua nhac|musical saw/, 'musicalsaw'],
  [/radio xua|\bgramophone|dia than|\bvinyl\b/, 'oldradio'],
  [/dan da tay nguyen|dan da ndut|lithophone/, 'danda'],
  [/t' ?rung|\btrung tay nguyen/, 'dantrung'],
  [/tieng khen|khen (mong|meo|be|h'?mong)\b|\bkhaen\b/, 'khen'],
];

const HYMN = /thanh ca|thanh vinh|\bhymn\b|\bchoral\b/;
const LULLABY = /lullaby|wiegenlied|berceuse|\bhat ru\b|\bru em\b/;
/** chắc chắn là nhạc dân tộc Việt */
const VN_FOLK = /dan ca (viet|bac bo|trung bo|nam bo|mien|tay nguyen|hue|xu nghe|quan ho)|quan ho|vong co|cai luong|nhac dan toc|\bho (keo|gia|mai|hue)\b/;
/** "dân ca", "ru con" chung chung: chỉ tính là của Việt khi không ghi nước khác và có lời Việt */
const FOLK_ANY = /dan ca|ru con/;
const FOREIGN_FOLK = /dan ca (my|anh|phap|duc|nga|y|ai ?len|scotland|tay ban nha|nhat|trung|han)\b/;

/** Nhạc cụ hợp với từng kiểu nhịp (kiểu không ghi = kèn harmonica) */
const STYLE_INSTRUMENT: Partial<Record<BeatStyle, [Instrument, string]>> = {
  bolero: ['guitar', 'Bolero hợp guitar'],
  rumba: ['guitar', 'Rumba hợp guitar'],
  bossa: ['guitar', 'Bossa nova hợp guitar'],
  tango: ['accordion', 'Tango hợp accordion'],
  polka: ['accordion', 'Polka hợp accordion'],
  jazz: ['sax', 'Jazz hợp saxophone'],
  ska: ['sax', 'Ska hợp kèn saxophone'],
  slowrock: ['piano', 'Slow rock hợp piano'],
  ballad: ['piano', 'Ballad hợp piano'],
  chacha: ['organ', 'Cha cha cha hợp organ'],
  disco: ['organ', 'Disco hợp organ'],
  salsa: ['piano', 'Salsa hợp piano'],
  samba: ['flute', 'Samba hợp sáo'],
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Tự chọn nhạc cụ phát giai điệu hợp với bài: tên nhạc cụ nhắc trong bài, thánh ca, dân ca Việt,
 * rồi theo kiểu nhịp đang phát, tốc độ và quãng âm. Còn lại giữ kèn harmonica.
 */
export function suggestInstrument(song: SongLike, notes: NoteLike[], style: BeatStyle): InstrumentSuggestion {
  // bài cho kèn tremolo: phát bằng tiếng kèn tremolo
  if (isTremolo(song.harpType)) return { instrument: 'tremolo', reason: 'Bài cho kèn tremolo' };
  // bài cho sáo dọc: phát bằng tiếng sáo dọc để nghe đúng như mình sẽ thổi
  if (isRecorder(song.harpType)) return { instrument: 'recorder', reason: 'Bài cho sáo dọc' };
  if (isSaoTruc(song.harpType)) return { instrument: 'flute', reason: 'Bài cho sáo trúc' };
  if (isKalimba(song.harpType)) return { instrument: 'kalimba', reason: 'Bài cho kalimba' };
  if (isPianica(song.harpType)) return { instrument: 'accordion', reason: 'Bài cho kèn pianica' };
  if (isFretted(song.harpType)) return song.harpType === 'ukulele4' ? { instrument: 'ukulele', reason: 'Bài cho ukulele' } : { instrument: 'guitar', reason: 'Bài cho guitar' };
  const text = fold([song.title, song.artist, song.notes, ...(song.tags ?? [])].filter(Boolean).join(' '));
  for (const [re, instrument] of NAMED_INSTRUMENTS) if (re.test(text)) return { instrument, reason: 'Bài ghi rõ nhạc cụ' };
  if (HYMN.test(text)) return { instrument: 'organ', reason: 'Thánh ca hợp organ' };
  if (LULLABY.test(text) && !VN_FOLK.test(text)) return { instrument: 'musicbox', reason: 'Bài hát ru hợp hộp nhạc' };
  const vnLyrics = VIET_CHARS.test(notes.map((n) => n.lyric ?? '').join(' '));
  if (VN_FOLK.test(text) || (FOLK_ANY.test(text) && !FOREIGN_FOLK.test(text) && vnLyrics)) {
    // dân ca chậm, ngân dài: đàn bầu; còn lại sáo trúc
    if (song.bpm < 76) return { instrument: 'danbau', reason: 'Dân ca Việt chậm hợp đàn bầu' };
    return { instrument: 'flute', reason: 'Dân ca Việt hợp sáo trúc' };
  }

  const pitch = median(notes.filter((n) => n.midi !== null).map((n) => n.midi as number));
  if (style === 'waltz') {
    return song.bpm >= 150
      ? { instrument: 'accordion', reason: 'Valse nhanh hợp accordion' }
      : { instrument: 'violin', reason: 'Valse hợp violin' };
  }
  // ballad chậm mà giai điệu nằm cao: violin hát ngân hợp hơn piano
  if (style === 'ballad' && song.bpm < 75 && pitch >= 74) return { instrument: 'violin', reason: 'Ballad chậm, giai điệu cao hợp violin' };
  const byStyle = STYLE_INSTRUMENT[style];
  if (byStyle) return { instrument: byStyle[0], reason: byStyle[1] };
  return { instrument: 'harmonica', reason: 'Giữ tiếng kèn harmonica' };
}
