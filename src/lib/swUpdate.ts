/**
 * Trạng thái "có bản mới" của service worker. Không tự tải lại trang khi có bản mới
 * (đang sửa bài / quét nhạc dở sẽ mất), mà hiện thông báo để người dùng tự bấm cập nhật.
 */
import { useSyncExternalStore } from 'react';

let needRefresh = false;
let apply: (() => void) | null = null;
const listeners = new Set<() => void>();

/** Gọi từ main.tsx khi service worker báo có bản mới đang chờ */
export function setUpdateReady(applyUpdate: () => void) {
  needRefresh = true;
  apply = applyUpdate;
  listeners.forEach((l) => l());
}

export function applyUpdate() {
  apply?.();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const useUpdateReady = () => useSyncExternalStore(subscribe, () => needRefresh);
