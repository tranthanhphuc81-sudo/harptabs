import { HarpType, harpLayout, isRecorder, midiToName, NoteNameStyle, recorderKey } from '../lib/harp';
import { previewNote } from '../audio/engine';

/**
 * Hình thế bấm sáo dọc: ngón cái (lỗ sau, lệch trái) rồi 7 lỗ trước từ trên xuống — 3 lỗ tay trái, khoảng hở, 4 lỗ tay phải.
 * fingers: 8 ký tự x (kín) / o (mở) / h (nửa).
 */
export function FingeringIcon({ fingers, size = 'm' }: { fingers: string; size?: 's' | 'm' | 'l' }) {
  const r = size === 's' ? 3.2 : size === 'l' ? 6 : 4.5;
  const gap = r * 2.6;
  const w = r * 6;
  const h = gap * 8 + r * 2.5;
  const y = (i: number) => r * 1.4 + gap * i + (i >= 4 ? gap * 0.5 : 0);
  const hole = (i: number, cx: number, cy: number) => {
    const s = fingers[i] ?? 'o';
    return (
      <g key={i}>
        <circle cx={cx} cy={cy} r={r} className="fg-ring" />
        {s === 'x' && <circle cx={cx} cy={cy} r={r * 0.78} className="fg-fill" />}
        {s === 'h' && <path d={`M ${cx} ${cy - r * 0.78} A ${r * 0.78} ${r * 0.78} 0 0 0 ${cx} ${cy + r * 0.78} Z`} className="fg-fill" />}
      </g>
    );
  };
  return (
    <svg className={`fingering size-${size}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {hole(0, r * 1.3, y(0))}
      {[1, 2, 3, 4, 5, 6, 7].map((i) => hole(i, w - r * 2.2, y(i)))}
    </svg>
  );
}

/** thế bấm của một nốt (token tên nốt) trên sáo `type`, hoặc null */
export function fingeringOf(token: string | null | undefined, type: HarpType): string | null {
  if (!token || !isRecorder(type)) return null;
  return harpLayout(recorderKey(type), type).find((n) => n.token === token)?.fingers ?? null;
}

/** Bảng thế bấm cả tầm sáo: chạm để nghe, tô sáng các nốt `highlight` */
export function RecorderChart({ harpType, highlight = [], nameStyle = 'letter', interactive = true }: { harpType: HarpType; highlight?: string[]; nameStyle?: NoteNameStyle; interactive?: boolean }) {
  const layout = harpLayout(recorderKey(harpType), harpType);
  const written = (midi: number) => (harpType === 'recorderSoprano' ? midi - 12 : midi);
  return (
    <div className="recorder-chart" role="list" aria-label="Bảng thế bấm sáo">
      {layout.map((n) => (
        <button key={n.token} type="button" role="listitem" className={`rc-note${highlight.includes(n.token) ? ' on' : ''} rc-${n.technique}`}
          onClick={interactive ? () => previewNote(n.midi) : undefined} tabIndex={interactive ? 0 : -1}
          aria-label={`${midiToName(written(n.midi), nameStyle)}${n.technique === 'fingered' ? '' : `, ${n.technique === 'halfHole' ? 'bịt nửa lỗ' : n.technique === 'crossFingered' ? 'thế chéo' : 'quãng cao'}`}`}>
          <FingeringIcon fingers={n.fingers!} size="s" />
          <span className="rc-name">{midiToName(written(n.midi), nameStyle)}</span>
        </button>
      ))}
    </div>
  );
}
