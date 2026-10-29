/** Lưu trữ offline bằng IndexedDB (Dexie). Mọi dữ liệu nằm trên thiết bị. */
import { BRAND } from '../appConfig';
import { exportPractice, importPractice } from './practiceBackup';
import Dexie, { Table } from 'dexie';
import { FIRST_SAMPLE_IDS, SAMPLE_SONGS } from '../data/samples';
import { HARP_TYPES, normalizeKey } from './harp';
import { AiLogEntry, Backing, DEFAULT_SETTINGS, MidiSource, Recording, Settings, Song } from './types';
import type { SongScan } from './scanStore';
import { BeatStyle, PATTERNS } from '../audio/patterns';

interface KV { key: string; value: unknown }

class HarpDB extends Dexie {
  songs!: Table<Song, string>;
  kv!: Table<KV, string>;
  aiLog!: Table<AiLogEntry, number>;
  /** ảnh khuông nhạc đã quét của bài (khoá = id bài) — không đưa vào file sao lưu vì nặng */
  scans!: Table<SongScan, string>;
  /** bản thu karaoke — không đưa vào file sao lưu / link chia sẻ (nặng, riêng tư) */
  recordings!: Table<Recording, number>;
  /** nhạc nền MP3 cho karaoke (khoá = id bài) — không vào sao lưu / link chia sẻ / AI */
  backings!: Table<Backing, string>;
  /** file MIDI gốc của bài nhập từ MIDI (khoá = id bài) — không vào sao lưu / link chia sẻ / AI */
  midiSources!: Table<MidiSource, string>;
  constructor() {
    super('harptabs');
    this.version(1).stores({
      songs: 'id, title, updatedAt, favorite, harpKey, lastPracticedAt',
      kv: 'key',
      aiLog: '++id, at',
    });
    this.version(2).stores({ scans: 'songId' });
    this.version(3).stores({ recordings: '++id, songId, createdAt' });
    this.version(4).stores({ backings: 'songId' });
    this.version(5).stores({ midiSources: 'songId' });
  }
}

export const db = new HarpDB();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Xoá bài (kèm ảnh quét, bản nháp, bản thu karaoke của bài). Bài mẫu đã xoá không tự xuất hiện lại. */
export async function deleteSongs(ids: string[]): Promise<void> {
  await db.transaction('rw', [db.songs, db.scans, db.kv, db.recordings, db.backings, db.midiSources], async () => {
    await db.recordings.where('songId').anyOf(ids).delete();
    await db.backings.bulkDelete(ids);
    await db.midiSources.bulkDelete(ids);
    await db.songs.bulkDelete(ids);
    // khoá nháp: xem lib/drafts.ts
    await db.scans.bulkDelete([...ids, ...ids.map((id) => `draft:scan:${id}`)]);
    await db.kv.bulkDelete(ids.flatMap((id) => [`draft:${id}`, `practice:${id}`, `karaoke:${id}`, `karaokeScore:${id}`]));
  });
}

/**
 * Thêm bài mẫu. Mỗi bản cập nhật chỉ thêm các bài mẫu MỚI; bài mẫu người dùng đã xoá không thêm lại.
 * Danh sách bài mẫu đã từng thêm lưu ở kv 'seededSamples'.
 */
export async function ensureSeeded(): Promise<void> {
  await fillSampleChords();
  const [seeded, list] = await Promise.all([db.kv.get('seeded'), db.kv.get('seededSamples')]);
  // máy cài từ bản cũ: đã có 8 bài mẫu đầu tiên
  const done = new Set<string>((list?.value as string[] | undefined) ?? (seeded ? FIRST_SAMPLE_IDS : []));
  const todo = SAMPLE_SONGS.filter((s) => !done.has(s.sampleId));
  if (!todo.length && list) return;
  const now = Date.now();
  await db.songs.bulkPut(
    todo.map(({ sampleId, ...s }, i) => ({
      ...s,
      id: `sample-${sampleId}`,
      source: 'sample' as const,
      favorite: false,
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    })),
  );
  await db.kv.bulkPut([
    { key: 'seeded', value: 1 },
    { key: 'seededSamples', value: SAMPLE_SONGS.map((s) => s.sampleId) },
  ]);
}

/**
 * Bài mẫu đã có trong máy từ bản cũ: gắn hợp âm chuẩn (một lần). Bài người dùng đã chọn hợp âm tay hoặc đã sửa nhạc thì giữ nguyên.
 */
async function fillSampleChords(): Promise<void> {
  // lần 2: bài mẫu kalimba mới có hợp âm chuẩn từ bản sau
  const done = await db.kv.get('sampleChords');
  if (((done?.value as number | undefined) ?? 0) >= SAMPLE_CHORDS_VERSION) return;
  const withChords = SAMPLE_SONGS.filter((s) => s.chords);
  const rows = await db.songs.bulkGet(withChords.map((s) => `sample-${s.sampleId}`));
  const updates = rows.flatMap((row, i) => (row && !row.chords && row.body === withChords[i].body ? [{ ...row, chords: withChords[i].chords }] : []));
  if (updates.length) await db.songs.bulkPut(updates);
  await db.kv.put({ key: 'sampleChords', value: SAMPLE_CHORDS_VERSION });
}
const SAMPLE_CHORDS_VERSION = 2;

export async function loadSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.kv.put({ key: 'settings', value: s });
}

export function blankSong(partial: Partial<Song> = {}): Song {
  const now = Date.now();
  return {
    id: newId(),
    title: '',
    harpKey: 'C',
    position: 1,
    bpm: 90,
    timeSig: '4/4',
    pickupBeats: 0,
    style: 'ballad',
    difficulty: 1,
    body: '',
    tags: [],
    source: 'user',
    favorite: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

// ---------- Sao lưu / khôi phục ----------

export interface BackupFile {
  app: 'harptabs';
  version: 1;
  exportedAt: string;
  songs: Song[];
  /** nhật ký luyện tập và kết quả các trang tập (localStorage) — chỉ có trong file sao lưu toàn bộ */
  practice?: Record<string, unknown>;
}

export async function exportAll(): Promise<BackupFile> {
  return { app: 'harptabs', version: 1, exportedAt: new Date().toISOString(), songs: await db.songs.toArray(), practice: exportPractice() };
}

export function exportOne(song: Song): BackupFile {
  return { app: 'harptabs', version: 1, exportedAt: new Date().toISOString(), songs: [song] };
}

const SOURCES: Song['source'][] = ['sample', 'user', 'ai-image', 'ai-name', 'scan', 'import'];
const MAX_BODY_CHARS = 200_000;

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v ? v.slice(0, max) : undefined);
const time = (v: unknown, fallback?: number): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 8.64e15 ? n : fallback;
};

/** Chỉ nhận các trường đã biết, kiểm tra kiểu và giới hạn — file sao lưu có thể do người khác gửi */
export function sanitizeSong(raw: Record<string, unknown>): Song | null {
  if (!raw || typeof raw !== 'object' || typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
  if (raw.body.length > MAX_BODY_CHARS) return null;
  const base = blankSong();
  const style = raw.style as BeatStyle;
  const createdAt = time(raw.createdAt, base.createdAt)!;
  return {
    id: typeof raw.id === 'string' && /^[\w-]{1,80}$/.test(raw.id) ? raw.id : base.id,
    title: raw.title.slice(0, 200),
    artist: str(raw.artist, 200),
    harpKey: normalizeKey(String(raw.harpKey ?? 'C')) ?? 'C',
    harpType: HARP_TYPES.includes(raw.harpType as never) ? (raw.harpType as Song['harpType']) : undefined,
    position: raw.position === 2 || raw.position === 3 ? raw.position : 1,
    songKey: str(raw.songKey, 12),
    chords: sanitizeChords(raw.chords),
    bpm: Math.min(300, Math.max(20, Number(raw.bpm) || 90)),
    timeSig: typeof raw.timeSig === 'string' && /^\d{1,2}\/\d{1,2}$/.test(raw.timeSig) ? raw.timeSig : base.timeSig,
    pickupBeats: Math.min(16, Math.max(0, Number(raw.pickupBeats) || 0)),
    style: style === 'none' || style === 'metronome' || style in PATTERNS ? style : base.style,
    difficulty: raw.difficulty === 2 || raw.difficulty === 3 ? raw.difficulty : 1,
    body: raw.body,
    notes: str(raw.notes, 20_000),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string').slice(0, 50).map((t) => t.slice(0, 50)) : [],
    source: SOURCES.includes(raw.source as never) ? (raw.source as Song['source']) : 'import',
    favorite: !!raw.favorite,
    createdAt,
    updatedAt: time(raw.updatedAt, createdAt)!,
    lastPracticedAt: time(raw.lastPracticedAt),
    fingers: sanitizeFingers(raw.fingers),
  };
}

function sanitizeFingers(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out = Object.fromEntries(Object.entries(v).slice(0, 5000).filter(([k, f]) => /^\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(k) && Number.isInteger(f) && f >= 1 && f <= 5));
  return Object.keys(out).length ? out : undefined;
}

function sanitizeChords(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const out = Object.fromEntries(Object.entries(v).slice(0, 2000).filter(([k, c]) => Number.isFinite(Number(k)) && typeof c === 'string' && c.length <= 8));
  return Object.keys(out).length ? out : undefined;
}

/** Nhập file sao lưu. Bài trùng id: giữ bản mới hơn; nhật ký luyện tập trộn với dữ liệu đang có. Trả về số bài đã thêm/cập nhật. */
export async function importBackup(json: unknown): Promise<{ added: number; updated: number; skipped: number; practice: boolean }> {
  const obj = json as Partial<BackupFile>;
  if (!obj || obj.app !== 'harptabs' || !Array.isArray(obj.songs)) {
    throw new Error(`File không đúng định dạng sao lưu của ${BRAND.name}`);
  }
  let added = 0, updated = 0, skipped = 0;
  await db.transaction('rw', db.songs, async () => {
    for (const raw of obj.songs!) {
      const s = sanitizeSong(raw as unknown as Record<string, unknown>);
      if (!s) { skipped++; continue; }
      const existing = await db.songs.get(s.id);
      if (!existing) { await db.songs.put(s); added++; }
      else if ((s.updatedAt ?? 0) > existing.updatedAt) { await db.songs.put(s); updated++; }
      else skipped++;
    }
  });
  const practice = importPractice(obj.practice) > 0;
  return { added, updated, skipped, practice };
}

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function slugify(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'bai-hat';
}

/** So khớp tìm kiếm không phân biệt dấu tiếng Việt */
export function fold(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}
