/** thước cao độ khi bend / nhấn / nắn: vạch nốt gốc, vùng đúng quanh nốt đích, chấm là cao độ đang nghe */
export function BendMeter({ base, target, midi, name }: { base: number; target: number; midi: number | null; name: (m: number) => string }) {
  const lo = Math.min(base, target) - 0.7;
  const hi = Math.max(base, target) + 0.7;
  const pct = (m: number) => `${(100 * (Math.max(lo, Math.min(hi, m)) - lo)) / (hi - lo)}%`;
  const zone = 0.25;
  return (
    <div className="bend-meter" aria-hidden="true">
      <div className="bm-track">
        <div className="bm-zone" style={{ left: pct(target - zone), width: `${(100 * 2 * zone) / (hi - lo)}%` }} />
        <div className="bm-mark" style={{ left: pct(base) }}><span>{name(base)}</span></div>
        <div className="bm-mark target" style={{ left: pct(target) }}><span>{name(target)}</span></div>
        {midi !== null && <div className="bm-dot" style={{ left: pct(midi) }} />}
      </div>
    </div>
  );
}
