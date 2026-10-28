import { previewNote } from '../audio/engine';
import { getTranhTuning, harpLayout, HarpKey, HarpType, holeCount, keyOffset, midiToName, NoteNameStyle } from '../lib/harp';
import { tranhStrings } from '../data/tranh';

/**
 * Đàn tranh: hình các dây thu nhỏ dưới mỗi nốt (dây 1 trầm nhất bên trái, dây cần gảy tô màu, nhấn thì có mũi tên),
 * và sơ đồ cả cây đàn: mỗi dây một phím, ghi số dây và tên nốt, chạm để nghe (hoặc chọn nốt).
 */
export function TranhIcon({ count, string, press, size = 'm' }: { count: number; string: number; press: number; size?: 's' | 'm' | 'l' }) {
  const sw = size === 's' ? 3 : size === 'l' ? 7 : 4.4;
  const H = size === 's' ? 20 : size === 'l' ? 64 : 30;
  const top = press ? H * 0.28 : 0;
  const w = count * sw;
  return (
    <svg className={`tranh-icon size-${size}`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const on = i + 1 === string;
        // dây trầm dày hơn, dây cao mảnh dần
        const thick = Math.max(0.6, sw * (0.45 - i * 0.015));
        return <rect key={i} x={i * sw + (sw - (on ? sw * 0.8 : thick)) / 2} y={top} width={on ? sw * 0.8 : thick} height={H - top} rx={sw * 0.2} className={on ? 'tr-on' : 'tr-off'} />;
      })}
      {press > 0 && (
        <g className="tr-press">
          <path d={`M ${(string - 0.5) * sw} 0 l ${-sw * 0.9} ${top * 0.8} h ${sw * 1.8} Z`} />
          {press === 2 && <path d={`M ${(string - 0.5) * sw} ${top * 0.45} l ${-sw * 0.9} ${top * 0.8} h ${sw * 1.8} Z`} />}
        </g>
      )}
    </svg>
  );
}

/** sơ đồ đàn tranh: các dây từ trầm (trái) đến cao (phải), ô cao dần như thân đàn; tô sáng dây có trong `highlight` */
export function TranhChart({ harpType, harpKey = 'C', highlight = [], selected, nameStyle = 'letter', interactive = true, onPick }: {
  harpType: HarpType; harpKey?: HarpKey; highlight?: string[]; selected?: string | null; nameStyle?: NoteNameStyle; interactive?: boolean; onPick?: (token: string) => void;
}) {
  const n = holeCount(harpType);
  const opens = tranhStrings(n, getTranhTuning()).map((m) => m + keyOffset(harpKey));
  // nốt nhấn trong highlight cũng tô dây gốc của nó
  const hiStrings = new Set(highlight.map((t) => Number(/^(\d+)/.exec(t)?.[1] ?? 0)));
  const layout = harpLayout(harpKey, harpType);
  return (
    <div className="tranh-wrap">
      <div className="tranh-chart" role="group" aria-label="Sơ đồ đàn tranh" style={{ gridTemplateColumns: `repeat(${n}, minmax(1.9rem, 1fr))` }}>
        {opens.map((m, i) => {
          const s = i + 1;
          const t = String(s);
          return (
            <button key={s} type="button" tabIndex={interactive ? 0 : -1}
              className={`tc-string${hiStrings.has(s) ? ' on' : ''}${selected && /^(\d+)/.exec(selected)?.[1] === t ? ' sel' : ''}`}
              style={{ height: `${100 - i * (40 / n)}%` }}
              onClick={interactive ? () => (onPick ? onPick(t) : previewNote(m)) : undefined}
              aria-label={`Dây ${s}: ${midiToName(m, nameStyle)}`}>
              <span className="tc-num">{s}</span>
              <span className="tc-name">{midiToName(m, nameStyle, false)}</span>
            </button>
          );
        })}
      </div>
      {layout.length > 0 && <p className="small muted tc-hint">Dây 1 (trái) trầm nhất. Nốt không có trên dây thì nhấn: <strong>↑½</strong> nhấn nửa cung, <strong>↑1</strong> nhấn một cung.</p>}
    </div>
  );
}
