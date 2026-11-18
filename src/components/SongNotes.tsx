/**
 * Ghi chú của bài, nằm trên phần tab: thu còn một dòng để tab hiện lên sớm, chạm để đọc hết.
 * Ghi chú ngắn vừa một dòng thì không có nút mở. Khi in luôn in đủ.
 */
import { useLayoutEffect, useRef, useState } from 'react';

export function SongNotes({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => { if (!open) setLong(el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1); };
    check();
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, open]);

  return (
    <div className={`song-notes${open ? ' open' : ''}${long ? ' long' : ''}`}>
      <span ref={ref} className="sn-text">{text}</span>
      {(long || open) && (
        <button type="button" className="sn-more link-btn no-print" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? 'Thu gọn' : 'Xem thêm'}
        </button>
      )}
    </div>
  );
}
