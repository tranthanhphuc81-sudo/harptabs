import { ReactNode } from 'react';
import { STYLE_OPTIONS, BeatStyle } from '../audio/patterns';
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

export function PlayerBar({ p, loopLabel, onToggleLoop, extra }: Props) {
  const { opts, setOpts } = p;
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
        <label className="pb-style">
          <span className="sr-only">Kiểu beat</span>
          <select value={opts.style} onChange={(e) => setOpts({ style: e.target.value as BeatStyle })}>
            {STYLE_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
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
