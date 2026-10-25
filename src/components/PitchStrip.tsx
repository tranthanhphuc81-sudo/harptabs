import { useEffect, useRef } from 'react';
import type { KLine } from '../lib/karaoke';
import type { KaraokeScorer } from '../lib/karaokeScore';

/**
 * Dải cao độ khi chấm điểm: vạch ngang = nốt cần hát, chấm = giọng đang hát (đã gập về cùng quãng tám),
 * vạch dọc = bây giờ. Vẽ bằng canvas mỗi khung hình, không vẽ lại React.
 */
export function PitchStrip({ lines, scorer, getBeat, spb }: {
  lines: KLine[];
  scorer: { current: KaraokeScorer | null };
  getBeat: () => number | null;
  spb: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const css = getComputedStyle(cv);
    const color = (v: string, fb: string) => css.getPropertyValue(v).trim() || fb;
    const C = { target: color('--draw-edge', '#94b5df'), ok: color('--accent', '#d08a1e'), bad: color('--bend', '#b3264a'), now: color('--ink-2', '#5a6773') };
    const span = 4 / spb; // 4 giây
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const sc = scorer.current;
      const beat = getBeat();
      if (!sc || beat === null) return;
      const b0 = beat - span * 0.35, b1 = beat + span * 0.65;
      const x = (b: number) => ((b - b0) / (b1 - b0)) * w;
      // nốt cần hát trong khung nhìn
      const bars: { s: number; e: number; m: number }[] = [];
      for (const l of lines) {
        if (l.end < b0 || l.start > b1 || l.instrumental) continue;
        for (const s of l.syls) {
          if (!s.text || s.end < b0 || s.start > b1) continue;
          const m = sc.targetAt(s, s.start);
          if (m !== null) bars.push({ s: s.start, e: s.end, m });
        }
      }
      const ms = bars.map((b) => b.m);
      const mid = ms.length ? (Math.min(...ms) + Math.max(...ms)) / 2 : 60;
      const half = Math.max(7, ms.length ? (Math.max(...ms) - Math.min(...ms)) / 2 + 3 : 7);
      const y = (m: number) => h / 2 - ((m - mid) / half) * (h / 2 - 6);
      g.lineCap = 'round';
      g.lineWidth = 8;
      g.strokeStyle = C.target;
      for (const b of bars) { g.beginPath(); g.moveTo(x(b.s) + 4, y(b.m)); g.lineTo(Math.max(x(b.s) + 4, x(b.e) - 4), y(b.m)); g.stroke(); }
      // giọng hát
      for (const p of sc.trail) {
        if (p.beat < b0 || p.beat > beat) continue;
        g.fillStyle = p.ok ? C.ok : C.bad;
        g.beginPath(); g.arc(x(p.beat), Math.max(4, Math.min(h - 4, y(p.midi))), 3, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = C.now;
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x(beat), 0); g.lineTo(x(beat), h); g.stroke();
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [lines, scorer, getBeat, spb]);

  return <canvas ref={ref} className="kara-pitch" aria-label="Cao độ giọng hát so với nốt cần hát" role="img" />;
}
