// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { MoreMenu } from './MoreMenu';

afterEach(cleanup);

function Harness({ onShare, onDelete }: { onShare: () => void; onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <MoreMenu label="Thêm việc" items={[
      { icon: 'share', label: 'Chia sẻ bài', onSelect: onShare },
      { icon: 'trash', label: confirm ? 'Bấm lần nữa để xoá' : 'Xoá bài', danger: true, keepOpen: !confirm,
        onSelect: () => { if (confirm) onDelete(); else setConfirm(true); } },
    ]} />
  );
}

describe('menu "⋯"', () => {
  it('mở / đóng, chọn xong thì đóng; xoá phải bấm hai lần', () => {
    const onShare = vi.fn(), onDelete = vi.fn();
    render(<Harness onShare={onShare} onDelete={onDelete} />);
    const btn = screen.getByRole('button', { name: 'Thêm việc' });
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Chia sẻ bài' }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();

    fireEvent.click(btn);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Xoá bài' }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Bấm lần nữa để xoá' }));
    expect(onDelete).toHaveBeenCalledOnce();

    fireEvent.click(btn);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
