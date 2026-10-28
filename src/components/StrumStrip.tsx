import { useEffect, useState } from 'react';
import { strumPattern } from '../audio/patterns';
import type { BeatStyle } from '../audio/patterns';
import type { Accomp } from '../audio/engine';

/**
 * Dải điệu quạt guitar: lấy đúng mẫu nhạc đệm đang đánh (src/audio/patterns.ts), mỗi ô một nhịp nhỏ,
 * ô đang đánh sáng theo nhạc. B = gảy bass, ↓ quạt xuống, ↑ quạt lên, ✕ chặn dây (gõ bo), · nghỉ.
 */

const SUB_LABELS: Record<number, string[]> = { 1: [''], 2: ['', '&'], 3: ['', '·', '·'], 4: ['', 'e', '&', 'a'] };

export function strumCells(style: BeatStyle, beatsPerBar: number, accomp: Accomp) {
  const p = strumPattern(style, beatsPerBar);
  const per = p.beats * p.subdiv;
  // mẫu dài 2 ô (ô sau biến tấu): hiện ô đầu cho dễ nhớ
  const one = p.strum.slice(0, per);
  return {
    subdiv: p.subdiv,
    cells: [...one].map((ch, i) => {
      const beat = Math.floor(i / p.subdiv);
      const sub = i % p.subdiv;
      const mark = ch === 'B' || ch === 'F' ? 'B' : ch === 'D' ? '↓' : ch === 'd' ? '↓' : ch === 'U' ? '↑' : ch === 'X' ? (accomp === 'gobo' ? '✕' : '↓') : '·';
      return { mark, soft: ch === 'd', hit: ch === 'X', count: sub === 0 ? String(beat + 1) : (SUB_LABELS[p.subdiv]?.[sub] ?? '') };
    }),
  };
}

export function StrumStrip({ style, beatsPerBar, pickupBeats, accomp, playing, beatAt }: {
  style: BeatStyle; beatsPerBar: number; pickupBeats: number; accomp: Accomp; playing: boolean; beatAt: () => number | null;
}) {
  const { cells, subdiv } = strumCells(style, beatsPerBar, accomp);
  const [cur, setCur] = useState(-1);
  useEffect(() => {
    if (!playing) { setCur(-1); return; }
    let raf = 0;
    let last = -2;
    const tick = () => {
      const b = beatAt();
      const i = b == null || b < pickupBeats - 1e-6 ? -1 : Math.floor((b - pickupBeats) * subdiv + 1e-6) % cells.length;
      if (i !== last) { last = i; setCur(i); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, beatAt, pickupBeats, subdiv, cells.length]);
  return (
    <div className="strum-strip" role="img" aria-label={`Điệu quạt: ${cells.map((c) => c.mark).join(' ')}`}>
      {cells.map((c, i) => (
        <span key={i} className={`ss-cell${i === cur ? ' on' : ''}${c.mark === '·' ? ' rest' : ''}${c.soft ? ' soft' : ''}${c.hit && accomp === 'gobo' ? ' hit' : ''}${i % subdiv === 0 ? ' beat' : ''}`}>
          <b>{c.mark}</b>
          <small>{c.count}</small>
        </span>
      ))}
    </div>
  );
}
