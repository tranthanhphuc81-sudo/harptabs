// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankSong } from '../lib/db';
import { saveBacking, tabSig } from '../lib/backings';
import { flatten, parseTab } from '../lib/tabText';
import type { PlayerState } from './usePlayer';
import { loadMidiSource, saveMidiSource } from '../lib/midiSources';

const started: number[] = [];
vi.mock('../audio/backingPlayer', () => ({
  decodeBacking: async () => ({ duration: 60 }),
  BackingPlayer: class {
    playing = false;
    onEnd?: () => void;
    setSync() {}
    start(beat: number) { started.push(beat); this.playing = true; }
    stop() { this.playing = false; }
    currentSec() { return null; }
    currentBeat() { return null; }
  },
}));
const { default: KaraokeView } = await import('./KaraokeView');

afterEach(cleanup);
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

describe('karaoke với nhạc nền MP3', () => {
  it('bài có nhạc nền: mặc định dùng MP3, khoá đổi tông, bấm Hát phát MP3 (không phát tiếng tổng hợp)', async () => {
    const BODY = '4 5 6 7\nHát cho vui nhé\n6 5 4 4\nmột hai ba bốn';
    const song = blankSong({ id: 'mp3', title: 'MP3', body: BODY, harpKey: 'C' });
    const flat = flatten(parseTab(BODY, 'C'));
    await saveBacking({
      songId: 'mp3', name: 'beat.mp3', mime: 'audio/mpeg', blob: new Blob([new Uint8Array(10)]), durationSec: 60,
      points: [{ beat: 0, sec: 5 }, { beat: 8, sec: 9 }], spb: 0.5, offsetMs: 0, keyOffset: 2, source: 'auto', confidence: 0.7, tabSig: tabSig(flat),
    });
    const synthPlay = vi.fn();
    const p = {
      playing: false, active: null, countIn: null, chord: null, accompNote: null,
      opts: { sing: false, bpm: 90, tempoScale: 1 } as PlayerState['opts'],
      setOpts: () => {}, play: synthPlay, stop: () => {}, toggle: () => {}, beatAt: () => null,
    } as unknown as PlayerState;
    render(<KaraokeView song={song} original={song} flat={flat} p={p} chordSegs={null} onClose={() => {}} />);

    await waitFor(() => expect(screen.getByRole('radio', { name: 'MP3' }).getAttribute('aria-checked')).toBe('true'));
    await waitFor(() => expect(screen.getByText('Tông theo nhạc')).toBeTruthy());
    expect((screen.getByLabelText('Nâng tông') as HTMLButtonElement).disabled).toBe(true);

    // bắt đầu từ câu đầu (phách 0)
    fireEvent.click(screen.getByLabelText('Hát'));
    expect(started).toEqual([0]);
    expect(synthPlay).not.toHaveBeenCalled();

    // đổi sang tiếng tổng hợp: bấm Hát dùng bộ phát tổng hợp
    fireEvent.click(screen.getByRole('radio', { name: 'Tự đệm' }));
    fireEvent.click(screen.getByLabelText('Hát'));
    expect(synthPlay).toHaveBeenCalled();
  });
});

describe('karaoke với bản phối MIDI gốc', () => {
  it('bài nhập từ MIDI: mặc định "MIDI gốc", đưa bản phối cho bộ phát, đổi tông vẫn được; đóng thì gỡ ra', async () => {
    const BODY = '4 5 6 7\nHát cho vui nhé';
    const song = blankSong({ id: 'mid', title: 'MIDI', body: BODY, harpKey: 'C', tags: ['MIDI'] });
    const flat = flatten(parseTab(BODY, 'C'));
    // file MIDI tối thiểu: một track piano, một track hát (bè 1:0 bị bỏ)
    const trk = (ev: number[]) => [0x4d, 0x54, 0x72, 0x6b, 0, 0, 0, ev.length + 4, ...ev, 0, 0xff, 0x2f, 0];
    const bytes = new Uint8Array([
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, 2, 0x01, 0xe0,
      ...trk([0, 0x90, 60, 90, 0x83, 0x60, 0x80, 60, 0]),
      ...trk([0, 0x91, 48, 90, 0x83, 0x60, 0x81, 48, 0]),
    ]);
    await saveMidiSource('mid', 'bai.mid', bytes, { melodyPart: '0:0', startBeat: 0, shift: 0 }, tabSig(flat));
    const setOpts = vi.fn();
    const p = {
      playing: false, active: null, countIn: null, chord: null, accompNote: null,
      opts: { sing: false, bpm: 90, tempoScale: 1 } as PlayerState['opts'],
      setOpts, play: vi.fn(), stop: () => {}, toggle: () => {}, beatAt: () => null,
    } as unknown as PlayerState;
    const { unmount } = render(<KaraokeView song={song} original={song} flat={flat} p={p} chordSegs={null} onClose={() => {}} />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'MIDI gốc' }).getAttribute('aria-checked')).toBe('true'));
    await waitFor(() => expect(setOpts.mock.calls.some(([o]) => o.arrangement?.notes?.length === 1)).toBe(true));
    const arr = setOpts.mock.calls.map(([o]) => o.arrangement).find((a) => a)!;
    expect(arr.notes[0]).toMatchObject({ midi: 48, voice: 'piano', beat: 0 });
    expect((screen.getByLabelText('Nâng tông') as HTMLButtonElement).disabled).toBe(false);
    // đổi nhạc cụ bè piano sang guitar: bản phối dựng lại, nhớ theo bài
    fireEvent.click(screen.getByRole('button', { name: /Nhạc cụ/ }));
    const sel = screen.getByRole('combobox', { name: /Kênh 2|Track/ }) as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'guitar' } });
    await waitFor(() => expect(setOpts.mock.calls.some(([o]) => o.arrangement?.notes?.[0]?.voice === 'guitar')).toBe(true));
    await waitFor(async () => expect((await loadMidiSource('mid'))?.voices).toEqual({ '1:1': 'guitar' }));
    fireEvent.click(screen.getByRole('radio', { name: 'Tự đệm' }));
    await waitFor(() => expect(setOpts).toHaveBeenLastCalledWith({ arrangement: null }));
    unmount();
    expect(setOpts).toHaveBeenLastCalledWith(expect.objectContaining({ arrangement: null }));
  });
});
