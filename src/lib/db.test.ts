import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, ensureSeeded, importBackup } from './db';
import { SAMPLE_SONGS } from '../data/samples';

beforeEach(async () => {
  await db.songs.clear();
});

describe('nhập file sao lưu', () => {
  it('chỉ giữ trường đã biết, sửa giá trị sai', async () => {
    const r = await importBackup({
      app: 'harptabs',
      version: 1,
      songs: [{
        id: 'abc-1', title: 'Bài A', body: '4 -4 5', harpKey: 'Zz', bpm: 9999, timeSig: '<b>', style: 'xyz',
        difficulty: 7, position: 9, source: 'hack', tags: ['a', 5], updatedAt: 'x', evil: '<script>', favorite: 1,
      }],
    });
    expect(r).toEqual({ added: 1, updated: 0, skipped: 0 });
    const s = (await db.songs.get('abc-1'))!;
    expect(s).not.toHaveProperty('evil');
    expect(s.harpKey).toBe('C');
    expect(s.bpm).toBe(300);
    expect(s.timeSig).toBe('4/4');
    expect(s.style).toBe('ballad');
    expect(s.difficulty).toBe(1);
    expect(s.position).toBe(1);
    expect(s.source).toBe('import');
    expect(s.tags).toEqual(['a']);
    expect(s.favorite).toBe(true);
    expect(Number.isFinite(s.updatedAt)).toBe(true);
  });

  it('bỏ qua bài thiếu tên / tab hoặc tab quá dài, giữ bản mới hơn khi trùng id', async () => {
    await importBackup({ app: 'harptabs', version: 1, songs: [{ id: 'x', title: 'Cũ', body: '4', updatedAt: 100 }] });
    const r = await importBackup({
      app: 'harptabs',
      version: 1,
      songs: [
        { id: 'x', title: 'Mới', body: '5', updatedAt: 200 },
        { id: 'y', title: 'Không tab' },
        { id: 'z', title: 'Quá dài', body: '4 '.repeat(200_000) },
        null,
      ],
    });
    expect(r).toEqual({ added: 0, updated: 1, skipped: 3 });
    expect((await db.songs.get('x'))!.title).toBe('Mới');
  });

  it('từ chối file không phải sao lưu của app', async () => {
    await expect(importBackup({ songs: [] })).rejects.toThrow();
  });
});

describe('gắn hợp âm chuẩn cho bài mẫu đã có trong máy', () => {
  it('máy đã chạy bước cũ (lần 1) vẫn được gắn lần nữa; bài đã chọn hợp âm tay hoặc đã sửa nhạc thì giữ nguyên', async () => {
    const twinkle = SAMPLE_SONGS.find((s) => s.sampleId === 'twinkle')!;
    const mary = SAMPLE_SONGS.find((s) => s.sampleId === 'mary-lamb')!;
    const ode = SAMPLE_SONGS.find((s) => s.sampleId === 'ode-to-joy')!;
    const row = (s: typeof twinkle, extra: object) => {
      const { sampleId, ...rest } = s;
      return { ...rest, id: `sample-${sampleId}`, source: 'sample' as const, favorite: false, createdAt: 1, updatedAt: 1, chords: undefined, ...extra };
    };
    await db.songs.bulkPut([row(twinkle, {}), row(mary, { chords: { 0: 'Am' } }), row(ode, { body: '4 4 5' })]);
    await db.kv.bulkPut([{ key: 'sampleChords', value: 1 }, { key: 'seeded', value: 1 }, { key: 'seededSamples', value: SAMPLE_SONGS.map((s) => s.sampleId) }]);
    await ensureSeeded();
    expect((await db.songs.get('sample-twinkle'))!.chords).toEqual(twinkle.chords);
    expect((await db.songs.get('sample-mary-lamb'))!.chords).toEqual({ 0: 'Am' });
    expect((await db.songs.get('sample-ode-to-joy'))!.chords).toBeUndefined();
    expect((await db.kv.get('sampleChords'))!.value).toBe(2);
  });
});
