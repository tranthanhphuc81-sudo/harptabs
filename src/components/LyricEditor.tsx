import { useEffect, useMemo, useRef, useState } from 'react';
import type { HarpKey, HarpType } from '../lib/harp';
import { lyricLines, setLyrics } from '../lib/tabEdit';
import { splitLyrics } from '../lib/tabText';
import { TokenText } from './TabView';

/**
 * Sửa lời cả bài theo từng dòng tab: mỗi dòng một ô, chữ cách nhau bằng dấu cách —
 * chữ thứ mấy vào nốt thứ mấy; "Hap-py" = một từ hai âm tiết; "_" = nốt luyến (không chữ).
 */
export function LyricEditor({ body, harpKey, harpType, onSave, onClose }: {
  body: string;
  harpKey: HarpKey;
  harpType: HarpType;
  onSave: (body: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal?.(); }, []);
  const lines = useMemo(() => lyricLines(body, harpKey, harpType), [body, harpKey, harpType]);
  const [texts, setTexts] = useState(() => new Map(lines.map((l) => [`${l.sectionIndex}.${l.lineIndex}`, l.text])));
  const changed = lines.filter((l) => texts.get(`${l.sectionIndex}.${l.lineIndex}`) !== l.text);

  const save = () => {
    if (changed.length) onSave(setLyrics(body, harpKey, harpType, texts));
    ref.current?.close();
  };

  return (
    <dialog ref={ref} className="sheet lyric-editor" onClose={onClose} aria-labelledby="le-title">
      <h2 id="le-title">Sửa lời</h2>
      <p className="small muted">
        Mỗi ô là lời của một dòng tab, các chữ cách nhau bằng dấu cách: chữ thứ mấy vào nốt thứ mấy.
        Gạch nối <code>Hap-py</code> cho âm tiết cùng một từ, <code>_</code> cho nốt luyến (không có chữ).
      </p>
      <div className="le-lines">
        {lines.map((l, i) => {
          const k = `${l.sectionIndex}.${l.lineIndex}`;
          const text = texts.get(k) ?? '';
          const words = splitLyrics(text).length;
          const over = words > l.tokens.length;
          const head = l.sectionTitle && (i === 0 || lines[i - 1].sectionIndex !== l.sectionIndex);
          return (
            <div key={k} className="le-line">
              {head && <div className="le-section">{l.sectionTitle}</div>}
              <div className="le-tokens" aria-hidden="true">
                {l.tokens.map((t, j) => <span key={j} className={t.startsWith('-') ? 'draw' : 'blow'}><TokenText token={t} /></span>)}
              </div>
              <label className="le-input">
                <span className="sr-only">Lời dòng {i + 1}</span>
                <input value={text} lang="vi" placeholder="(không có lời)"
                  onChange={(e) => setTexts((m) => new Map(m).set(k, e.target.value))} />
                <span className={`small ${over ? 'danger' : 'muted'}`}>{words}/{l.tokens.length}</span>
              </label>
            </div>
          );
        })}
      </div>
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Huỷ</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={!changed.length}>Lưu lời</button>
      </div>
    </dialog>
  );
}
