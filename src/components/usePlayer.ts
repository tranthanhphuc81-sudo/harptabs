import { useCallback, useEffect, useRef, useState } from 'react';
import { Player, PlayerOptions } from '../audio/player';
import { audio } from '../audio/engine';
import { FlatEvent } from '../lib/tabText';

export interface PlayerState {
  playing: boolean;
  active: number | null;
  /** đang đếm vào: số phách còn lại */
  countIn: number | null;
  /** hợp âm đệm đang vang (khi bật bass) */
  chord: string | null;
  opts: PlayerOptions;
  setOpts: (p: Partial<PlayerOptions>) => void;
  play: (fromIndex?: number) => void;
  stop: () => void;
  toggle: () => void;
}

function findIndex(flat: FlatEvent[], beat: number): number | null {
  let lo = 0, hi = flat.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (flat[mid].start <= beat + 1e-6) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans < 0 ? null : ans;
}

export function usePlayer(flat: FlatEvent[], init: Omit<PlayerOptions, 'loop'> & { loop?: PlayerOptions['loop'] }): PlayerState {
  const playerRef = useRef<Player | null>(null);
  const [opts, setOptsState] = useState<PlayerOptions>({ loop: null, ...init });
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [countIn, setCountIn] = useState<number | null>(null);
  const [chord, setChord] = useState<string | null>(null);
  const raf = useRef(0);
  const flatRef = useRef(flat);
  flatRef.current = flat;

  if (!playerRef.current) playerRef.current = new Player(opts);
  const player = playerRef.current;

  useEffect(() => { player.load(flat); }, [flat, player]);

  // đồng bộ khi bài thay đổi tempo/nhịp gốc
  useEffect(() => {
    setOptsState((o) => ({ ...o, bpm: init.bpm, beatsPerBar: init.beatsPerBar, pickupBeats: init.pickupBeats, style: init.style, songKey: init.songKey, chordOverrides: init.chordOverrides }));
  }, [init.bpm, init.beatsPerBar, init.pickupBeats, init.style, init.songKey, init.chordOverrides]);

  useEffect(() => {
    const prevStyle = player.options.style;
    player.setOptions(opts);
    if (player.playing && prevStyle !== opts.style) {
      const b = player.currentBeat() ?? 0;
      player.start(Math.max(0, b));
    }
  }, [opts, player]);

  const loop = useCallback(() => {
    const b = player.currentBeat();
    const f = flatRef.current;
    if (b === null) return;
    const first = f[0]?.start ?? 0;
    if (b < first - 1e-3 && !player.options.loop) {
      setCountIn(Math.ceil(first - b));
    } else setCountIn(null);
    const idx = findIndex(f, b);
    setActive((prev) => (prev === idx ? prev : idx));
    const ch = player.chordAt(Math.max(0, b))?.name ?? null;
    setChord((prev) => (prev === ch ? prev : ch));
    raf.current = requestAnimationFrame(loop);
  }, [player]);

  const stop = useCallback(() => {
    player.stop();
    cancelAnimationFrame(raf.current);
    setPlaying(false);
    setCountIn(null);
    setChord(null);
  }, [player]);

  const play = useCallback((fromIndex?: number) => {
    audio();
    const f = flatRef.current;
    if (!f.length) return;
    const from = fromIndex != null && f[fromIndex] ? f[fromIndex].start : player.options.loop?.start ?? 0;
    player.onEnd = () => { cancelAnimationFrame(raf.current); setPlaying(false); setActive(null); setCountIn(null); setChord(null); };
    player.start(from);
    setPlaying(true);
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  }, [player, loop]);

  const toggle = useCallback(() => (player.playing ? stop() : play()), [player, play, stop]);

  useEffect(() => () => { player.stop(); cancelAnimationFrame(raf.current); }, [player]);

  const setOpts = useCallback((p: Partial<PlayerOptions>) => setOptsState((o) => ({ ...o, ...p })), []);

  return { playing, active, countIn, chord, opts, setOpts, play, stop, toggle };
}
