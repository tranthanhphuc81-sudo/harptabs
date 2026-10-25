// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankSong } from '../lib/db';
import { saveBacking, tabSig } from '../lib/backings';
import { flatten, parseTab } from '../lib/tabText';
import type { PlayerState } from './usePlayer';

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
    fireEvent.click(screen.getByRole('radio', { name: 'Tổng hợp' }));
    fireEvent.click(screen.getByLabelText('Hát'));
    expect(synthPlay).toHaveBeenCalled();
  });
});
