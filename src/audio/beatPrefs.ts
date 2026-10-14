/**
 * Tuỳ chỉnh âm thanh beat (dùng chung cho mọi trang phát, lưu trên máy).
 */
import { useSyncExternalStore } from 'react';
import { applyMix, DrumKit, Instrument } from './engine';

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
  reverb: number;
  /** hiện hợp âm đệm trên tab */
  showChords: boolean;
}

export const DEFAULT_BEAT_PREFS: BeatPrefs = {
  instrument: 'harmonica', kit: 'acoustic', swing: 0, humanize: true, fills: false, bass: true, comp: true, bo: false,
  beatVol: 0.6, melodyVol: 0.55, bassVol: 0.7, boVol: 0.8, bellVol: 0.8, compVol: 0.7, reverb: 0.25, showChords: false,
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

const KEY = 'harptabs.beatPrefs';
let prefs: BeatPrefs = load();
applyMix(prefs);
const subs = new Set<() => void>();

function load(): BeatPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_BEAT_PREFS, ...JSON.parse(raw) };
  } catch { /* bỏ qua */ }
  return { ...DEFAULT_BEAT_PREFS };
}

export function getBeatPrefs(): BeatPrefs {
  return prefs;
}

export function setBeatPrefs(p: Partial<BeatPrefs>) {
  prefs = { ...prefs, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* bỏ qua */ }
  applyMix(prefs);
  subs.forEach((f) => f());
}

export function resetBeatPrefs() {
  setBeatPrefs({ ...DEFAULT_BEAT_PREFS, showChords: prefs.showChords });
}

export function useBeatPrefs(): BeatPrefs {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => prefs,
  );
}
