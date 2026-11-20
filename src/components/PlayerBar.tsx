import { ReactNode, useEffect, useState } from 'react';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
import type { InstrumentSuggestion, StyleSuggestion } from '../audio/suggest';
import { ACCOMP_OPTIONS, INSTRUMENT_GROUPS, INSTRUMENT_OPTIONS, Instrument, previewNote } from '../audio/engine';
import { effectivePrefs, setAutoPrefs, TEMPO_RANGES, KIT_OPTIONS, resetBeatPrefs, setBeatPrefs, SWING_OPTIONS, useBeatPrefs } from '../audio/beatPrefs';
import { Icon } from './Icon';
import { PlayerState } from './usePlayer';
import { t } from '../lib/i18n';

interface Props {
  p: PlayerState;
  /** thêm class cho thanh (vd. pin-top: dính cả mép trên khi cuộn) */
  className?: string;
  loopLabel?: string | null;
  onToggleLoop?: () => void;
  extra?: ReactNode;
  /** khung phụ nằm trên cùng thanh (ví dụ bảng sửa nốt) */
  above?: ReactNode;
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
      {label} {t('thường')} {range[0]}–{range[1]} {t('bpm, bài đang')} {now}.{' '}
      {reach !== now && <button type="button" className="link-btn" onClick={() => onSet(scale)}>{t('Phát ở {0} bpm', reach)}</button>}
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
    <div className="beat-tuner" role="group" aria-label={t('Tuỳ chỉnh âm thanh')}>
      <div className="bt-row bt-auto">
        <Toggle on={raw.auto} onClick={() => setAutoPrefs(!raw.auto)}>{t('✨ Tự động tối ưu')}</Toggle>
        <span className="small muted">
          {!raw.auto ? t('Đang tắt: dùng cài đặt cố định cho mọi kiểu nhịp.')
            : raw.manual.length ? <>{t('Tự chỉnh theo {0}, giữ {1} mục bạn chỉnh tay.', styleName, raw.manual.length)} <button type="button" className="link-btn" onClick={() => setAutoPrefs(true)}>{t('Về tự động')}</button></>
            : <>{t('Nhạc cụ, bộ trống, độ lắc, bo, âm lượng đang tự chỉnh theo bài và {0}.', styleName)}</>}
        </span>
      </div>
      <label className="bt-row">
        <span className="bt-label">{t('Nhạc cụ')}</span>
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
        <span className="bt-label">{t('Bộ trống')}</span>
        <div className="bt-seg">
          {KIT_OPTIONS.map((k) => <Toggle key={k.value} on={b.kit === k.value} onClick={() => setBeatPrefs({ kit: k.value })}>{k.label}</Toggle>)}
        </div>
      </div>
      <div className="bt-row">
        <span className="bt-label">{t('Độ lắc')}</span>
        <div className="bt-seg">
          {SWING_OPTIONS.map((s) => <Toggle key={s.value} on={Math.abs(b.swing - s.value) < 1e-3} onClick={() => setBeatPrefs({ swing: s.value })}>{s.label}</Toggle>)}
        </div>
      </div>
      <div className="bt-row bt-seg">
        <Toggle on={b.bass} onClick={() => setBeatPrefs({ bass: !b.bass })}>Bass</Toggle>
        <Toggle on={b.comp} onClick={() => setBeatPrefs({ comp: !b.comp })}>{t('Đệm hợp âm')}</Toggle>
        <Toggle on={b.humanize} onClick={() => setBeatPrefs({ humanize: !b.humanize })}>{t('Đánh như người thật')}</Toggle>
        <Toggle on={b.fills} onClick={() => setBeatPrefs({ fills: !b.fills })}>{t('Dồn trống cuối câu')}</Toggle>
      </div>
      <Slider label={t('Âm lượng beat')} value={b.beatVol} onChange={(v) => setBeatPrefs({ beatVol: v })} />
      {b.bass && <Slider label={t('Âm lượng bass')} value={b.bassVol} onChange={(v) => setBeatPrefs({ bassVol: v })} />}
      {b.comp && <Slider label={t('Âm lượng đệm hợp âm')} value={b.compVol} onChange={(v) => setBeatPrefs({ compVol: v })} />}
      {sing && b.accomp !== 'band'
        ? <Slider label={t('Âm lượng đệm hát')} value={b.singVol} onChange={(v) => setBeatPrefs({ singVol: v })} />
        : <Slider label={t('Âm lượng giai điệu')} value={b.melodyVol} onChange={(v) => setBeatPrefs({ melodyVol: v })} />}
      <Slider label={t('Độ vang')} value={b.reverb} onChange={(v) => setBeatPrefs({ reverb: v })} />
      <details className="bt-group" open={percOpen} onToggle={(e) => rememberPercOpen((e.target as HTMLDetailsElement).open)}>
        <summary>{t('Bộ gõ')} <span className="muted">{t('bo, lắc, cowbell, clap')}{b.bo ? t(' · đang gõ bo') : ''}</span></summary>
        <div className="bt-group-body">
          <div className="bt-seg">
            <Toggle on={b.bo} onClick={() => setBeatPrefs(b.bo ? { bo: false, boSlide: false, boRoll: false } : { bo: true })}>{t('Gõ bo')}</Toggle>
            {/* vuốt / rung cần có lớp bo: bật kèm gõ bo */}
            <Toggle on={b.boSlide} onClick={() => setBeatPrefs(b.boSlide ? { boSlide: false } : { boSlide: true, bo: true })}>{t('Vuốt bo')}</Toggle>
            <Toggle on={b.boRoll} onClick={() => setBeatPrefs(b.boRoll ? { boRoll: false } : { boRoll: true, bo: true })}>Rung bo</Toggle>
            <Toggle on={b.lac} onClick={() => setBeatPrefs({ lac: !b.lac })}>{t('Lắc')}</Toggle>
          </div>
          {(b.boSlide || b.boRoll || b.lac) && (
            <p className="small muted">
              {[b.boSlide && t('Vuốt bo: luyến mặt da ở ô thứ hai mỗi cặp ô'), b.boRoll && t('Rung bo: vê dồn ở phách cuối mỗi câu'), b.lac && t('Lắc: maracas đều từng phách')].filter(Boolean).join(' · ')}
            </p>
          )}
          <Slider label={t('Âm lượng bo')} value={b.boVol} onChange={(v) => setBeatPrefs({ boVol: v })} />
          <Slider label={t('Âm lượng cowbell')} value={b.bellVol} onChange={(v) => setBeatPrefs({ bellVol: v })} />
          <Slider label={t('Âm lượng clap')} value={b.clapVol} onChange={(v) => setBeatPrefs({ clapVol: v })} />
        </div>
      </details>
      <button type="button" className="btn btn-ghost bt-reset" onClick={resetBeatPrefs}>{t('Về mặc định')}</button>
    </div>
  );
}

const COLLAPSED_KEY = 'harptabs.pbCollapsed';

export function PlayerBar({ p, className, loopLabel, onToggleLoop, extra, above, autoStyle, autoApplied = false, autoInstrument }: Props) {
  const { opts, setOpts } = p;
  const [tuner, setTuner] = useState(false);
  // thu gọn: chỉ còn nút phát ở cuối màn hình, không che tab; chạm nút mở rộng để hiện đủ
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(COLLAPSED_KEY) !== '0'; } catch { return true; } });
  const toggleCollapsed = () => setCollapsed((v) => {
    try { localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1'); } catch { /* không lưu được thì thôi */ }
    return !v;
  });
  const [autoPicked, setAutoPicked] = useState(autoApplied);
  useEffect(() => { setAutoPicked(autoApplied); }, [autoApplied]);
  const styleLabel = (v: BeatStyle) => STYLE_OPTIONS.find((s) => s.value === v)?.label ?? v;
  const prefs = useBeatPrefs();
  const eff = Math.round(opts.bpm * opts.tempoScale);
  const step = (d: number) => setOpts({ tempoScale: Math.min(1.6, Math.max(0.4, Math.round((opts.tempoScale + d) * 100) / 100)) });
  if (collapsed) {
    return (
      <div className={`playerbar collapsed${above ? ' with-above' : ''}${className ? ` ${className}` : ''}`} role="region" aria-label={t('Điều khiển phát (thu gọn)')}>
        <div className="pb-main">
          <button type="button" className="pb-play" onClick={p.toggle} aria-label={p.playing ? t('Dừng') : t('Phát')}>
            <Icon name={p.playing ? 'stop' : 'play'} size={26} />
          </button>
          {p.countIn != null && <div className="pb-countin" aria-live="assertive">{p.countIn}</div>}
          {p.countIn == null && p.chord && <div className="pb-chord" title={t('Hợp âm đệm')}>{p.chord}</div>}
          <button type="button" className="icon-btn pb-expand" onClick={toggleCollapsed} aria-label={t('Hiện đủ thanh điều khiển')} aria-expanded={false} title={t('Hiện đủ: tốc độ, beat, lặp đoạn…')}>
            <Icon name="sliders" size={20} />
          </button>
        </div>
        {above}
      </div>
    );
  }
  return (
    <div className={`playerbar${tuner ? ' tuning' : ''}${className ? ` ${className}` : ''}`} role="region" aria-label={t('Điều khiển phát')}>
      <div className="pb-main">
        <button type="button" className="pb-play" onClick={p.toggle} aria-label={p.playing ? t('Dừng') : t('Phát')}>
          <Icon name={p.playing ? 'stop' : 'play'} size={26} />
        </button>
        <div className="pb-tempo" aria-label={t('Tốc độ')}>
          <button type="button" className="icon-btn" onClick={() => step(-0.05)} aria-label={t('Chậm lại')}><Icon name="minus" size={18} /></button>
          <div className="pb-tempo-val">
            <strong>{eff}</strong>
            <span>bpm ({Math.round(opts.tempoScale * 100)}%)</span>
          </div>
          <button type="button" className="icon-btn" onClick={() => step(0.05)} aria-label={t('Nhanh lên')}><Icon name="plus" size={18} /></button>
        </div>
        {p.countIn != null && <div className="pb-countin" aria-live="assertive">{p.countIn}</div>}
        {p.countIn == null && p.chord && (opts.sing || (opts.beat && (prefs.bass || prefs.comp))) && <div className={`pb-chord${opts.sing ? ' sing' : ''}`} title={t('Hợp âm đệm')}>{p.chord}</div>}
        <label className="pb-style">
          <span className="sr-only">{t('Kiểu beat')}</span>
          <select value={autoPicked && autoStyle && opts.style === autoStyle.style ? '__auto' : opts.style} onChange={(e) => {
            if (e.target.value === '__auto' && autoStyle) {
              setOpts({ style: autoStyle.style, beat: true });
              setAutoPicked(true);
            } else {
              setOpts({ style: e.target.value as BeatStyle });
              setAutoPicked(false);
            }
          }}>
            {autoStyle && <option value="__auto">{t('✨ Tự chọn theo bài ({0})', styleLabel(autoStyle.style))}</option>}
            {STYLE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <button type="button" className="icon-btn pb-collapse" onClick={toggleCollapsed} aria-label={t('Thu gọn thanh điều khiển')} aria-expanded={true} title={t('Thu gọn')}>
          <Icon name="minus" size={20} />
        </button>
        <button type="button" className={`icon-btn pb-tune${tuner ? ' on' : ''}`} aria-pressed={tuner} aria-label={t('Chỉnh âm thanh: nhạc cụ, beat, bass')} title={t('Chỉnh âm thanh')} onClick={() => setTuner(!tuner)}>
          <Icon name="sliders" size={20} />
        </button>
      </div>
      {above}
      {!above && autoPicked && autoStyle && opts.style === autoStyle.style && (
        <p className="pb-auto" role="status">{t('✨ Tự chọn:')} <strong>{styleLabel(autoStyle.style)}</strong> — {autoStyle.reason}</p>
      )}
      {!above && <TempoHint style={opts.style} bpm={opts.bpm} tempoScale={opts.tempoScale} auto={prefs.auto} label={styleLabel(opts.style)}
        onSet={(scale) => setOpts({ tempoScale: scale })} />}
      {!above && <div className="pb-chips">
        <Toggle on={!!opts.sing} onClick={() => setOpts({ sing: !opts.sing })}>{t('🎤 Đệm hát')}</Toggle>
        <Toggle on={opts.melody && !opts.sing} onClick={() => setOpts(opts.sing ? { sing: false, melody: true } : { melody: !opts.melody })}>{t('Giai điệu')}</Toggle>
        {!opts.sing && <Toggle on={opts.beat} onClick={() => setOpts({ beat: !opts.beat })}>Beat</Toggle>}
        <Toggle on={opts.click} onClick={() => setOpts({ click: !opts.click })}>{t('Tiếng đếm')}</Toggle>
        <Toggle on={opts.countIn} onClick={() => setOpts({ countIn: !opts.countIn })}>{t('Đếm vào')}</Toggle>
        {onToggleLoop && (
          <Toggle on={!!opts.loop} onClick={onToggleLoop}>
            <Icon name="loop" size={15} /> {opts.loop ? t('Lặp: {0}', loopLabel ?? t('đoạn')) : t('Lặp đoạn')}
          </Toggle>
        )}
        {extra}
      </div>}
      {!above && opts.sing && (
        <div className="pb-sing" role="group" aria-label={t('Nhạc cụ đệm hát')}>
          <span className="bt-label">{t('Đệm bằng')}</span>
          <div className="pb-chips">
            {ACCOMP_OPTIONS.map((a) => <Toggle key={a.value} on={prefs.accomp === a.value} onClick={() => setBeatPrefs({ accomp: a.value })}>{a.label}</Toggle>)}
          </div>
        </div>
      )}
      {!above && opts.sing && (prefs.accomp === 'gobo' || prefs.accomp === 'strum') && (
        <div className="pb-sing" role="group" aria-label={t('Kỹ thuật tay guitar')}>
          <span className="bt-label">{t('Kỹ thuật')}</span>
          <div className="pb-chips">
            <Toggle on={prefs.gRake} onClick={() => setBeatPrefs({ gRake: !prefs.gRake })}>{t('Vuốt dây')}</Toggle>
            <Toggle on={prefs.gTrem} onClick={() => setBeatPrefs({ gTrem: !prefs.gTrem })}>{t('Rung dây')}</Toggle>
            <Toggle on={prefs.gShake} onClick={() => setBeatPrefs({ gShake: !prefs.gShake })}>{t('Lắc cổ tay')}</Toggle>
          </div>
        </div>
      )}
      {!above && opts.sing && (prefs.accomp === 'gobo' || prefs.accomp === 'strum') && (prefs.gRake || prefs.gTrem || prefs.gShake) && (
        <p className="pb-auto">
          {[prefs.gRake && t('vuốt dây khi mở câu mới'), prefs.gTrem && t('rung dây ở chỗ ngân cuối ô'), prefs.gShake && t('lắc cổ tay "rrà" ở chỗ hết câu')].filter(Boolean).join(' · ')}
        </p>
      )}
      {!above && opts.sing && prefs.accomp !== 'band' && p.accompNote && <p className="pb-auto" role="status">{t('✨ Đệm theo bài: {0}', p.accompNote)}</p>}
      {!above && tuner && <BeatTuner style={opts.style} styleName={styleLabel(opts.style)} autoInstrument={autoInstrument} sing={!!opts.sing} />}
    </div>
  );
}

/** Nút nghe thử gọn cho bài học / kết quả AI */
export function MiniPlay({ p, label = t('Nghe thử') }: { p: PlayerState; label?: string }) {
  return (
    <button type="button" className="btn btn-ghost mini-play" onClick={p.toggle}>
      <Icon name={p.playing ? 'stop' : 'play'} size={16} /> {p.playing ? t('Dừng') : label}
    </button>
  );
}
