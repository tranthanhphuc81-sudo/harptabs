import { useEffect, useRef } from 'react';
import { Chord, chordName, ChordSegment, diatonicChords, keyUsesFlats, NO_CHORD, Tonality } from '../audio/harmony';

interface Props {
  seg: ChordSegment;
  tonality: Tonality;
  /** nhãn vị trí, ví dụ "ô nhịp 3" */
  where: string;
  onPick: (name: string | null) => void;
  onClose: () => void;
}

/** Bảng chọn hợp âm cho một khúc; null = trả về tự đoán */
export function ChordPicker({ seg, tonality, where, onPick, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal?.(); }, []);
  const flats = keyUsesFlats(tonality);
  const inKey = diatonicChords(tonality);
  const all = (minor: boolean): Chord[] =>
    Array.from({ length: 12 }, (_, i) => ({ root: i, minor, name: chordName(i, minor, flats) }));

  const pick = (name: string | null) => { onPick(name); ref.current?.close(); };
  const chip = (c: Chord) => (
    <button key={c.name} type="button" className={`chip${seg.chord.name === c.name ? ' on' : ''}`} aria-pressed={seg.chord.name === c.name} onClick={() => pick(c.name)}>
      {c.name}
    </button>
  );

  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="chord-title">
      <h2 id="chord-title">Hợp âm {where}</h2>
      <p className="small muted">
        Đang dùng <strong>{seg.chord.name}</strong> ({seg.manual ? 'bạn chọn' : 'tự đoán'}). Bass sẽ đánh theo hợp âm bạn chọn.
      </p>
      <div className="field">
        <span className="field-label">Hay dùng trong giọng này</span>
        <div className="chord-grid">{inKey.map(chip)}</div>
      </div>
      <details>
        <summary>Tất cả hợp âm</summary>
        <div className="field">
          <span className="field-label">Trưởng</span>
          <div className="chord-grid">{all(false).map(chip)}</div>
          <span className="field-label">Thứ</span>
          <div className="chord-grid">{all(true).map(chip)}</div>
        </div>
      </details>
      <div className="row gap wrap end">
        <button type="button" className="btn btn-ghost" onClick={() => pick(NO_CHORD)}>Không đệm đoạn này</button>
        <button type="button" className="btn btn-ghost" onClick={() => pick(null)} disabled={!seg.manual}>Để máy tự đoán</button>
        <button type="button" className="btn btn-primary" onClick={() => ref.current?.close()}>Xong</button>
      </div>
    </dialog>
  );
}
