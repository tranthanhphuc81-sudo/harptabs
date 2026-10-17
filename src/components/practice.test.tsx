// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PracticeResult } from './PracticeResult';
import { useWakeLock } from './useWakeLock';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('giữ màn hình sáng', () => {
  function setup() {
    const locks: { released: boolean; release: () => Promise<void> }[] = [];
    const request = vi.fn(async () => {
      const l = { released: false, release: async () => { l.released = true; } };
      locks.push(l);
      return l;
    });
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    return { locks, request };
  }
  const Probe = ({ on }: { on: boolean }) => { useWakeLock(on); return null; };

  it('xin khoá khi đang tập, nhả khi dừng, xin lại khi quay lại app', async () => {
    const { locks, request } = setup();
    const r = render(<Probe on={false} />);
    expect(request).not.toHaveBeenCalled();
    await act(async () => { r.rerender(<Probe on />); });
    expect(request).toHaveBeenCalledOnce();

    // chuyển app: trình duyệt tự nhả khoá; quay lại thì xin lại
    locks[0].released = true;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(request).toHaveBeenCalledTimes(2);

    await act(async () => { r.rerender(<Probe on={false} />); });
    expect(locks[1].released).toBe(true);
  });
});

describe('kết quả Chờ nốt', () => {
  it('hiện điểm, tỉ lệ đúng ngay, nốt hay lạc và cho tập lại từ nốt đó', () => {
    const onPick = vi.fn();
    render(
      <PracticeResult
        summary={{ score: 82, done: 20, total: 20, firstTry: 0.85, avgCents: 9, weak: [], finished: true }}
        record={{ best: 82, last: 82, at: 1, times: 3 }}
        newBest
        weak={[{ index: 4, token: '-3\'', lyric: 'grace', misses: 2 }]}
        onRetry={() => {}}
        onPick={onPick}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('82')).toBeTruthy();
    expect(screen.getByText('Hoàn thành cả bài')).toBeTruthy();
    expect(screen.getByText(/85% số nốt/)).toBeTruthy();
    expect(screen.getByText(/Điểm cao nhất mới/)).toBeTruthy();
    expect(screen.getByText(/rất chuẩn/)).toBeTruthy();
    screen.getByText(/lạc 2 lần/).closest('button')!.click();
    expect(onPick).toHaveBeenCalledWith(4);
  });
});
