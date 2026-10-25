// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankSong } from '../lib/db';
import { listRecordings } from '../lib/recordings';
import { flatten, parseTab } from '../lib/tabText';
import type { PlayerState } from './usePlayer';

const starts: [boolean, number][] = [];
vi.mock('../audio/karaokeRecorder', () => ({
  recorderSupported: () => true,
  KaraokeRecorder: class {
    onLimit?: () => void;
    async start(echo: boolean, extra: number) { starts.push([echo, extra]); }
    async stop() { return { blob: new Blob([new Uint8Array(500)], { type: 'audio/webm' }), mime: 'audio/webm', durationSec: 12, voiceLagMs: 140 }; }
    cancel() {}
  },
}));
const { default: KaraokeView } = await import('./KaraokeView');

afterEach(cleanup);
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

describe('karaoke thu âm', () => {
  it('bấm Thu → hát → dừng: lưu bản thu (độ trễ giọng, tông) và hiện số bản thu', async () => {
    const BODY = '4 5 6 7\nHát cho vui nhé';
    const song = blankSong({ id: 'rec1', title: 'Thu thử', body: BODY, harpKey: 'C' });
    const flat = flatten(parseTab(BODY, 'C'));
    const play = vi.fn();
    const mk = (playing: boolean) => ({
      playing, active: null, countIn: null, chord: null, accompNote: null,
      opts: { sing: false, bpm: 90, tempoScale: 1 } as PlayerState['opts'],
      setOpts: () => {}, play, stop: () => {}, toggle: () => {}, beatAt: () => null,
    }) as unknown as PlayerState;
    const view = (playing: boolean) => <KaraokeView song={song} original={song} flat={flat} p={mk(playing)} chordSegs={null} onClose={() => {}} />;
    const r = render(view(false));

    fireEvent.click(screen.getByLabelText('Vừa hát vừa thu âm'));
    await waitFor(() => expect(play).toHaveBeenCalled());
    // không đeo tai nghe: khử tiếng vọng; độ trễ cộng thêm = độ trễ micro mặc định 60 ms + bù đèn 0
    expect(starts[0]).toEqual([true, 60]);
    r.rerender(view(true));
    expect(await screen.findByText(/Đang thu/)).toBeTruthy();
    await act(async () => { r.rerender(view(false)); });

    await waitFor(async () => expect(await listRecordings('rec1')).toHaveLength(1));
    const [saved] = await listRecordings('rec1');
    expect(saved).toMatchObject({ voiceLagMs: 140, transpose: 0, durationSec: 12, title: 'Thu thử' });
    expect(await screen.findByText('Bản thu (1)')).toBeTruthy();
  });
});
