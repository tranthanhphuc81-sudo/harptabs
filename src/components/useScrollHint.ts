import { useEffect, useRef } from 'react';

/**
 * Hàng cuộn ngang (bộ lọc, tuỳ chọn hiển thị): gắn data-more="left|right|both" khi còn nội dung khuất
 * để CSS làm mờ mép đó — người dùng biết còn nút bên cạnh, kéo sang để xem.
 */
export function useScrollHint<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const left = el.scrollLeft > 2;
      const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
      const v = left && right ? 'both' : left ? 'left' : right ? 'right' : '';
      if (v) el.dataset.more = v; else delete el.dataset.more;
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    // nút trong hàng hiện / ẩn theo trạng thái (vd. Bỏ lọc) cũng làm đổi bề rộng
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(update) : null;
    mo?.observe(el, { childList: true, subtree: true });
    return () => { el.removeEventListener('scroll', update); ro?.disconnect(); mo?.disconnect(); };
  }, []);
  return ref;
}
