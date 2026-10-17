// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { blankSong, db } from '../lib/db';
import { ErrorBoundary } from '../components/ErrorBoundary';
import Library from './Library';

beforeEach(async () => {
  await db.songs.clear();
  await db.songs.bulkPut([
    blankSong({ id: 'd', title: 'Bài diatonic', body: '4 -4' }),
    blankSong({ id: 'c', title: 'Bài chromatic', body: '4 -4', harpType: 'chromatic' }),
  ]);
});
afterEach(cleanup);

describe('Thư viện', () => {
  it('lọc theo loại kèn cập nhật danh sách ngay', async () => {
    render(<MemoryRouter><Library /></MemoryRouter>);
    expect(await screen.findByText('Bài diatonic')).toBeTruthy();
    expect(screen.getByText('Bài chromatic')).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Lọc theo loại kèn'), { target: { value: 'chromatic' } });
    expect(screen.queryByText('Bài diatonic')).toBeNull();
    expect(screen.getByText('Bài chromatic')).toBeTruthy();
  });

  it('tìm kiếm không dấu', async () => {
    render(<MemoryRouter><Library /></MemoryRouter>);
    await screen.findByText('Bài diatonic');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'bai chrom' } });
    expect(screen.queryByText('Bài diatonic')).toBeNull();
    expect(screen.getByText('Bài chromatic')).toBeTruthy();
  });
});

describe('ErrorBoundary', () => {
  it('trang lỗi chỉ hiện thông báo, không làm trắng app', () => {
    const Boom = () => { throw new Error('hỏng'); };
    const err = console.error;
    console.error = () => {};
    try {
      render(<ErrorBoundary><Boom /></ErrorBoundary>);
    } finally {
      console.error = err;
    }
    expect(screen.getByRole('alert').textContent).toContain('Trang này gặp lỗi');
    expect(screen.getByText('Về thư viện')).toBeTruthy();
  });
});
