/**
 * Tuỳ chỉnh âm thanh beat (dùng chung cho mọi trang phát, lưu trên máy).
 *
 * Chế độ "Tự động tối ưu": bộ trống, độ lắc, gõ bo, dồn trống, độ vang và âm lượng từng phần
 * tự lấy theo kiểu nhịp đang phát (STYLE_PRESETS); nhạc cụ giai điệu lấy theo bài đang mở
 * (setSongInstrument). Mục nào người dùng chỉnh tay thì được giữ nguyên (danh sách `manual`)
 * cho tới khi bấm "Về tự động".
 */
import { IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP, IS_PIANICA_APP } from '../appConfig';
import { useSyncExternalStore } from 'react';
import { Accomp, applyMix, DrumKit, Instrument } from './engine';
import type { BeatStyle } from './patterns';

export interface BeatPrefs {
  /** nhạc cụ phát giai điệu */
  instrument: Instrument;
  kit: DrumKit;
  /** độ lắc phách lẻ: 0 = thẳng … 0.33 = chùm ba */
  swing: number;
  /** lệch nhẹ thời gian + lực đánh cho giống người chơi */
  humanize: boolean;
  /** dồn trống mỗi 4 ô nhịp, chũm chọe mở câu mới */
  fills: boolean;
  /** bass đệm theo hợp âm tự đoán từ giai điệu */
  bass: boolean;
  /** gõ hợp âm đệm theo kiểu nhịp */
  comp: boolean;
  /** gõ bo: thêm lớp bongo đệm cho mọi kiểu nhịp */
  bo: boolean;
  /** 0…1 */
  beatVol: number;
  melodyVol: number;
  bassVol: number;
  boVol: number;
  bellVol: number;
  /** tiếng gõ hợp âm đệm ("pa pa" của valse) */
  compVol: number;
  clapVol: number;
  reverb: number;
  /** nhạc cụ đệm khi bật "Đệm hát" (tắt giai điệu, chỉ đệm để hát theo) */
  accomp: Accomp;
  /** âm lượng đệm hát (guitar / piano tự đệm) */
  singVol: number;
  /** kỹ thuật tay guitar khi đệm hát: vuốt dây (mở câu), rung dây (nốt ngân), lắc cổ tay (hết câu) */
  gRake: boolean;
  gTrem: boolean;
  gShake: boolean;
  /** trống bo: vuốt bo (luyến mặt da), rung bo (vê dồn cuối câu); lắc = thêm maracas cho mọi kiểu nhịp */
  boSlide: boolean;
  boRoll: boolean;
  lac: boolean;
  /** hiện hợp âm đệm trên tab */
  showChords: boolean;
  /** tự chỉnh âm thanh theo kiểu nhịp */
  auto: boolean;
  /** các mục người dùng đã chỉnh tay khi đang tự động (được giữ nguyên) */
  manual: (keyof BeatPrefs)[];
}

export const DEFAULT_BEAT_PREFS: BeatPrefs = {
  instrument: IS_RECORDER_APP ? 'recorder' : IS_KALIMBA_APP ? 'kalimba' : IS_GUITAR_APP ? 'guitar' : IS_PIANICA_APP ? 'accordion' : 'harmonica', kit: 'acoustic', swing: 0, humanize: true, fills: false, bass: true, comp: true, bo: false,
  beatVol: 0.6, melodyVol: 0.55, bassVol: 0.7, boVol: 0.8, bellVol: 0.8, compVol: 0.7, clapVol: 0.8, reverb: 0.25, accomp: 'gobo', singVol: 0.8, gRake: false, gTrem: false, gShake: false, boSlide: false, boRoll: false, lac: false, showChords: false,
  auto: true, manual: [],
};

/** Các mục chế độ tự động chỉnh theo kiểu nhịp (bật/tắt bass, đệm, hiện hợp âm là sở thích riêng nên không đụng) */
export const AUTO_KEYS = ['kit', 'swing', 'fills', 'bo', 'beatVol', 'bassVol', 'compVol', 'boVol', 'bellVol', 'clapVol', 'reverb'] as const;
type AutoKey = (typeof AUTO_KEYS)[number];
/** Mọi mục tự động (thêm nhạc cụ, chọn theo bài): chỉnh tay mục nào thì giữ mục đó */
const TRACKED_KEYS: readonly (keyof BeatPrefs)[] = [...AUTO_KEYS, 'instrument'];

/** Cài đặt hợp nhất cho từng kiểu nhịp (mục không ghi = mặc định) */
export const STYLE_PRESETS: Partial<Record<BeatStyle, Partial<Pick<BeatPrefs, AutoKey>>>> = {
  rock: { kit: 'acoustic', fills: true },
  ballad: { kit: 'soft', beatVol: 0.5, compVol: 0.55, reverb: 0.35 },
  shuffle: { kit: 'acoustic', fills: true },
  slowrock: { kit: 'acoustic', compVol: 0.45, reverb: 0.3 },
  train: { kit: 'acoustic' },
  bolero: { kit: 'soft', boVol: 0.7, reverb: 0.3 },
  rumba: { kit: 'soft', bo: true, boVol: 0.55, compVol: 0.6, reverb: 0.3 },
  chacha: { kit: 'acoustic', bellVol: 0.6 },
  tango: { kit: 'acoustic', compVol: 0.8 },
  bossa: { kit: 'soft', beatVol: 0.5, compVol: 0.6, reverb: 0.3 },
  disco: { kit: 'electronic', clapVol: 0.7, fills: true },
  jazz: { kit: 'soft', compVol: 0.6, reverb: 0.35 },
  reggae: { kit: 'acoustic', swing: 0.12, compVol: 0.8 },
  ska: { kit: 'acoustic', compVol: 0.8 },
  country: { kit: 'acoustic' },
  march: { kit: 'acoustic', fills: true },
  polka: { kit: 'acoustic' },
  samba: { kit: 'acoustic' },
  salsa: { kit: 'acoustic', bo: true, boVol: 0.6, bellVol: 0.6 },
  waltz: { kit: 'soft', compVol: 0.7 },
};

/** Tốc độ thường gặp của từng kiểu nhịp (bpm, tính theo phách đen) */
export const TEMPO_RANGES: Partial<Record<BeatStyle, [number, number]>> = {
  rock: [100, 140], ballad: [60, 90], shuffle: [90, 130], slowrock: [50, 75], train: [100, 150],
  bolero: [60, 90], rumba: [70, 100], chacha: [110, 130], tango: [110, 135], bossa: [110, 140],
  disco: [110, 130], jazz: [100, 200], reggae: [65, 90], ska: [130, 170], country: [90, 130],
  march: [100, 130], polka: [100, 140], samba: [90, 110], salsa: [160, 200], waltz: [80, 180],
};

export const KIT_OPTIONS: { value: DrumKit; label: string }[] = [
  { value: 'acoustic', label: 'Trống thật' },
  { value: 'electronic', label: 'Điện tử' },
  { value: 'soft', label: 'Nhẹ (chổi)' },
];

export const SWING_OPTIONS = [
  { value: 0, label: 'Thẳng' },
  { value: 0.12, label: 'Lắc nhẹ' },
  { value: 0.22, label: 'Lắc vừa' },
  { value: 0.33, label: 'Lắc đậm' },
];

/** Cài đặt thực dùng khi phát kiểu nhịp `style` (`songInstrument`: nhạc cụ tự chọn cho bài đang mở) */
export function effectivePrefs(p: BeatPrefs, style: BeatStyle, songInstrument: Instrument | null = activeInstrument): BeatPrefs {
  if (!p.auto) return p;
  const out = { ...p } as Record<string, unknown>;
  const preset = STYLE_PRESETS[style] ?? {};
  for (const k of AUTO_KEYS) {
    if (p.manual.includes(k)) continue;
    out[k] = k in preset ? preset[k] : DEFAULT_BEAT_PREFS[k];
  }
  if (!p.manual.includes('instrument')) out.instrument = songInstrument ?? DEFAULT_BEAT_PREFS.instrument;
  return out as unknown as BeatPrefs;
}

const KEY = 'harptabs.beatPrefs';
let prefs: BeatPrefs = load();
let activeStyle: BeatStyle = 'ballad';
let activeInstrument: Instrument | null = null;
applyMix(effectivePrefs(prefs, activeStyle));
const subs = new Set<() => void>();

function load(): BeatPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<BeatPrefs>;
      const merged = { ...DEFAULT_BEAT_PREFS, ...saved };
      // người dùng cũ (trước khi có chế độ tự động): mục đã khác mặc định coi như chỉnh tay
      if (saved.auto === undefined) {
        merged.manual = TRACKED_KEYS.filter((k) => k in saved && saved[k] !== DEFAULT_BEAT_PREFS[k]);
      } else if (merged.auto && !merged.manual.includes('instrument') && merged.instrument !== DEFAULT_BEAT_PREFS.instrument) {
        // trước khi nhạc cụ được tự chọn, nhạc cụ khác mặc định là người dùng tự chọn: giữ nguyên
        merged.manual = [...merged.manual, 'instrument'];
      }
      return merged;
    }
  } catch { /* bỏ qua */ }
  return { ...DEFAULT_BEAT_PREFS };
}

export function getBeatPrefs(): BeatPrefs {
  return prefs;
}

/** Cài đặt thực dùng cho kiểu nhịp `style` */
export function getEffectivePrefs(style: BeatStyle): BeatPrefs {
  return effectivePrefs(prefs, style);
}

/** Trang bài hát báo nhạc cụ tự chọn cho bài (null khi rời bài: về kèn harmonica) */
export function setSongInstrument(inst: Instrument | null) {
  if (inst === activeInstrument) return;
  activeInstrument = inst;
  applyMix(effectivePrefs(prefs, activeStyle));
}

/** Bộ phát báo kiểu nhịp đang phát để áp âm lượng / bộ trống / độ vang tương ứng */
export function setActiveStyle(style: BeatStyle) {
  if (style === activeStyle) return;
  activeStyle = style;
  applyMix(effectivePrefs(prefs, activeStyle));
}

function commit(next: BeatPrefs) {
  prefs = next;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* bỏ qua */ }
  applyMix(effectivePrefs(prefs, activeStyle));
  subs.forEach((f) => f());
}

/** Người dùng chỉnh: khi đang tự động, mục chỉnh tay được ghi nhớ để không bị ghi đè */
export function setBeatPrefs(p: Partial<BeatPrefs>) {
  const touched = (Object.keys(p) as (keyof BeatPrefs)[]).filter((k) => TRACKED_KEYS.includes(k));
  const manual = prefs.auto ? [...new Set([...prefs.manual, ...touched])] : prefs.manual;
  commit({ ...prefs, ...p, manual });
}

/** Bật/tắt tự động; bật lại thì bỏ hết các mục chỉnh tay */
export function setAutoPrefs(on: boolean) {
  // nhạc cụ cố định cũ về mặc định, để lần mở app sau không bị coi là chọn tay
  if (on) commit({ ...prefs, instrument: DEFAULT_BEAT_PREFS.instrument, auto: true, manual: [] });
  // tắt: giữ nguyên những gì đang nghe (của kiểu nhịp hiện tại) làm cài đặt cố định
  else commit({ ...effectivePrefs(prefs, activeStyle), auto: false, manual: [] });
}

export function resetBeatPrefs() {
  commit({ ...DEFAULT_BEAT_PREFS, showChords: prefs.showChords });
}

export function useBeatPrefs(): BeatPrefs {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => prefs,
  );
}
