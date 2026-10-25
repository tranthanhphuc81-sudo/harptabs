import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { blankSong, db, deleteSongs, exportAll } from './db';
import { checkBackingFile, deleteBacking, loadBacking, saveBacking, tabSig, updateBackingSync } from './backings';
import { flatten, parseTab } from './tabText';

const base = (songId: string) => ({
  songId, name: 'beat.mp3', mime: 'audio/mpeg', blob: new Blob([new Uint8Array(300)]), durationSec: 200,
  points: [{ beat: 0, sec: 4 }, { beat: 16, sec: 13 }], spb: 0.56, offsetMs: 0, keyOffset: 0, source: 'auto' as const, confidence: 0.7, tabSig: 'x',
});

beforeEach(async () => { await db.backings.clear(); await db.songs.clear(); });

describe('nhạc nền MP3', () => {
  it('lưu / đọc / chỉnh bản đồ nhịp / xoá theo bài', async () => {
    await saveBacking(base('a'));
    expect((await loadBacking('a'))?.size).toBe(300);
    await updateBackingSync('a', { offsetMs: 120, source: 'tap' });
    expect(await loadBacking('a')).toMatchObject({ offsetMs: 120, source: 'tap', name: 'beat.mp3' });
    await deleteBacking('a');
    expect(await loadBacking('a')).toBeNull();
  });

  it('xoá bài xoá luôn nhạc nền; nhạc nền không vào file sao lưu', async () => {
    await db.songs.put(blankSong({ id: 'a', title: 'A', body: '4' }));
    await saveBacking(base('a'));
    await deleteSongs(['a']);
    expect(await loadBacking('a')).toBeNull();
    expect(JSON.stringify(await exportAll())).not.toContain('beat.mp3');
  });

  it('dấu vân tay tab đổi khi sửa nốt / trường độ; kiểm tra file', () => {
    const sig = (b: string) => tabSig(flatten(parseTab(b, 'C')));
    expect(sig('4 5 6:2')).toBe(sig('4 5 6:2'));
    expect(sig('4 5 6:2')).not.toBe(sig('4 5 6'));
    expect(sig('4 5 6:2')).not.toBe(sig('4 -5 6:2'));
    expect(checkBackingFile({ size: 3e6, type: 'audio/mpeg', name: 'a.mp3' })).toBeNull();
    expect(checkBackingFile({ size: 30e6, type: 'audio/mpeg', name: 'a.mp3' })).toMatch(/quá lớn/);
    expect(checkBackingFile({ size: 1e3, type: 'image/png', name: 'a.png' })).toMatch(/âm thanh/);
  });
});
