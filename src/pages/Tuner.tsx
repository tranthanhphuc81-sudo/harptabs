import { useEffect, useRef, useState } from 'react';
import { HarpKey, harpLayout, midiToName, TECHNIQUE_LABEL } from '../lib/harp';
import { MicPitch, PitchReading } from '../audio/pitch';
import { HarpDiagram } from '../components/HarpDiagram';
import { KeySelect } from '../components/KeySelect';
import { Icon } from '../components/Icon';
import { TokenText } from '../components/TabView';
import { useAppState } from '../state';

export default function Tuner() {
  const { settings } = useAppState();
  const [key, setKey] = useState<HarpKey>(settings.defaultHarpKey);
  const [on, setOn] = useState(false);
  const [r, setR] = useState<PitchReading | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const micRef = useRef<MicPitch | null>(null);
  const smooth = useRef<number[]>([]);
  const holdRef = useRef<{ r: PitchReading | null; t: number }>({ r: null, t: 0 });

  useEffect(() => () => micRef.current?.stop(), []);

  const start = async () => {
    setErr(null);
    const mic = new MicPitch();
    mic.onReading = (x) => {
      const now = performance.now();
      if (!x) {
        // giữ kết quả cuối 400ms để chữ không nhấp nháy
        if (now - holdRef.current.t > 400) { setR(null); smooth.current = []; }
        return;
      }
      smooth.current.push(x.cents);
      if (smooth.current.length > 6) smooth.current.shift();
      const avg = smooth.current.reduce((a, b) => a + b, 0) / smooth.current.length;
      const out = { ...x, cents: avg };
      holdRef.current = { r: out, t: now };
      setR(out);
    };
    try {
      await mic.start();
      micRef.current = mic;
      setOn(true);
    } catch (e) {
      setErr((e as Error).name === 'NotAllowedError' ? 'Bạn chưa cho phép dùng micro. Bật quyền micro cho trang này rồi thử lại.' : (e as Error).message);
    }
  };
  const stop = () => { micRef.current?.stop(); micRef.current = null; setOn(false); setR(null); };

  const matches = r ? harpLayout(key).filter((n) => n.midi === r.nearest) : [];
  const cents = r ? Math.round(r.cents) : 0;
  const inTune = r && Math.abs(cents) <= 15;

  return (
    <div className="page page-tuner">
      <header className="page-head">
        <div>
          <h1>Dò nốt</h1>
          <p className="muted">Thổi vào kèn, app cho biết bạn đang ra nốt gì, lỗ nào, và bend đã đủ sâu chưa.</p>
        </div>
      </header>

      <div className="row gap wrap end-align">
        <KeySelect value={key} onChange={(k) => setKey(k as HarpKey)} id="tuner-key" />
        <button type="button" className={`btn btn-lg ${on ? 'btn-ghost' : 'btn-primary'}`} onClick={on ? stop : start}>
          <Icon name="mic" size={20} /> {on ? 'Tắt micro' : 'Bật micro'}
        </button>
      </div>
      {err && <div className="alert error" role="alert">{err}</div>}

      <div className={`tuner-readout${inTune ? ' in-tune' : ''}`} aria-live="polite">
        <div className="tr-token">
          {matches.length ? matches.map((m, i) => (
            <span key={m.token} className={`tr-tok ${m.dir}`}>
              {i > 0 && <span className="tr-or">hoặc</span>}
              <TokenText token={m.token} />
            </span>
          )) : <span className="tr-none">{on ? (r ? 'ngoài tầm kèn' : 'đang nghe…') : '–'}</span>}
        </div>
        <div className="tr-note">
          {r ? <>{midiToName(r.nearest, settings.noteNames)} <span className="muted">{r.hz.toFixed(1)} Hz</span></> : ' '}
        </div>
        <div className="tr-tech">{matches.map((m) => TECHNIQUE_LABEL[m.technique]).join(' / ') || ' '}</div>
        <div className="cents-meter" role="meter" aria-valuemin={-50} aria-valuemax={50} aria-valuenow={cents} aria-label="Độ lệch cao độ (cent)">
          <div className="cm-scale"><span>−50</span><span>0</span><span>+50</span></div>
          <div className="cm-track"><div className="cm-center" /><div className="cm-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%`, opacity: r ? 1 : 0 }} /></div>
          <div className="cm-hint">
            {!r ? ' ' : inTune ? 'Chuẩn' : cents < 0 ? `Thấp ${-cents} cent` : `Cao ${cents} cent`}
          </div>
        </div>
      </div>

      <HarpDiagram harpKey={key} highlight={matches.map((m) => m.token)} nameStyle={settings.noteNames} />
      <p className="muted small">Mẹo: khi tập bend, nhìn kim lệch cent. Bend nửa cung ở lỗ 4 chuẩn khi app hiện <strong>−4′</strong> và kim ở giữa.</p>
    </div>
  );
}
