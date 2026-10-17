import { PALETTES, PaletteId, ThemeMode } from '../lib/themes';

const MODES: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'Theo máy' },
  { value: 'light', label: 'Sáng' },
  { value: 'dark', label: 'Tối' },
];

/** Một nửa ô xem trước: dùng đúng màu thật của bảng (CSS dựng từ lib/themes.ts) */
function Half({ id, mode }: { id: PaletteId; mode: 'light' | 'dark' }) {
  return (
    <span className="tc-half" data-palette={id} data-mode={mode}>
      <span className="tc-line" />
      <span className="tc-notes">
        <span className="tc-blow">4</span>
        <span className="tc-draw">−4</span>
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
  return (
    <div className="theme-picker">
      <div className="segmented" role="radiogroup" aria-label="Sáng hay tối">
        {MODES.map((m) => (
          <button key={m.value} type="button" role="radio" aria-checked={mode === m.value} className={mode === m.value ? 'on' : ''} onClick={() => onMode(m.value)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="theme-grid" role="radiogroup" aria-label="Bảng màu">
        {PALETTES.map((p) => (
          <button key={p.id} type="button" role="radio" aria-checked={palette === p.id} className={`theme-card${palette === p.id ? ' on' : ''}`} onClick={() => onPalette(p.id)}>
            <span className="tc-preview" aria-hidden="true">
              <Half id={p.id} mode="light" />
              <Half id={p.id} mode="dark" />
            </span>
            <span className="tc-text">
              <span className="tc-name">{p.name}</span>
              <span className="tc-hint">{p.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
