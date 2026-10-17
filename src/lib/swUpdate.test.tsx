// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UpdateNotice } from '../components/AppNotices';
import { setUpdateReady } from './swUpdate';

afterEach(cleanup);

describe('thông báo bản mới', () => {
  it('không tự tải lại: chỉ hiện nút, bấm Cập nhật mới áp dụng', () => {
    render(<UpdateNotice />);
    expect(screen.queryByText('Cập nhật')).toBeNull();
    const apply = vi.fn();
    act(() => setUpdateReady(apply));
    expect(apply).not.toHaveBeenCalled();
    act(() => screen.getByText('Cập nhật').click());
    expect(apply).toHaveBeenCalledOnce();
    act(() => screen.getByText('Để sau').click());
    expect(screen.queryByText('Cập nhật')).toBeNull();
  });
});
