import { useCallback, useEffect, useRef, useState } from 'react';
import { BackingPlayer, decodeBacking } from '../audio/backingPlayer';
import { mapOf } from '../lib/backings';
import type { FlatEvent } from '../lib/tabText';
import type { Backing } from '../lib/types';

export interface BackingTransport {
  status: 'none' | 'loading' | 'ready' | 'error';
  error: string | null;
  playing: boolean;
  /** nhạc nền không đếm vào: đoạn dạo của bài là phần đếm */
  countIn: null;
  /** giây mỗi phách (trung vị theo bản đồ nhịp) */
  spb: number;
  play: (fromIndex?: number) => void;
  stop: () => void;
  toggle: () => void;
  beatAt: () => number | null;
}

/** Bộ phát nhạc nền MP3 của bài: đọc file một lần, phát theo bản đồ nhịp, cùng giao diện với bộ phát tổng hợp */
export function useBackingPlayer(backing: Backing | null, flat: FlatEvent[]): BackingTransport {
  const player = useRef<BackingPlayer | null>(null);
  const [status, setStatus] = useState<BackingTransport['status']>('none');
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const flatRef = useRef(flat);
  flatRef.current = flat;

  // đọc file (chỉ khi đổi file); bản đồ nhịp / chỉnh lệch đổi thì cập nhật, không đọc lại
  const blob = backing?.blob ?? null;
  useEffect(() => {
    player.current?.stop();
    player.current = null;
    setPlaying(false);
    if (!blob || !backing) { setStatus('none'); return; }
    let alive = true;
    setStatus('loading');
    decodeBacking(blob).then((buf) => {
      if (!alive) return;
      const bp = new BackingPlayer(buf, mapOf(backing), backing.offsetMs);
      bp.onEnd = () => setPlaying(false);
      player.current = bp;
      setStatus('ready');
      setError(null);
    }).catch((e: Error) => { if (alive) { setStatus('error'); setError(e.message); } });
    return () => { alive = false; player.current?.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- đọc lại chỉ khi đổi file
  }, [blob]);
  useEffect(() => {
    if (backing) player.current?.setSync(mapOf(backing), backing.offsetMs);
  }, [backing, status]);

  const play = useCallback((fromIndex?: number) => {
    const bp = player.current;
    if (!bp) return;
    const f = fromIndex != null ? flatRef.current[fromIndex] : undefined;
    bp.start(f ? f.start : 0);
    setPlaying(true);
  }, []);
  const stop = useCallback(() => { player.current?.stop(); setPlaying(false); }, []);
  const toggle = useCallback(() => (player.current?.playing ? stop() : play()), [play, stop]);
  const beatAt = useCallback(() => player.current?.currentBeat() ?? null, []);

  return { status, error, playing, countIn: null, spb: backing?.spb ?? 0.6, play, stop, toggle, beatAt };
}
