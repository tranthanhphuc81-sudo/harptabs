import { useEffect, useRef, useState } from 'react';
import { audio, click } from '../audio/engine';
import { heardTime, outputDelay } from '../audio/latency';

/** Bù trễ đèn nốt: phát tiếng tích đều + chấm sáng, kéo thanh trượt tới khi chấm sáng đúng lúc nghe tiếng */
export function SyncCalibrator({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const [testing, setTesting] = useState(false);
  const [reported, setReported] = useState<number | null>(null);
  const dot = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!testing) return;
    const c = audio();
    void c.resume?.();
    const period = 0.6;
    let next = c.currentTime + 0.25;
    let n = 0;
    const times: number[] = [];
    const schedule = () => {
      while (next < c.currentTime + 0.3) {
        click(next, n % 4 === 0);
        times.push(next);
        if (times.length > 8) times.shift();
        next += period;
        n++;
      }
    };
    schedule();
    const timer = window.setInterval(schedule, 50);
    let raf = 0;
    const frame = () => {
      const h = heardTime(c);
      const last = times.filter((t) => t <= h).pop();
      dot.current?.classList.toggle('lit', last !== undefined && h - last < 0.12);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    setReported(Math.round(outputDelay(c) * 1000));
    return () => { window.clearInterval(timer); cancelAnimationFrame(raf); };
  }, [testing]);

  const label = value === 0 ? '0 ms' : `${value > 0 ? '+' : ''}${value} ms — đèn ${value > 0 ? 'sáng muộn hơn' : 'sáng sớm hơn'}`;
  return (
    <div className="field wide sync-cal">
      <label className="field-label" htmlFor="sync-offset">Bù trễ đèn nốt</label>
      <div className="row gap center wrap">
        <input id="sync-offset" className="grow" type="range" min={-300} max={400} step={10} value={value}
          onChange={(e) => onChange(Number(e.target.value))} aria-valuetext={label} />
        <span className="sync-value">{label}</span>
      </div>
      <div className="row gap center wrap">
        <button type="button" className={`btn btn-ghost btn-sm${testing ? ' on' : ''}`} aria-pressed={testing} onClick={() => setTesting((v) => !v)}>
          {testing ? 'Dừng thử' : 'Thử'}
        </button>
        {testing && <span ref={dot} className="sync-dot" aria-hidden="true" />}
        {value !== 0 && <button type="button" className="link-btn" onClick={() => onChange(0)}>Về 0</button>}
      </div>
      <span className="help">
        App đã tự trừ độ trễ máy báo{reported !== null ? ` (${reported} ms)` : ''}. Nếu đèn nốt vẫn sáng trước tiếng (hay gặp với loa / tai nghe Bluetooth),
        bấm Thử rồi kéo sang phải tới khi chấm sáng đúng lúc nghe tiếng tích.
      </span>
    </div>
  );
}
