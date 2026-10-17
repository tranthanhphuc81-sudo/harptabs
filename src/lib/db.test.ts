import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, importBackup } from './db';

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
