import { useEffect, useRef, useState } from 'react';
import { audio, click } from '../audio/engine';
import { estimatedLatency, OnsetMic } from '../audio/onsetMic';
import { Icon } from '../components/Icon';
import { useWakeLock } from '../components/useWakeLock';
import { logMetric, usePracticeTimer } from '../lib/practiceLog';
import { dropClicks, GOOD_MS, HitResult, loopbackLatency, matchHits, Onset, OnsetDetector, RHYTHM_PATTERNS, rhythmAdvice, rhythmStats, RhythmStats } from '../lib/rhythm';

/**
 * Tập nhịp: máy đếm vào một ô nhịp rồi chạy tiếp N ô; người tập chơi theo mẫu nhịp (một nốt bất kỳ hoặc vỗ tay).
 * Ô đếm vào cũng dùng để đo độ trễ của máy (tiếng gõ của máy lọt vào micro) — trừ đi khi chấm.
 */
const BEST_KEY = 'harptabs.rhythmPractice';
const LAT_KEY = 'harptabs.rhythmLatency';
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* không lưu được thì thôi */ } };

type Phase = 'idle' | 'countin' | 'play' | 'result';
interface Result { hits: HitResult[]; stats: RhythmStats; ok: boolean; lines: string[]; latency: number; measured: boolean }

const BARS = 4;

export default function RhythmPractice() {
  const [pi, setPi] = useState(0);
  const [bpm, setBpm] = useState(70);
  const [autoUp, setAutoUp] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  const [beatNow, setBeatNow] = useState(-1);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<Record<string, number>>(() => load(BEST_KEY, {}));
  const mic = useRef<OnsetMic | null>(null);
  const onsets = useRef<Onset[]>([]);
  const det = useRef(new OnsetDetector());
  const raf = useRef(0);
  const timer = useRef<number>();
  const running = phase === 'countin' || phase === 'play';
  useWakeLock(running);
  usePracticeTimer('nhip', running);

  const pat = RHYTHM_PATTERNS[pi];
  useEffect(() => () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current); mic.current?.stop(); }, []);

  const run = async () => {
    setErr(null);
    setResult(null);
    try {
      if (!mic.current) {
        const m = new OnsetMic();
        m.onBlock = (t, e) => { const o = det.current.feed(t, e); if (o) onsets.current.push(o); };
        await m.start();
        mic.current = m;
      }
    } catch (e) { setErr(e instanceof Error ? e.message : 'Không mở được micro'); return; }
    const c = audio();
    const beat = 60 / bpm;
    const bpb = pat.beatsPerBar;
    const t0 = c.currentTime + 0.4;
    const tPlay = t0 + bpb * beat;
    const total = bpb * (BARS + 1);
    const clicks: number[] = [];
    for (let i = 0; i <= total; i++) { const t = t0 + i * beat; clicks.push(t); click(t, i % bpb === 0); }
    const wants: number[] = [];
    for (let b = 0; b < BARS; b++) for (const h of pat.hits) wants.push(tPlay + (b * bpb + h) * beat);
    onsets.current = [];
    setPhase('countin');
    // hiện phách đang chạy
    const tick = () => {
      const i = Math.floor((c.currentTime - t0) / beat);
      setBeatNow(i);
      if (i >= bpb) setPhase((p) => (p === 'countin' ? 'play' : p));
      if (i <= total) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    const end = tPlay + BARS * bpb * beat + 0.45;
    timer.current = window.setTimeout(() => finish(clicks.slice(0, bpb), clicks.slice(bpb), wants, tPlay), (end - c.currentTime) * 1000 + 120);
  };

  const finish = (countClicks: number[], playClicks: number[], wants: number[], tPlay: number) => {
    cancelAnimationFrame(raf.current);
    setBeatNow(-1);
    const all = onsets.current;
    const loop = loopbackLatency(countClicks, all.filter((o) => o.t < tPlay - 0.05));
    if (loop) save(LAT_KEY, loop.latency);
    const latency = loop?.latency ?? load<number | null>(LAT_KEY, null) ?? estimatedLatency();
    const heard = (loop ? dropClicks(all, playClicks, loop) : all).filter((o) => o.t >= tPlay - 0.3).map((o) => o.t - latency);
    const r = matchHits(wants, heard);
    const stats = rhythmStats(r);
    const adv = rhythmAdvice(stats);
    r.hits.forEach((h) => logMetric('nhip', h.ms !== null && Math.abs(h.ms) <= GOOD_MS ? 1 : 0));
    setResult({ hits: r.hits, stats, ok: adv.ok, lines: adv.lines, latency, measured: !!loop });
    setPhase('result');
    if (adv.ok) {
      setBest((p) => { if ((p[pat.id] ?? 0) >= bpm) return p; const n = { ...p, [pat.id]: bpm }; save(BEST_KEY, n); return n; });
      if (autoUp) setBpm((b) => Math.min(200, b + 5));
    }
  };

  const stop = () => { clearTimeout(timer.current); cancelAnimationFrame(raf.current); setBeatNow(-1); setPhase('idle'); };

  const bpb = pat.beatsPerBar;
  const hitColor = (ms: number | null) => (ms === null ? 'miss' : Math.abs(ms) <= 30 ? 'good' : Math.abs(ms) <= GOOD_MS ? 'ok' : 'off');

  return (
    <div className="page rhythm-practice">
      <header className="page-head">
        <div>
          <h1>Tập nhịp</h1>
          <p className="muted">Máy đếm vào một ô nhịp, rồi bạn chơi theo mẫu {BARS} ô nhịp — chơi một nốt bất kỳ trên nhạc cụ, hoặc vỗ tay. App nghe và cho biết mỗi tiếng sớm hay muộn bao nhiêu.</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <label className="field" htmlFor="rp-pat">
          <span className="field-label">Mẫu nhịp</span>
          <select id="rp-pat" value={pi} onChange={(e) => { setPi(Number(e.target.value)); setResult(null); }} disabled={running}>
            {RHYTHM_PATTERNS.map((p, i) => <option key={p.id} value={i}>{p.label}{best[p.id] ? ` (đạt ${best[p.id]})` : ''}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="rp-bpm">
          <span className="field-label">Tốc độ: {bpm} nhịp/phút</span>
          <input id="rp-bpm" type="range" min={40} max={200} step={5} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} disabled={running} />
        </label>
        <button type="button" className={`btn btn-lg ${running ? 'btn-ghost' : 'btn-primary'}`} onClick={running ? stop : run}>
          <Icon name="mic" size={20} /> {running ? 'Dừng' : result ? 'Tập lại' : 'Bắt đầu'}
        </button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      <section className="rp-pattern" aria-label={`Mẫu nhịp: ${pat.count}`}>
        <div className="rp-beats" style={{ gridTemplateColumns: `repeat(${bpb}, 1fr)` }}>
          {Array.from({ length: bpb }, (_, i) => {
            const cur = beatNow >= 0 && beatNow % bpb === i;
            return <span key={i} className={`rp-beat${cur ? ' now' : ''}${cur && phase === 'countin' ? ' count' : ''}`}>{i + 1}</span>;
          })}
          {pat.hits.map((h) => <i key={h} className="rp-hit" style={{ left: `${(100 * h) / bpb}%` }} />)}
        </div>
        <p className="rp-count">{pat.count}</p>
        <p className="rp-phase" aria-live="polite">{phase === 'countin' ? `Đếm vào… ${beatNow >= 0 ? (beatNow % bpb) + 1 : ''}` : phase === 'play' ? `Chơi! Ô nhịp ${Math.min(BARS, Math.floor(beatNow / bpb))}/${BARS}` : ' '}</p>
      </section>

      {result && (
        <section className={`bp-result${result.ok ? ' k-ok' : ' k-open'}`} aria-live="polite">
          <strong className="bp-kind">{result.ok ? 'Đều và đúng nhịp!' : 'Kết quả'}</strong>
          <ul className="cp-issues">{result.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <div className="rp-bars">
            {Array.from({ length: BARS }, (_, b) => (
              <div key={b} className="rp-row">
                {result.hits.slice(b * pat.hits.length, (b + 1) * pat.hits.length).map((h, i) => (
                  <span key={i} className={`rp-chip ${hitColor(h.ms)}`} title={h.ms === null ? 'bỏ sót' : `${h.ms} ms`}>
                    {h.ms === null ? '×' : h.ms > 0 ? `+${h.ms}` : h.ms}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <p className="small muted">Số trên mỗi ô: lệch bao nhiêu mili giây (âm = sớm, dương = muộn, × = bỏ sót). Xanh: lệch dưới 30 ms; vàng: dưới {GOOD_MS} ms.
            {result.measured ? ` Độ trễ máy đo được: ${Math.round(result.latency * 1000)} ms (đã trừ).` : ` Không nghe thấy tiếng máy (đang đeo tai nghe?) — dùng độ trễ ước lượng ${Math.round(result.latency * 1000)} ms.`}</p>
        </section>
      )}

      <label className="check"><input type="checkbox" checked={autoUp} onChange={(e) => setAutoUp(e.target.checked)} /> Đạt thì tăng 5 nhịp/phút</label>

      <details className="card bp-tips">
        <summary>Cách tập nhịp</summary>
        <ul>
          <li>Bắt đầu chậm (60–70 nhịp/phút). Đúng đều 80% trở lên mới tăng tốc.</li>
          <li><strong>Đếm thành tiếng</strong> theo dòng đếm dưới mẫu ("1 & 2 &"). Đếm được thì chơi được.</li>
          <li>Chơi tiếng ngắn, dứt khoát (đánh lưỡi "tu" với kèn, sáo; gảy gọn với đàn) — app bắt tiếng gõ đầu nốt.</li>
          <li>Để loa vừa phải, điện thoại cách nhạc cụ khoảng nửa mét. Ô đếm vào dùng để đo độ trễ của máy: đừng chơi trong lúc đếm vào.</li>
          <li>Đeo tai nghe cũng được: app dùng độ trễ đo được lần trước (hoặc ước lượng).</li>
        </ul>
      </details>
    </div>
  );
}
