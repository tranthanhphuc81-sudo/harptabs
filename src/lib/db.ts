/** Lưu trữ offline bằng IndexedDB (Dexie). Mọi dữ liệu nằm trên thiết bị. */
import Dexie, { Table } from 'dexie';
import { SAMPLE_SONGS } from '../data/samples';
import { normalizeKey } from './harp';
import { AiLogEntry, DEFAULT_SETTINGS, Settings, Song } from './types';

interface KV { key: string; value: unknown }

class HarpDB extends Dexie {
  songs!: Table<Song, string>;
  kv!: Table<KV, string>;
  aiLog!: Table<AiLogEntry, number>;
  constructor() {
    super('harptabs');
    this.version(1).stores({
      songs: 'id, title, updatedAt, favorite, harpKey, lastPracticedAt',
      kv: 'key',
      aiLog: '++id, at',
    });
  }
}

export const db = new HarpDB();

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureSeeded(): Promise<void> {
  const seeded = await db.kv.get('seeded');
  if (seeded) return;
  const now = Date.now();
  await db.songs.bulkPut(
    SAMPLE_SONGS.map(({ sampleId, ...s }, i) => ({
      ...s,
      id: `sample-${sampleId}`,
      source: 'sample' as const,
      favorite: false,
      createdAt: now - i * 1000,
      updatedAt: now - i * 1000,
    })),
  );
  await db.kv.put({ key: 'seeded', value: 1 });
}

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
}

export async function exportAll(): Promise<BackupFile> {
  return { app: 'harptabs', version: 1, exportedAt: new Date().toISOString(), songs: await db.songs.toArray() };
}

export function exportOne(song: Song): BackupFile {
  return { app: 'harptabs', version: 1, exportedAt: new Date().toISOString(), songs: [song] };
}

function sanitize(raw: Record<string, unknown>): Song | null {
  if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null;
  const base = blankSong();
  const key = normalizeKey(String(raw.harpKey ?? 'C')) ?? 'C';
  return {
    ...base,
    ...(raw as Partial<Song>),
    id: typeof raw.id === 'string' && raw.id ? raw.id : base.id,
    harpKey: key,
    bpm: Math.min(300, Math.max(20, Number(raw.bpm) || 90)),
    tags: Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === 'string') : [],
    favorite: !!raw.favorite,
  };
}

/** Nhập file sao lưu. Bài trùng id: giữ bản mới hơn. Trả về số bài đã thêm/cập nhật. */
export async function importBackup(json: unknown): Promise<{ added: number; updated: number; skipped: number }> {
  const obj = json as Partial<BackupFile>;
  if (!obj || obj.app !== 'harptabs' || !Array.isArray(obj.songs)) {
    throw new Error('File không đúng định dạng sao lưu của Sổ Tab Harmonica');
  }
  let added = 0, updated = 0, skipped = 0;
  await db.transaction('rw', db.songs, async () => {
    for (const raw of obj.songs!) {
      const s = sanitize(raw as unknown as Record<string, unknown>);
      if (!s) { skipped++; continue; }
      const existing = await db.songs.get(s.id);
      if (!existing) { await db.songs.put(s); added++; }
      else if ((s.updatedAt ?? 0) > existing.updatedAt) { await db.songs.put(s); updated++; }
      else skipped++;
    }
  });
  return { added, updated, skipped };
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
