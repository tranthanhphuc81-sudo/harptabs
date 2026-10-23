import { HarpType, holeCount, isChromatic, isTremolo, midiToName, NoteNameStyle, tremoloDir } from '../lib/harp';
import { joinToken, splitToken } from '../lib/tabEdit';
import type { FlatEvent } from '../lib/tabText';
import { Icon } from './Icon';

interface Props {
  /** nốt đang chọn (null: chưa chọn nốt nào) */
  note: FlatEvent | null;
  harpType: HarpType;
  nameStyle: NoteNameStyle;
  playing: boolean;
  /** sửa token (null = nghỉ) */
  onToken: (token: string | null) => void;
  onBeats: (beats: number) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onStep: (dir: -1 | 1) => void;
  /** chọn nốt đang vang (khi vừa nghe thấy nốt sai) */
  onPickPlaying: () => void;
  onHear: () => void;
  onClose: () => void;
}

const BEAT_CHOICES: { v: number; label: string }[] = [
  { v: 0.25, label: '¼' }, { v: 0.5, label: '½' }, { v: 1, label: '1' }, { v: 1.5, label: '1½' }, { v: 2, label: '2' }, { v: 3, label: '3' }, { v: 4, label: '4' },
];

/** Bảng sửa một nốt ngay khi đang nghe: nhạc vẫn chạy, chạm nốt trên tab rồi đổi lỗ / độ dài tại chỗ */
export function NoteEditor({ note, harpType, nameStyle, playing, onToken, onBeats, onRemove, onDuplicate, onStep, onPickPlaying, onHear, onClose }: Props) {
  const trem = isTremolo(harpType);
  const chrom = isChromatic(harpType);
  const holes = Array.from({ length: holeCount(harpType) }, (_, i) => i + 1);
  const cur = splitToken(note?.token ?? null);
  const isRest = !!note && note.token === null;

  const setHole = (h: number, draw: boolean) => onToken(joinToken({ draw: trem ? tremoloDir(h) === 'draw' : draw, hole: h, bend: 0 }));
  const withMod = (mod: Partial<{ bend: number; over: boolean; slide: boolean }>) => {
    if (cur.hole == null) return;
    onToken(joinToken({ draw: cur.draw, hole: cur.hole, bend: cur.bend, over: cur.over, slide: cur.slide, ...mod }));
  };

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
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Tắt chế độ sửa nốt"><Icon name="check" size={18} /></button>
        </span>
      </div>

      {playing && <button type="button" className="btn btn-ghost btn-sm" onClick={onPickPlaying}>Chọn nốt đang phát</button>}

      {note && (
        <>
          <div className="keypad ne-keys" role="toolbar" aria-label="Chọn lỗ">
            {trem ? holes.map((h) => {
              const d = tremoloDir(h) === 'draw';
              return <button type="button" key={h} className={`${d ? 'draw' : 'blow'}${cur.hole === h ? ' on' : ''}`} onClick={() => setHole(h, d)} aria-label={`Lỗ ${h} ${d ? 'hút' : 'thổi'}`}>{d ? `−${h}` : h}</button>;
            }) : <>
              {holes.map((h) => <button type="button" key={h} className={`blow${!isRest && !cur.draw && cur.hole === h ? ' on' : ''}`} onClick={() => setHole(h, false)} aria-label={`Thổi lỗ ${h}`}>{h}</button>)}
              {holes.map((h) => <button type="button" key={-h} className={`draw${!isRest && cur.draw && cur.hole === h ? ' on' : ''}`} onClick={() => setHole(h, true)} aria-label={`Hút lỗ ${h}`}>−{h}</button>)}
            </>}
          </div>
          <div className="ne-row">
            {!trem && (chrom
              ? <button type="button" className={`chip${cur.slide ? ' on' : ''}`} aria-pressed={cur.slide} disabled={cur.hole == null} onClick={() => withMod({ slide: !cur.slide })}>Bấm gạt &lt;</button>
              : <>
                <button type="button" className={`chip${cur.bend === 0 && !cur.over ? ' on' : ''}`} disabled={cur.hole == null} onClick={() => withMod({ bend: 0, over: false })}>Thường</button>
                <button type="button" className={`chip${cur.bend === 1 ? ' on' : ''}`} disabled={cur.hole == null} onClick={() => withMod({ bend: 1, over: false })}>Bend ′</button>
                <button type="button" className={`chip${cur.bend === 2 ? ' on' : ''}`} disabled={cur.hole == null} onClick={() => withMod({ bend: 2, over: false })}>Bend ″</button>
                <button type="button" className={`chip${cur.over ? ' on' : ''}`} disabled={cur.hole == null} onClick={() => withMod({ bend: 0, over: true })}>Overblow</button>
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
            <button type="button" className="btn btn-ghost btn-sm" onClick={onHear} disabled={note.midi == null}>Nghe nốt này</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDuplicate}>Thêm nốt giống sau nó</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>Xoá nốt</button>
          </div>
        </>
      )}
    </div>
  );
}
