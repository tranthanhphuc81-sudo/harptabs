import { useEffect, useRef, useState } from 'react';

/** Dán bài lời + hợp âm để đặt hợp âm lên bài đã có giai điệu (app khớp theo lời) */
export function SheetApplyDialog({ onApply, onClose }: { onApply: (text: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState('');
  useEffect(() => { ref.current?.showModal?.(); }, []);
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} aria-labelledby="sheet-apply-title">
      <h2 id="sheet-apply-title">Dán hợp âm cho bài này</h2>
      <p className="small muted">
        Dán lời kèm hợp âm (kiểu <code>[Am]Em ơi Hà [F]Nội phố</code> hoặc dòng hợp âm nằm trên dòng lời).
        App khớp từng chữ với lời của tab rồi đặt hợp âm vào đúng chỗ, thay cho hợp âm tự đoán. Lời trong tab cần có sẵn.
      </p>
      <textarea rows={10} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-label="Lời + hợp âm" />
      <div className="row gap end">
        <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Huỷ</button>
        <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={() => { onApply(text); ref.current?.close(); }}>Đặt hợp âm</button>
      </div>
    </dialog>
  );
}
