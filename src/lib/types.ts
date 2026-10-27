import type { PaletteId } from './themes';
import { IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP } from '../appConfig';
import type { HarpKey, HarpType, NoteNameStyle } from './harp';
import type { BeatStyle } from '../audio/patterns';

export type SongSource = 'sample' | 'user' | 'ai-image' | 'ai-name' | 'scan' | 'import';

export interface Song {
  id: string;
  title: string;
  artist?: string;
  harpKey: HarpKey;
  /** loại kèn; không ghi = diatonic (bài cũ) */
  harpType?: HarpType;
  /** vị trí chơi (1 = thẳng, 2 = cross harp, 3 = slant) */
  position?: 1 | 2 | 3;
  songKey?: string;
  /** hợp âm chọn tay: phách bắt đầu khúc → tên hợp âm (xem audio/harmony.ts) */
  chords?: Record<string, string>;
  bpm: number;
  /** ví dụ "4/4", "3/4" */
  timeSig: string;
  /** số phách của ô nhịp lấy đà (anacrusis) */
  pickupBeats: number;
  style: BeatStyle;
  difficulty: 1 | 2 | 3;
  /** nội dung tab theo định dạng văn bản (xem lib/tabText.ts) */
  body: string;
  notes?: string;
  tags: string[];
  source: SongSource;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastPracticedAt?: number;
}

export interface Settings {
  aiMode: 'proxy' | 'direct';
  proxyUrl: string;
  appToken: string;
  geminiKey: string;
  model: string;
  noteNames: NoteNameStyle;
  showNoteNames: boolean;
  tabSize: 's' | 'm' | 'l';
  /** sáng / tối / theo máy */
  theme: 'system' | 'light' | 'dark';
  /** bảng màu (xem lib/themes.ts) */
  palette: PaletteId;
  defaultHarpKey: HarpKey;
  defaultHarpType: HarpType;
  /** giữ màn hình sáng khi đang phát bài / chờ nốt / dò nốt */
  keepAwake: boolean;
  /** giữ màn hình sáng suốt lúc app đang mở (không chỉ khi phát bài) */
  keepAwakeAlways: boolean;
  /** bù trễ đèn nốt (ms): dương = đèn sáng muộn hơn; dùng khi loa / tai nghe Bluetooth trễ hơn máy báo */
  syncOffsetMs: number;
  /** độ trễ micro (ms) khi chấm điểm karaoke: giọng hát tới bộ dò trễ chừng này */
  micLatencyMs: number;
  /** gửi thống kê ẩn danh lượt cài / lượt dùng (lib/usageStats.ts) */
  shareStats: boolean;
  /** sáo dọc: kiểu bấm Baroque (mặc định) hay German */
  recorderFingering: 'baroque' | 'german';
  /** sáo trúc: bịt hết lỗ ra bậc mấy của tông sáo (1 = Đô … 7 = Si; mặc định 5 = Sol như sáo Đô bịt hết ra Sol) */
  saoTrucClosed: number;
}

export const DEFAULT_SETTINGS: Settings = {
  aiMode: 'proxy',
  proxyUrl: 'https://harptabs-ai.tranthanhphuc81.workers.dev',
  appToken: '',
  geminiKey: '',
  model: 'gemini-3.5-flash-lite',
  noteNames: 'letter',
  showNoteNames: false,
  tabSize: 'm',
  theme: 'system',
  palette: 'steel',
  defaultHarpKey: IS_RECORDER_APP ? 'F' : 'C',
  defaultHarpType: IS_RECORDER_APP ? 'recorderAlto' : IS_KALIMBA_APP ? 'kalimba17' : IS_GUITAR_APP ? 'guitar6' : 'diatonic',
  shareStats: true,
  recorderFingering: 'baroque',
  saoTrucClosed: 5,
  keepAwake: true,
  keepAwakeAlways: true,
  syncOffsetMs: 0,
  micLatencyMs: 60,
};

export interface AiLogEntry {
  id?: number;
  at: number;
  kind: 'image' | 'name';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  songId?: string;
}

export function beatsPerBar(timeSig: string): number {
  const n = Number(timeSig.split('/')[0]);
  return n >= 1 && n <= 12 ? n : 4;
}

/** Bản thu karaoke (bảng recordings): một file stereo — kênh trái nhạc đệm, kênh phải giọng hát. Chỉ lưu trên máy. */
export interface Recording {
  id?: number;
  songId: string;
  title: string;
  createdAt: number;
  durationSec: number;
  mime: string;
  blob: Blob;
  /** giọng thu trễ hơn nhạc đệm bao nhiêu (ms): độ trễ loa + micro + bù tay; nghe lại / xuất thì đẩy giọng sớm lại */
  voiceLagMs: number;
  /** nửa cung đã đổi tông lúc thu */
  transpose: number;
  /** điểm chấm (nếu bật chấm điểm khi thu) */
  score?: number;
  size: number;
}

/** Nhạc nền MP3 cho karaoke (bảng backings, khoá = id bài). File người dùng tự có; chỉ lưu trên máy. */
/** File MIDI gốc của bài nhập từ MIDI (karaoke phát bản phối gốc) — chỉ nằm trên máy */
export interface MidiSource {
  songId: string;
  name: string;
  /** nội dung file (vài chục KB — lưu thẳng, không cần Blob) */
  data: ArrayBuffer;
  size: number;
  /** bè hát (id bè lúc nhập) — không phát lại vì người hát thay */
  melodyPart: string;
  /** phách trong file MIDI của nốt đầu tab */
  startBeat: number;
  /** tab lệch file bao nhiêu nửa cung (dịch giọng cho vừa kèn) */
  shift: number;
  /** dấu vân tay tab lúc nối — tab sửa sau đó thì nhạc có thể lệch */
  tabSig: string;
  createdAt: number;
  /** người dùng đổi nhạc cụ / tắt từng bè (khoá = id bè; giá trị: nhạc cụ, 'bass', 'drum' hoặc 'off') */
  voices?: Record<string, string>;
  /** lọc bớt tiếng cao cho dịu (mặc định bật) */
  soft?: boolean;
}

export interface Backing {
  songId: string;
  name: string;
  mime: string;
  blob: Blob;
  size: number;
  durationSec: number;
  /** bản đồ nhịp: phách trong tab ↔ giây trong file (tăng dần) */
  points: { beat: number; sec: number }[];
  /** giây mỗi phách (trung vị) — ngoại suy ngoài các mốc */
  spb: number;
  /** chỉnh tay cả bài (ms): dương = lời chạy muộn hơn nhạc */
  offsetMs: number;
  /** giọng bài gốc lệch so với tab (nửa cung) — lời / chấm điểm theo đó */
  keyOffset: number;
  source: 'auto' | 'tap' | 'bpm';
  /** tự đồng bộ: tỉ lệ nốt khớp được (0..1) */
  confidence: number;
  /** dấu vân tay tab lúc đồng bộ — tab sửa sau đó thì cần đồng bộ lại */
  tabSig: string;
  createdAt: number;
}
