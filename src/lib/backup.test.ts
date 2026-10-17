import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { blankSong, db, deleteSongs } from './db';
import { backupStatus, REMIND_AFTER_CHANGES, REMIND_AFTER_DAYS } from './backup';
import { clearDraft, loadDraft, saveDraft, scanDraftId } from './drafts';

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const song = (i: number, updatedAt: number, source: 'user' | 'sample' = 'user') =>
  blankSong({ id: `s${i}`, title: `B${i}`, body: '4', source, createdAt: source === 'sample' ? updatedAt : updatedAt - 10, updatedAt });

describe('nhắc sao lưu', () => {
  it('bài mẫu chưa sửa không tính, bài mẫu đã sửa thì tính', () => {
    const sample = song(1, NOW - DAY, 'sample');
    expect(backupStatus([sample], null, null, NOW).changed).toBe(0);
    expect(backupStatus([{ ...sample, updatedAt: NOW - 1000 }], null, null, NOW).changed).toBe(1);
  });

  it(`nhắc khi có ${REMIND_AFTER_CHANGES} bài thay đổi`, () => {
    const few = Array.from({ length: REMIND_AFTER_CHANGES - 1 }, (_, i) => song(i, NOW - DAY));
    expect(backupStatus(few, null, null, NOW).due).toBe(false);
    expect(backupStatus([...few, song(99, NOW - DAY)], null, null, NOW).due).toBe(true);
  });

  it(`nhắc khi có thay đổi chưa sao lưu quá ${REMIND_AFTER_DAYS} ngày`, () => {
    expect(backupStatus([song(1, NOW - (REMIND_AFTER_DAYS - 1) * DAY)], null, null, NOW).due).toBe(false);
    expect(backupStatus([song(1, NOW - (REMIND_AFTER_DAYS + 1) * DAY)], null, null, NOW).due).toBe(true);
  });

  it('chỉ tính bài sửa sau lần sao lưu, và tạm ẩn khi bấm Nhắc sau', () => {
    const old = song(1, NOW - 60 * DAY);
    expect(backupStatus([old], NOW - 40 * DAY, null, NOW)).toMatchObject({ changed: 0, due: false });
    expect(backupStatus([old], null, NOW + DAY, NOW).due).toBe(false);
    expect(backupStatus([old], null, NOW - DAY, NOW).due).toBe(true);
  });
});

describe('bản nháp', () => {
  it('lưu, đọc, xoá theo từng bài; bài mới dùng khoá riêng', async () => {
    const d = { song: blankSong({ id: 'a', title: 'Nháp' }), tagText: '', savedAt: 1 };
    await saveDraft('a', d);
    await saveDraft(undefined, { ...d, tagText: 'mới' });
    expect((await loadDraft('a'))?.song.title).toBe('Nháp');
    expect((await loadDraft())?.tagText).toBe('mới');
    await clearDraft('a');
    expect(await loadDraft('a')).toBeNull();
    expect(await loadDraft()).not.toBeNull();
  });

  it('xoá bài thì xoá luôn nháp sửa bài và ảnh quét dở của bài đó', async () => {
    await db.songs.put(blankSong({ id: 'b', title: 'B', body: '4' }));
    await saveDraft('b', { song: blankSong({ id: 'b' }), tagText: '', savedAt: 1 });
    const scan = { savedAt: 1, keySig: 0, timeSig: '4/4', tempo: 90, target: 'auto' as const, allowTranspose: true, tokens: {}, pages: [] };
    await db.scans.put({ songId: scanDraftId('b'), ...scan });
    await db.scans.put({ songId: scanDraftId(), ...scan });
    await deleteSongs(['b']);
    expect(await loadDraft('b')).toBeNull();
    expect(await db.scans.get(scanDraftId('b'))).toBeUndefined();
    expect(await db.scans.get(scanDraftId())).toBeDefined();
  });
});
