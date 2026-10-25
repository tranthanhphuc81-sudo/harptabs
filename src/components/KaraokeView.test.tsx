// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankSong, db } from '../lib/db';
import { flatten, parseTab } from '../lib/tabText';
import KaraokeView from './KaraokeView';
import type { PlayerState } from './usePlayer';

const BODY = `4 4 -4 4
Hap-py birth day
6 -6 7 7
to you dear friend`;

afterEach(cleanup);

function setup(beatRef: { v: number | null }) {
  const song = blankSong({ id: 'kv', title: 'Happy', body: BODY, harpKey: 'C' });
  const flat = flatten(parseTab(BODY, 'C'));
  const setOpts = vi.fn();
  const p = {
    playing: true, active: null, countIn: null, chord: null, accompNote: null,
    opts: { sing: false } as PlayerState['opts'],
    setOpts, play: vi.fn(), stop: vi.fn(), toggle: vi.fn(), beatAt: () => beatRef.v,
  } as unknown as PlayerState;
  const onClose = vi.fn();
  const r = render(<KaraokeView song={song} original={song} flat={flat} p={p} chordSegs={null} onClose={onClose} />);
  return { r, setOpts, p, onClose };
}

const fills = (container: HTMLElement) =>
  [...container.querySelectorAll<HTMLElement>('.kara-line.current [data-s]')].map((el) => Number(el.style.getPropertyValue('--p')));

describe('màn hình karaoke', () => {
  it('mở thì bật Đệm hát; chữ chạy theo phách; hát hết dòng thì chuyển dòng kế', async () => {
    const beat = { v: 2.5 as number | null };
    const { r, setOpts } = setup(beat);
    expect(setOpts).toHaveBeenCalledWith({ sing: true });
    // phách 2.5: "Hap" "py" đã hát, "birth" được nửa, "day" chưa
    await waitFor(() => expect(fills(r.container)).toEqual([1, 1, 0.5, 0]));
    expect(screen.getByText('Hap', { selector: '.kara-line.current .ks-base' })).toBeTruthy();
    // sang dòng 2
    act(() => { beat.v = 5.25; });
    await waitFor(() => expect(r.container.querySelector('.kara-line.current .ks-base')?.textContent).toBe('to'));
    await waitFor(() => expect(fills(r.container)[1]).toBeCloseTo(0.25));
  });

  it('đổi tông: báo cho bộ phát, gợi ý thổi cùng số lỗ bằng kèn tông tương ứng', async () => {
    const { r, setOpts } = setup({ v: 0 });
    fireEvent.click(screen.getByLabelText('Nâng tông'));
    fireEvent.click(screen.getByLabelText('Nâng tông'));
    await waitFor(() => expect(setOpts).toHaveBeenCalledWith({ transpose: 2 }));
    expect(r.container.querySelector('.kara-note')?.textContent).toContain('Kèn D');
    // số lỗ vẫn hiện trên chữ
    expect(r.container.querySelector('.ks-holes')?.textContent).toBe('4');
  });

  it('thoát: dừng phát, trả lại tông và chế độ cũ', () => {
    const { r, setOpts, p } = setup({ v: 0 });
    r.unmount();
    expect(p.stop).toHaveBeenCalled();
    expect(setOpts).toHaveBeenLastCalledWith({ sing: false, transpose: 0, arrangement: null });
  });

  it('chỉnh cỡ lời / cỡ số lỗ: áp ngay, nhớ cho lần mở sau (mọi bài)', async () => {
    const { r } = setup({ v: null });
    const root = r.container.querySelector<HTMLElement>('.karaoke')!;
    expect(root.style.getPropertyValue('--kara-lyric')).toBe('1');
    fireEvent.click(screen.getByTitle('Cỡ chữ'));
    fireEvent.change(screen.getByLabelText('Cỡ lời'), { target: { value: '1.4' } });
    fireEvent.change(screen.getByLabelText('Cỡ số lỗ'), { target: { value: '2' } });
    expect(root.style.getPropertyValue('--kara-lyric')).toBe('1.4');
    expect(root.style.getPropertyValue('--kara-holes')).toBe('2');
    expect(screen.getByText('140%')).toBeTruthy();
    r.unmount();
    const again = setup({ v: null });
    const root2 = again.r.container.querySelector<HTMLElement>('.karaoke')!;
    await waitFor(() => expect(root2.style.getPropertyValue('--kara-holes')).toBe('2'));
    expect(root2.style.getPropertyValue('--kara-lyric')).toBe('1.4');
    // về mặc định
    fireEvent.click(screen.getByTitle('Cỡ chữ'));
    fireEvent.click(screen.getByText('Mặc định'));
    expect(root2.style.getPropertyValue('--kara-lyric')).toBe('1');
  });

  it('lời lưu từ trước bị vỡ dấu (Windows-1258 đọc nhầm): sửa ngay trong karaoke, lưu vào bài', async () => {
    // "hời thương em đừng" theo Windows-1258 nhưng từng byte bị đọc thành Latin-1
    const body = ['-4 5 -5 6', 'hõÌi thýõng em ðýÌng'].join('\n');
    const song = blankSong({ id: 'garb', title: 'X', body, harpKey: 'C' });
    await db.songs.put(song);
    const flat = flatten(parseTab(body, 'C'));
    const p = {
      playing: false, active: null, countIn: null, chord: null, accompNote: null,
      opts: { sing: false } as PlayerState['opts'],
      setOpts: vi.fn(), play: vi.fn(), stop: vi.fn(), toggle: vi.fn(), beatAt: () => null,
    } as unknown as PlayerState;
    render(<KaraokeView song={song} original={song} flat={flat} p={p} chordSegs={null} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sửa lỗi font' }));
    await waitFor(async () => expect((await db.songs.get('garb'))?.body.split('\n')[1]).toBe('hời thương em đừng'));
  });
});

