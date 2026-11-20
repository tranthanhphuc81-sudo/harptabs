import { useEffect } from 'react';
import { APP, BRAND, TAB_SAMPLE } from '../appConfig';
import { useScrollHint } from './useScrollHint';
import { APP_PALETTE, PALETTES, PaletteId, ThemeMode } from '../lib/themes';
import { t } from '../lib/i18n';

// bảng màu riêng của nhạc cụ này đứng đầu
const ORDERED = [...PALETTES].sort((a, b) => Number(b.id === APP_PALETTE[APP]) - Number(a.id === APP_PALETTE[APP]));

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: t('Theo máy') },
  { value: 'light', label: t('Sáng') },
  { value: 'dark', label: t('Tối') },
];

/** Một nửa ô xem trước: dùng đúng màu thật của bảng (CSS dựng từ lib/themes.ts) */
function Half({ id, mode }: { id: PaletteId; mode: 'light' | 'dark' }) {
  return (
    <span className="tc-half" data-palette={id} data-mode={mode}>
      <span className="tc-line" />
      <span className="tc-notes">
        <span className="tc-blow">{TAB_SAMPLE[0]}</span>
        <span className="tc-draw">{TAB_SAMPLE[1]}</span>
      </span>
      <span className="tc-play" />
    </span>
  );
}

/** Chọn bảng màu + sáng / tối / theo máy */
export function ThemePicker({ palette, mode, onPalette, onMode }: {
  palette: PaletteId;
  mode: ThemeMode;
  onPalette: (p: PaletteId) => void;
  onMode: (m: ThemeMode) => void;
}) {
  // điện thoại: bảng màu là dải cuộn ngang — mở trang thì cuộn tới bảng đang dùng
  const gridRef = useScrollHint<HTMLDivElement>();
  useEffect(() => {
    const g = gridRef.current, on = g?.querySelector<HTMLElement>('.theme-card.on');
    if (g && on && g.scrollWidth > g.clientWidth) g.scrollLeft = Math.max(0, on.offsetLeft - g.offsetLeft - 12);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="theme-picker">
      <div className="segmented" role="radiogroup" aria-label={t('Sáng hay tối')}>
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} className={mode === m.value ? 'on' : ''} onClick={() => onMode(m.value)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="theme-grid scroll-row" ref={gridRef} role="radiogroup" aria-label={t('Bảng màu')}>
        {ORDERED.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={palette === p.id} className={`theme-card${palette === p.id ? ' on' : ''}`} onClick={() => onPalette(p.id)}>
            <span className="tc-preview" aria-hidden="true">
              <Half id={p.id} mode="light" />
              <Half id={p.id} mode="dark" />
            </span>
            <span className="tc-text">
              <span className="tc-name">{p.name}{p.id === APP_PALETTE[APP] && <span className="tc-default"> {t('· hợp {0}', BRAND.noun)}</span>}</span>
              <span className="tc-hint">{p.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
