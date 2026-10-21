import { ReactNode, useEffect, useState } from 'react';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
import type { InstrumentSuggestion, StyleSuggestion } from '../audio/suggest';
import { ACCOMP_OPTIONS, INSTRUMENT_GROUPS, INSTRUMENT_OPTIONS, Instrument, previewNote } from '../audio/engine';
import { effectivePrefs, setAutoPrefs, TEMPO_RANGES, KIT_OPTIONS, resetBeatPrefs, setBeatPrefs, SWING_OPTIONS, useBeatPrefs } from '../audio/beatPrefs';
import { Icon } from './Icon';
import { PlayerState } from './usePlayer';

interface Props {
  p: PlayerState;
  loopLabel?: string | null;
  onToggleLoop?: () => void;
  extra?: ReactNode;
  /** kiểu nhịp app tự chọn cho bài (hiện lựa chọn "Tự chọn theo bài") */
  autoStyle?: StyleSuggestion | null;
  /** mở bài đã áp sẵn kiểu nhịp tự chọn */
  autoApplied?: boolean;
  /** nhạc cụ app tự chọn cho bài (dùng khi đang "Tự động tối ưu") */
  autoInstrument?: InstrumentSuggestion | null;
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
const PERC_OPEN_KEY = 'harptabs.percOpen';

/** Gợi ý tốc độ khi tempo đang phát lệch xa tốc độ thường gặp của kiểu nhịp (không sửa bài) */
function TempoHint({ style, bpm, tempoScale, auto, label, onSet }: { style: BeatStyle; bpm: number; tempoScale: number; auto: boolean; label: string; onSet: (scale: number) => void }) {
  const range = TEMPO_RANGES[style];
  const now = Math.round(bpm * tempoScale);
  if (!auto || !range || (now >= range[0] && now <= range[1])) return null;
  const target = now < range[0] ? range[0] : range[1];
  const scale = Math.min(1.6, Math.max(0.4, Math.round((target / bpm) * 100) / 100));
  const reach = Math.round(bpm * scale);
  return (
    <p className="pb-auto">
      {label} thường {range[0]}–{range[1]} bpm, bài đang {now}.{' '}
      {reach !== now && <button type="button" className="link-btn" onClick={() => onSet(scale)}>Phát ở {reach} bpm</button>}
    </p>
  );
}

function BeatTuner({ style, styleName, autoInstrument, sing }: { style: BeatStyle; styleName: string; autoInstrument?: InstrumentSuggestion | null; sing: boolean }) {
  const raw = useBeatPrefs();
  // giá trị thực đang dùng cho kiểu nhịp này (khi tự động)
  const b = effectivePrefs(raw, style, autoInstrument?.instrument ?? null);
  const instAuto = raw.auto && !raw.manual.includes('instrument') && autoInstrument;
  // nhớ mục "Bộ gõ" đang mở hay đóng (chỉ là tiện lợi trên máy này)
  const [percOpen, setPercOpen] = useState(() => {
    try { return localStorage.getItem(PERC_OPEN_KEY) === '1'; } catch { return false; }
  });
  const rememberPercOpen = (open: boolean) => {
    setPercOpen(open);
    try { localStorage.setItem(PERC_OPEN_KEY, open ? '1' : '0'); } catch { /* bỏ qua */ }
  };
  return (
    <div className="beat-tuner" role="group" aria-label="Tuỳ chỉnh âm thanh">
      <div className="bt-row bt-auto">
        <Toggle on={raw.auto} onClick={() => setAutoPrefs(!raw.auto)}>✨ Tự động tối ưu</Toggle>
        <span className="small muted">
          {!raw.auto ? 'Đang tắt: dùng cài đặt cố định cho mọi kiểu nhịp.'
            : raw.manual.length ? <>Tự chỉnh theo {styleName}, giữ {raw.manual.length} mục bạn chỉnh tay. <button type="button" className="link-btn" onClick={() => setAutoPrefs(true)}>Về tự động</button></>
            : <>Nhạc cụ, bộ trống, độ lắc, bo, âm lượng đang tự chỉnh theo bài và {styleName}.</>}
        </span>
      </div>
      <label className="bt-row">
        <span className="bt-label">Nhạc cụ</span>
        <select className="chip-select" value={b.instrument} onChange={(e) => {
          setBeatPrefs({ instrument: e.target.value as Instrument });
          previewNote(67, 0.5);
        }}>
          {INSTRUMENT_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.items.map((v) => <option key={v} value={v}>{INSTRUMENT_OPTIONS.find((o) => o.value === v)?.label ?? v}</option>)}
            </optgroup>
          ))}
        </select>
        {instAuto && <span className="small muted">✨ {instAuto.reason}</span>}
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
        <Toggle on={b.bass} onClick={() => setBeatPrefs({ bass: !b.bass })}>Bass</Toggle>
        <Toggle on={b.comp} onClick={() => setBeatPrefs({ comp: !b.comp })}>Đệm hợp âm</Toggle>
        <Toggle on={b.humanize} onClick={() => setBeatPrefs({ humanize: !b.humanize })}>Đánh như người thật</Toggle>
        <Toggle on={b.fills} onClick={() => setBeatPrefs({ fills: !b.fills })}>Dồn trống cuối câu</Toggle>
      </div>
      <Slider label="Âm lượng beat" value={b.beatVol} onChange={(v) => setBeatPrefs({ beatVol: v })} />
      {b.bass && <Slider label="Âm lượng bass" value={b.bassVol} onChange={(v) => setBeatPrefs({ bassVol: v })} />}
      {b.comp && <Slider label="Âm lượng đệm hợp âm" value={b.compVol} onChange={(v) => setBeatPrefs({ compVol: v })} />}
      {sing && b.accomp !== 'band'
        ? <Slider label="Âm lượng đệm hát" value={b.singVol} onChange={(v) => setBeatPrefs({ singVol: v })} />
        : <Slider label="Âm lượng giai điệu" value={b.melodyVol} onChange={(v) => setBeatPrefs({ melodyVol: v })} />}
      <Slider label="Độ vang" value={b.reverb} onChange={(v) => setBeatPrefs({ reverb: v })} />
      <details className="bt-group" open={percOpen} onToggle={(e) => rememberPercOpen((e.target as HTMLDetailsElement).open)}>
        <summary>Bộ gõ <span className="muted">bo, lắc, cowbell, clap{b.bo ? ' · đang gõ bo' : ''}</span></summary>
        <div className="bt-group-body">
          <div className="bt-seg">
            <Toggle on={b.bo} onClick={() => setBeatPrefs(b.bo ? { bo: false, boSlide: false, boRoll: false } : { bo: true })}>Gõ bo</Toggle>
            {/* vuốt / rung cần có lớp bo: bật kèm gõ bo */}
            <Toggle on={b.boSlide} onClick={() => setBeatPrefs(b.boSlide ? { boSlide: false } : { boSlide: true, bo: true })}>Vuốt bo</Toggle>
            <Toggle on={b.boRoll} onClick={() => setBeatPrefs(b.boRoll ? { boRoll: false } : { boRoll: true, bo: true })}>Rung bo</Toggle>
            <Toggle on={b.lac} onClick={() => setBeatPrefs({ lac: !b.lac })}>Lắc</Toggle>
          </div>
          {(b.boSlide || b.boRoll || b.lac) && (
            <p className="small muted">
              {[b.boSlide && 'Vuốt bo: luyến mặt da ở ô thứ hai mỗi cặp ô', b.boRoll && 'Rung bo: vê dồn ở phách cuối mỗi câu', b.lac && 'Lắc: maracas đều từng phách'].filter(Boolean).join(' · ')}
            </p>
          )}
          <Slider label="Âm lượng bo" value={b.boVol} onChange={(v) => setBeatPrefs({ boVol: v })} />
          <Slider label="Âm lượng cowbell" value={b.bellVol} onChange={(v) => setBeatPrefs({ bellVol: v })} />
          <Slider label="Âm lượng clap" value={b.clapVol} onChange={(v) => setBeatPrefs({ clapVol: v })} />
        </div>
      </details>
      <button type="button" className="btn btn-ghost bt-reset" onClick={resetBeatPrefs}>Về mặc định</button>
    </div>
  );
}

export function PlayerBar({ p, loopLabel, onToggleLoop, extra, autoStyle, autoApplied = false, autoInstrument }: Props) {
  const { opts, setOpts } = p;
  const [tuner, setTuner] = useState(false);
  const [autoPicked, setAutoPicked] = useState(autoApplied);
  useEffect(() => { setAutoPicked(autoApplied); }, [autoApplied]);
  const styleLabel = (v: BeatStyle) => STYLE_OPTIONS.find((s) => s.value === v)?.label ?? v;
  const prefs = useBeatPrefs();
  const eff = Math.round(opts.bpm * opts.tempoScale);
  const step = (d: number) => setOpts({ tempoScale: Math.min(1.6, Math.max(0.4, Math.round((opts.tempoScale + d) * 100) / 100)) });
  return (
    <div className={`playerbar${tuner ? ' tuning' : ''}`} role="region" aria-label="Điều khiển phát">
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
        {p.countIn == null && p.chord && (opts.sing || (opts.beat && (prefs.bass || prefs.comp))) && <div className={`pb-chord${opts.sing ? ' sing' : ''}`} title="Hợp âm đệm">{p.chord}</div>}
        <label className="pb-style">
          <span className="sr-only">Kiểu beat</span>
          <select value={autoPicked && autoStyle && opts.style === autoStyle.style ? '__auto' : opts.style} onChange={(e) => {
            if (e.target.value === '__auto' && autoStyle) {
              setOpts({ style: autoStyle.style, beat: true });
              setAutoPicked(true);
            } else {
              setOpts({ style: e.target.value as BeatStyle });
              setAutoPicked(false);
            }
          }}>
            {autoStyle && <option value="__auto">✨ Tự chọn theo bài ({styleLabel(autoStyle.style)})</option>}
            {STYLE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className={`icon-btn pb-tune${tuner ? ' on' : ''}`} aria-pressed={tuner} aria-label="Chỉnh âm thanh: nhạc cụ, beat, bass" title="Chỉnh âm thanh" onClick={() => setTuner(!tuner)}>
          <Icon name="sliders" size={20} />
        </button>
      </div>
      {autoPicked && autoStyle && opts.style === autoStyle.style && (
        <p className="pb-auto" role="status">✨ Tự chọn: <strong>{styleLabel(autoStyle.style)}</strong> — {autoStyle.reason}</p>
      )}
      <TempoHint style={opts.style} bpm={opts.bpm} tempoScale={opts.tempoScale} auto={prefs.auto} label={styleLabel(opts.style)}
        onSet={(scale) => setOpts({ tempoScale: scale })} />
      <div className="pb-chips">
        <Toggle on={!!opts.sing} onClick={() => setOpts({ sing: !opts.sing })}>🎤 Đệm hát</Toggle>
        <Toggle on={opts.melody && !opts.sing} onClick={() => setOpts(opts.sing ? { sing: false, melody: true } : { melody: !opts.melody })}>Giai điệu</Toggle>
        {!opts.sing && <Toggle on={opts.beat} onClick={() => setOpts({ beat: !opts.beat })}>Beat</Toggle>}
        <Toggle on={opts.click} onClick={() => setOpts({ click: !opts.click })}>Tiếng đếm</Toggle>
        <Toggle on={opts.countIn} onClick={() => setOpts({ countIn: !opts.countIn })}>Đếm vào</Toggle>
        {onToggleLoop && (
          <Toggle on={!!opts.loop} onClick={onToggleLoop}>
            <Icon name="loop" size={15} /> {opts.loop ? `Lặp: ${loopLabel ?? 'đoạn'}` : 'Lặp đoạn'}
          </Toggle>
        )}
        {extra}
      </div>
      {opts.sing && (
        <div className="pb-sing" role="group" aria-label="Nhạc cụ đệm hát">
          <span className="bt-label">Đệm bằng</span>
          <div className="pb-chips">
            {ACCOMP_OPTIONS.map((a) => <Toggle key={a.value} on={prefs.accomp === a.value} onClick={() => setBeatPrefs({ accomp: a.value })}>{a.label}</Toggle>)}
          </div>
        </div>
      )}
      {opts.sing && (prefs.accomp === 'gobo' || prefs.accomp === 'strum') && (
        <div className="pb-sing" role="group" aria-label="Kỹ thuật tay guitar">
          <span className="bt-label">Kỹ thuật</span>
          <div className="pb-chips">
            <Toggle on={prefs.gRake} onClick={() => setBeatPrefs({ gRake: !prefs.gRake })}>Vuốt dây</Toggle>
            <Toggle on={prefs.gTrem} onClick={() => setBeatPrefs({ gTrem: !prefs.gTrem })}>Rung dây</Toggle>
            <Toggle on={prefs.gShake} onClick={() => setBeatPrefs({ gShake: !prefs.gShake })}>Lắc cổ tay</Toggle>
          </div>
        </div>
      )}
      {opts.sing && (prefs.accomp === 'gobo' || prefs.accomp === 'strum') && (prefs.gRake || prefs.gTrem || prefs.gShake) && (
        <p className="pb-auto">
          {[prefs.gRake && 'vuốt dây khi mở câu mới', prefs.gTrem && 'rung dây ở chỗ ngân cuối ô', prefs.gShake && 'lắc cổ tay "rrà" ở chỗ hết câu'].filter(Boolean).join(' · ')}
        </p>
      )}
      {opts.sing && prefs.accomp !== 'band' && p.accompNote && <p className="pb-auto" role="status">✨ Đệm theo bài: {p.accompNote}</p>}
      {tuner && <BeatTuner style={opts.style} styleName={styleLabel(opts.style)} autoInstrument={autoInstrument} sing={!!opts.sing} />}
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
