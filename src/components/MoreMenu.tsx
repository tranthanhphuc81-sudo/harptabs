/**
 * Nút "⋯" mở danh sách việc ít dùng (chia sẻ, in, xuất file, xoá…) để đầu trang gọn.
 * Đóng khi chọn xong, chạm ra ngoài hoặc bấm Esc.
 */
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export interface MoreItem {
  icon: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  /** giữ menu mở sau khi bấm (vd. bước xác nhận xoá) */
  keepOpen?: boolean;
}

export function MoreMenu({ items, label = 'Thêm', footer }: { items: MoreItem[]; label?: string; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, [open]);

  return (
    <div className="more-menu" ref={ref}>
      <button type="button" className={`icon-btn${open ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={open} aria-label={label} onClick={() => setOpen((v) => !v)}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="mm-list" role="menu">
          {items.map((it) => (
            <button key={it.label} type="button" role="menuitem" className={`mm-item${it.danger ? ' danger' : ''}`}
              onClick={() => { it.onSelect(); if (!it.keepOpen) setOpen(false); }}>
              <Icon name={it.icon} size={18} /> {it.label}
            </button>
          ))}
          {footer}
        </div>
      )}
    </div>
  );
}
