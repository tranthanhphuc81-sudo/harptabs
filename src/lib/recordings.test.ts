import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { blankSong, db, deleteSongs, exportAll } from './db';
import { addRecording, deleteAllRecordings, deleteRecording, listRecordings, recordingsTotal } from './recordings';

const rec = (songId: string, createdAt: number, n = 100) => ({
  songId, title: 'x', createdAt, durationSec: 10, mime: 'audio/webm', blob: new Blob([new Uint8Array(n)]), voiceLagMs: 120, transpose: 0,
});

beforeEach(async () => { await db.recordings.clear(); await db.songs.clear(); });

describe('bản thu karaoke', () => {
  it('thêm, liệt kê theo bài (mới nhất trước), tính dung lượng, xoá', async () => {
    await addRecording(rec('a', 1, 100));
    const id2 = await addRecording(rec('a', 2, 50));
    await addRecording(rec('b', 3, 10));
    expect((await listRecordings('a')).map((r) => r.createdAt)).toEqual([2, 1]);
    expect(await recordingsTotal()).toEqual({ count: 3, bytes: 160 });
    await deleteRecording(id2);
    expect(await listRecordings('a')).toHaveLength(1);
    await deleteAllRecordings();
    expect((await recordingsTotal()).count).toBe(0);
  });

  it('xoá bài thì xoá luôn bản thu của bài đó; bản thu không vào file sao lưu', async () => {
    await db.songs.bulkPut([blankSong({ id: 'a', title: 'A', body: '4' }), blankSong({ id: 'b', title: 'B', body: '4' })]);
    await addRecording(rec('a', 1));
    await addRecording(rec('b', 2));
    await deleteSongs(['a']);
    expect(await listRecordings('a')).toHaveLength(0);
    expect(await listRecordings('b')).toHaveLength(1);
    expect(Object.keys(await exportAll())).not.toContain('recordings');
  });
});
