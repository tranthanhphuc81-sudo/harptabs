import { ReactNode, useState } from 'react';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
import { INSTRUMENT_OPTIONS, Instrument, previewNote } from '../audio/engine';
import { KIT_OPTIONS, resetBeatPrefs, setBeatPrefs, SWING_OPTIONS, useBeatPrefs } from '../audio/beatPrefs';
import { Icon } from './Icon';
import { PlayerState } from './usePlayer';

interface Props {
  p: PlayerState;
  loopLabel?: string | null;
  onToggleLoop?: () => void;
  extra?: ReactNode;
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className={`chip${on ? ' on' : ''}`} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="bt-slider">
      <span>{label}</span>
      <input type="range" min={0} max={100} step={5} value={Math.round(value * 100)} onChange={(e) => onChange(Number(e.target.value) / 100)} />
      <output>{Math.round(value * 100)}</output>
    </label>
  );
}

/** Bảng chỉnh âm beat: bộ trống, lắc, dồn trống, âm lượng, độ vang */
function BeatTuner() {
  const b = useBeatPrefs();
  return (
    <div className="beat-tuner" role="group" aria-label="Tuỳ chỉnh âm thanh">
      <label className="bt-row">
        <span className="bt-label">Nhạc cụ</span>
        <select className="chip-select" value={b.instrument} onChange={(e) => {
          setBeatPrefs({ instrument: e.target.value as Instrument });
          previewNote(67, 0.5);
        }}>
          {INSTRUMENT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <div className="bt-row">
        <span className="bt-label">Bộ trống</span>
        <div className="bt-seg">
          {KIT_OPTIONS.map((k) => <Toggle key={k.value} on={b.kit === k.value} onClick={() => setBeatPrefs({ kit: k.value })}>{k.label}</Toggle>)}
        </div>
      </div>
      <div className="bt-row">
        <span className="bt-label">Độ lắc</span>
        <div className="bt-seg">
          {SWING_OPTIONS.map((s) => <Toggle key={s.value} on={Math.abs(b.swing - s.value) < 1e-3} onClick={() => setBeatPrefs({ swing: s.value })}>{s.label}</Toggle>)}
        </div>
      </div>
      <div className="bt-row bt-seg">
        <Toggle on={b.bass} onClick={() => setBeatPrefs({ bass: !b.bass })}>Bass + đệm hợp âm</Toggle>
        <Toggle on={b.bo} onClick={() => setBeatPrefs({ bo: !b.bo })}>Gõ bo</Toggle>
        <Toggle on={b.humanize} onClick={() => setBeatPrefs({ humanize: !b.humanize })}>Đánh như người thật</Toggle>
        <Toggle on={b.fills} onClick={() => setBeatPrefs({ fills: !b.fills })}>Dồn trống cuối câu</Toggle>
      </div>
      <Slider label="Âm lượng beat" value={b.beatVol} onChange={(v) => setBeatPrefs({ beatVol: v })} />
      {b.bass && <Slider label="Âm lượng bass + đệm" value={b.bassVol} onChange={(v) => setBeatPrefs({ bassVol: v })} />}
      <Slider label="Âm lượng bo" value={b.boVol} onChange={(v) => setBeatPrefs({ boVol: v })} />
      <Slider label="Âm lượng cowbell" value={b.bellVol} onChange={(v) => setBeatPrefs({ bellVol: v })} />
      <Slider label="Âm lượng giai điệu" value={b.melodyVol} onChange={(v) => setBeatPrefs({ melodyVol: v })} />
      <Slider label="Độ vang" value={b.reverb} onChange={(v) => setBeatPrefs({ reverb: v })} />
      <button type="button" className="btn btn-ghost bt-reset" onClick={resetBeatPrefs}>Về mặc định</button>
    </div>
  );
}

export function PlayerBar({ p, loopLabel, onToggleLoop, extra }: Props) {
  const { opts, setOpts } = p;
  const [tuner, setTuner] = useState(false);
  const prefs = useBeatPrefs();
  const eff = Math.round(opts.bpm * opts.tempoScale);
  const step = (d: number) => setOpts({ tempoScale: Math.min(1.6, Math.max(0.4, Math.round((opts.tempoScale + d) * 100) / 100)) });
  return (
    <div className="playerbar" role="region" aria-label="Điều khiển phát">
      <div className="pb-main">
        <button type="button" className="pb-play" onClick={p.toggle} aria-label={p.playing ? 'Dừng' : 'Phát'}>
          <Icon name={p.playing ? 'stop' : 'play'} size={26} />
        </button>
        <div className="pb-tempo" aria-label="Tốc độ">
          <button type="button" className="icon-btn" onClick={() => step(-0.05)} aria-label="Chậm lại"><Icon name="minus" size={18} /></button>
          <div className="pb-tempo-val">
            <strong>{eff}</strong>
            <span>bpm ({Math.round(opts.tempoScale * 100)}%)</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => step(0.05)} aria-label="Nhanh lên"><Icon name="plus" size={18} /></button>
        </div>
        {p.countIn != null && <div className="pb-countin" aria-live="assertive">{p.countIn}</div>}
        {p.countIn == null && p.chord && opts.beat && prefs.bass && <div className="pb-chord" title="Hợp âm đệm">{p.chord}</div>}
        <label className="pb-style">
          <span className="sr-only">Kiểu beat</span>
          <select value={opts.style} onChange={(e) => setOpts({ style: e.target.value as BeatStyle })}>
            {STYLE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className={`icon-btn pb-tune${tuner ? ' on' : ''}`} aria-pressed={tuner} aria-label="Chỉnh âm thanh: nhạc cụ, beat, bass" title="Chỉnh âm thanh" onClick={() => setTuner(!tuner)}>
          <Icon name="sliders" size={20} />
        </button>
      </div>
      <div className="pb-chips">
        <Toggle on={opts.melody} onClick={() => setOpts({ melody: !opts.melody })}>Giai điệu</Toggle>
        <Toggle on={opts.beat} onClick={() => setOpts({ beat: !opts.beat })}>Beat</Toggle>
        <Toggle on={opts.click} onClick={() => setOpts({ click: !opts.click })}>Tiếng đếm</Toggle>
        <Toggle on={opts.countIn} onClick={() => setOpts({ countIn: !opts.countIn })}>Đếm vào</Toggle>
        {onToggleLoop && (
          <Toggle on={!!opts.loop} onClick={onToggleLoop}>
            <Icon name="loop" size={15} /> {opts.loop ? `Lặp: ${loopLabel ?? 'đoạn'}` : 'Lặp đoạn'}
          </Toggle>
        )}
        {extra}
      </div>
      {tuner && <BeatTuner />}
    </div>
  );
}

/** Nút nghe thử gọn cho bài học / kết quả AI */
export function MiniPlay({ p, label = 'Nghe thử' }: { p: PlayerState; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost mini-play" onClick={p.toggle}>
      <Icon name={p.playing ? 'stop' : 'play'} size={16} /> {p.playing ? 'Dừng' : label}
    </button>
  );
}
