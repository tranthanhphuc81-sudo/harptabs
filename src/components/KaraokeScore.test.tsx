// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { blankSong } from '../lib/db';
import { loadBest } from '../lib/practiceScore';
import { flatten, parseTab } from '../lib/tabText';
import type { PlayerState } from './usePlayer';

// micro giả: test tự gọi onReading
const mics: { onReading?: (r: { midi: number } | null) => void; opts: unknown }[] = [];
vi.mock('../audio/pitch', () => ({
  VOICE_MIC: { minHz: 75 },
  MicPitch: class {
    onReading?: (r: { midi: number } | null) => void;
    windowDelay = 0;
    constructor(public opts: unknown) { mics.push(this); }
    async start() {}
    stop() {}
  },
}));
const { default: KaraokeView } = await import('./KaraokeView');

afterEach(cleanup);
// jsdom không có canvas: dải cao độ tự bỏ qua khi không vẽ được
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

const BODY = `4 5 6 7
Hát cho vui nhé`;

describe('karaoke chấm điểm giọng hát', () => {
  it('bật chấm điểm → hát đúng trong lúc phát → dừng thì hiện điểm và lưu điểm cao nhất', async () => {
    const song = blankSong({ id: 'ks', title: 'Thử', body: BODY, harpKey: 'C', bpm: 120 });
    const flat = flatten(parseTab(BODY, 'C'));
    const beat = { v: null as number | null };
    const mk = (playing: boolean) => ({
      playing, active: null, countIn: null, chord: null, accompNote: null,
      opts: { sing: false, bpm: 120, tempoScale: 1 } as PlayerState['opts'],
      setOpts: () => {}, play: () => {}, stop: () => {}, toggle: () => {}, beatAt: () => beat.v,
    }) as unknown as PlayerState;
    const view = (playing: boolean) => <KaraokeView song={song} original={song} flat={flat} p={mk(playing)} chordSegs={null} onClose={() => {}} />;
    const r = render(view(false));

    fireEvent.click(screen.getByText(/Chấm điểm/));
    await waitFor(() => expect(mics.length).toBe(1));
    // không đeo tai nghe: micro bật khử tiếng vọng
    expect(mics[0].opts).toMatchObject({ echoCancellation: true });

    r.rerender(view(true));
    // hát đúng từng nốt (giọng nam, thấp hơn một quãng tám)
    await act(async () => {
      for (let b = 0; b < 4; b += 0.05) {
        beat.v = b + 0.06 * 2; // trả lại độ trễ micro mặc định 60 ms (120 bpm → 0,12 phách)
        const f = flat[Math.min(3, Math.floor(b))];
        mics[0].onReading?.({ midi: f.midi! - 12 });
      }
    });
    r.rerender(view(false));

    expect(await screen.findByText('Hát hết bài')).toBeTruthy();
    const score = Number(document.querySelector('.practice-result .pr-score strong')?.textContent);
    expect(score).toBeGreaterThanOrEqual(90);
    expect((await loadBest('karaokeScore:ks'))?.best).toBe(score);
  });
});
