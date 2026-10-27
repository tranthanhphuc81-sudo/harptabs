import { useEffect, useState } from 'react';
import { fingeringKey, HarpKey, HarpType, harpLayout, holeCount, isChromatic, isFingered, isTremolo, midiToName, NoteNameStyle, tremoloDir } from '../lib/harp';
import { TokenText } from './TabView';
import { joinToken, splitToken } from '../lib/tabEdit';
import type { FlatEvent } from '../lib/tabText';
import { Icon } from './Icon';

interface Props {
  /** nốt đang chọn (null: chưa chọn nốt nào) */
  note: FlatEvent | null;
  harpType: HarpType;
  /** tông (sáo trúc: tông sáo) */
  harpKey?: HarpKey;
  nameStyle: NoteNameStyle;
  playing: boolean;
  /** sửa token (null = nghỉ) */
  onToken: (token: string | null) => void;
  onBeats: (beats: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onStep: (dir: -1 | 1) => void;
  canUndo: boolean;
  onUndo: () => void;
  /** chọn nốt đang vang (khi vừa nghe thấy nốt sai) */
  onPickPlaying: () => void;
  /** nghe thử một nốt (token) trước khi thay / chèn */
  onHearToken: (token: string) => void;
  /** chèn nốt mới ngay sau nốt đang chọn */
  onInsert: (token: string) => void;
  onClose: () => void;
}

const BEAT_CHOICES: { v: number; label: string }[] = [
  { v: 0.25, label: '¼' }, { v: 0.5, label: '½' }, { v: 1, label: '1' }, { v: 1.5, label: '1½' }, { v: 2, label: '2' }, { v: 3, label: '3' }, { v: 4, label: '4' },
];

/** Bảng sửa một nốt ngay khi đang nghe: nhạc vẫn chạy, chạm nốt trên tab rồi đổi lỗ / độ dài tại chỗ */
export function NoteEditor({ note, harpType, harpKey = 'C', nameStyle, playing, onToken, onBeats, onRemove, onDuplicate, onStep, canUndo, onUndo, onPickPlaying, onHearToken, onInsert, onClose }: Props) {
  const trem = isTremolo(harpType);
  const chrom = isChromatic(harpType);
  // sáo dọc: chọn theo tên nốt (mỗi nốt một thế bấm), không có thổi / hút / bend
  const rec = isFingered(harpType);
  const recNotes = rec ? harpLayout(fingeringKey(harpType, harpKey), harpType) : [];
  const pick = (t: string) => { setPend(t); onHearToken(t); };
  const holes = Array.from({ length: holeCount(harpType) }, (_, i) => i + 1);
  const cur = splitToken(note?.token ?? null);
  const isRest = !!note && note.token === null;

  // chạm lỗ chỉ chọn + nghe thử; bấm "Thay nốt này" hay "Chèn sau" mới ghi vào tab
  const [pend, setPend] = useState<string | null>(null);
  useEffect(() => { setPend(null); }, [note?.sectionIndex, note?.lineIndex, note?.eventIndex]);
  const pendPos = pend ? splitToken(pend) : null;
  const setHole = (h: number, draw: boolean) => {
    const t = joinToken({ draw: trem ? tremoloDir(h) === 'draw' : draw, hole: h, bend: 0 });
    setPend(t);
    onHearToken(t);
  };
  const withMod = (mod: Partial<{ bend: number; over: boolean; slide: boolean }>) => {
    // đang chọn nốt mới thì đổi nốt đó (và phát lại); chưa thì đổi thẳng nốt đang chọn trên tab
    const base = pendPos ?? cur;
    if (base.hole == null) return;
    const t = joinToken({ draw: base.draw, hole: base.hole, bend: base.bend, over: base.over, slide: base.slide, ...mod });
    if (pend) { setPend(t); onHearToken(t); } else onToken(t);
  };
  const shown = pendPos ?? cur;

  return (
    <div className="note-editor" role="group" aria-label="Sửa nốt đang chọn">
      <div className="ne-head">
        <strong>Sửa nốt</strong>
        {note ? (
          <span className="ne-cur">
            {isRest ? 'nghỉ' : <>{note.token}{note.midi != null && <span className="muted"> ({midiToName(note.midi, nameStyle)})</span>}</>}
            {note.lyric ? <span className="muted"> · “{note.lyric}”</span> : null}
          </span>
        ) : <span className="muted">Chạm vào nốt sai trên tab</span>}
        <span className="ne-nav">
          <button type="button" className="icon-btn" onClick={() => onStep(-1)} disabled={!note} aria-label="Nốt trước">‹</button>
          <button type="button" className="icon-btn" onClick={() => onStep(1)} disabled={!note} aria-label="Nốt sau">›</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onUndo} disabled={!canUndo} aria-label="Hoàn tác lần sửa trước">↶ Hoàn tác</button>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tắt chế độ sửa nốt"><Icon name="check" size={18} /></button>
        </span>
      </div>

      {playing && <button type="button" className="btn btn-ghost btn-sm" onClick={onPickPlaying}>Chọn nốt đang phát</button>}

      {note && (
        <>
          <div className={`keypad ne-keys${rec ? ' recorder' : ''}`} role="toolbar" aria-label={rec ? 'Chọn nốt' : 'Chọn lỗ'}>
            {rec ? recNotes.map((n) => (
              <button type="button" key={n.token} className={`blow${(pend ?? note.token) === n.token ? ' on' : ''}`} onClick={() => pick(n.token)} aria-label={`Nốt ${n.token}`}><TokenText token={n.token} nameStyle={nameStyle} /></button>
            )) : trem ? holes.map((h) => {
              const d = tremoloDir(h) === 'draw';
              return <button type="button" key={h} className={`${d ? 'draw' : 'blow'}${shown.hole === h ? ' on' : ''}`} onClick={() => setHole(h, d)} aria-label={`Lỗ ${h} ${d ? 'hút' : 'thổi'}`}>{d ? `−${h}` : h}</button>;
            }) : <>
              {holes.map((h) => <button type="button" key={h} className={`blow${(pend || !isRest) && !shown.draw && shown.hole === h ? ' on' : ''}`} onClick={() => setHole(h, false)} aria-label={`Thổi lỗ ${h}`}>{h}</button>)}
              {holes.map((h) => <button type="button" key={-h} className={`draw${(pend || !isRest) && shown.draw && shown.hole === h ? ' on' : ''}`} onClick={() => setHole(h, true)} aria-label={`Hút lỗ ${h}`}>−{h}</button>)}
            </>}
          </div>
          {pend && (
            <div className="ne-row ne-pend">
              <strong>Chọn: {pend}</strong>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { onToken(pend); setPend(null); }}>Thay nốt này</button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { onInsert(pend); setPend(null); }}>Chèn sau nốt này</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onHearToken(pend)}>Nghe lại</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPend(null)}>Bỏ</button>
            </div>
          )}
          <div className="ne-row">
            {!trem && !rec && (chrom
              ? <button type="button" className={`chip${shown.slide ? ' on' : ''}`} aria-pressed={shown.slide} disabled={shown.hole == null} onClick={() => withMod({ slide: !shown.slide })}>Bấm gạt &lt;</button>
              : <>
                <button type="button" className={`chip${shown.bend === 0 && !shown.over ? ' on' : ''}`} disabled={shown.hole == null} onClick={() => withMod({ bend: 0, over: false })}>Thường</button>
                <button type="button" className={`chip${shown.bend === 1 ? ' on' : ''}`} disabled={shown.hole == null} onClick={() => withMod({ bend: 1, over: false })}>Bend ′</button>
                <button type="button" className={`chip${shown.bend === 2 ? ' on' : ''}`} disabled={shown.hole == null} onClick={() => withMod({ bend: 2, over: false })}>Bend ″</button>
                <button type="button" className={`chip${shown.over ? ' on' : ''}`} disabled={shown.hole == null} onClick={() => withMod({ bend: 0, over: true })}>Overblow</button>
              </>)}
            <button type="button" className={`chip${isRest ? ' on' : ''}`} aria-pressed={isRest} onClick={() => onToken(null)}>Nghỉ</button>
          </div>
          <div className="ne-row">
            <span className="field-label">Dài</span>
            {BEAT_CHOICES.map((b) => (
              <button type="button" key={b.v} className={`chip${Math.abs(note.beats - b.v) < 1e-6 ? ' on' : ''}`} onClick={() => onBeats(b.v)}>{b.label}</button>
            ))}
          </div>
          <div className="ne-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDuplicate}>Thêm nốt giống sau nó</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>Xoá nốt</button>
          </div>
        </>
      )}
    </div>
  );
}
