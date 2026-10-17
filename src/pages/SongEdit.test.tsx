// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blankSong, db } from '../lib/db';
import { loadDraft } from '../lib/drafts';
import SongEdit from './SongEdit';

const open = () => render(
  <MemoryRouter initialEntries={['/song/x/edit']}>
    <Routes><Route path="/song/:id/edit" element={<SongEdit />} /><Route path="*" element={<p>đã rời</p>} /></Routes>
  </MemoryRouter>,
);

beforeEach(async () => {
  await db.kv.clear();
  await db.songs.clear();
  await db.songs.put(blankSong({ id: 'x', title: 'Bài gốc', body: '4 5', updatedAt: 100, createdAt: 50 }));
});
afterEach(cleanup);

describe('Sửa bài — tự lưu nháp', () => {
  it('sửa dở rồi thoát, mở lại thì hỏi khôi phục và lấy lại đúng nội dung', async () => {
    const r = open();
    const name = await screen.findByDisplayValue('Bài gốc');
    fireEvent.change(name, { target: { value: 'Bài đang sửa' } });
    await waitFor(async () => expect((await loadDraft('x'))?.song.title).toBe('Bài đang sửa'));
    r.unmount();

    // bài gốc trong thư viện chưa đổi
    expect((await db.songs.get('x'))!.title).toBe('Bài gốc');

    open();
    expect(await screen.findByText(/Có bản sửa dở chưa lưu/)).toBeTruthy();
    expect(screen.getByDisplayValue('Bài gốc')).toBeTruthy();
    act(() => screen.getByText('Mở lại').click());
    expect(screen.getByDisplayValue('Bài đang sửa')).toBeTruthy();
  });

  it('lưu bài thì xoá nháp; bấm Bỏ cũng xoá nháp', async () => {
    const r = open();
    fireEvent.change(await screen.findByDisplayValue('Bài gốc'), { target: { value: 'Bản mới' } });
    await waitFor(async () => expect(await loadDraft('x')).not.toBeNull());
    act(() => screen.getByText('Lưu bài').click());
    await screen.findByText('đã rời');
    expect((await db.songs.get('x'))!.title).toBe('Bản mới');
    expect(await loadDraft('x')).toBeNull();
    r.unmount();

    await db.kv.put({ key: 'draft:x', value: { song: blankSong({ id: 'x', title: 'Nháp cũ' }), tagText: '', savedAt: 1, baseUpdatedAt: 1 } });
    open();
    expect(await screen.findByText(/Bài đã được lưu lại sau đó/)).toBeTruthy();
    act(() => screen.getByText('Bỏ').click());
    await waitFor(async () => expect(await loadDraft('x')).toBeNull());
  });
});
