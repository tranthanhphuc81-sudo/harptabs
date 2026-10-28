import { previewNote } from '../audio/engine';
import { HarpType, midiToName, NoteNameStyle, PIANICA_RANGE } from '../lib/harp';

/**
 * Kèn pianica: hình bàn phím thu nhỏ dưới mỗi nốt (cả cây đàn, tô phím cần bấm) và sơ đồ bàn phím đầy đủ
 * (chạm để nghe hoặc chọn nốt). Phím trắng ghi tên nốt, Đô có số quãng tám để biết Đô nào.
 */

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

function whitesBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) out.push(m);
  return out;
}

/** bàn phím thu nhỏ: cả cây đàn, phím cần bấm tô màu (phím đen tô cả chấm cho dễ thấy) */
export function PianoIcon({ midi, size = 'm' }: { midi: number; size?: 's' | 'm' | 'l' }) {
  const lo = 53;
  const hi = midi > 84 ? 89 : 84;
  const whites = whitesBetween(lo, hi);
  const ww = size === 's' ? 3 : size === 'l' ? 9 : 4.5;
  const wh = size === 's' ? 14 : size === 'l' ? 46 : 22;
  const w = whites.length * ww;
  const xOf = (m: number) => whites.indexOf(m) * ww;
  return (
    <svg className={`piano-icon size-${size}`} width={w} height={wh} viewBox={`0 0 ${w} ${wh}`} aria-hidden="true">
      {whites.map((m) => <rect key={m} x={xOf(m)} y={0} width={ww - 0.4} height={wh} className={m === midi ? 'pk-on' : 'pk-white'} />)}
      {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(isBlack).map((m) => (
        <rect key={m} x={xOf(m - 1) + ww * 0.62} y={0} width={ww * 0.76} height={wh * 0.6} className={m === midi ? 'pk-on' : 'pk-black'} />
      ))}
      {/* chấm dưới phím cần bấm: dễ thấy cả khi hình nhỏ */}
      <circle cx={(isBlack(midi) ? xOf(midi - 1) + ww : xOf(midi) + ww / 2)} cy={wh * (isBlack(midi) ? 0.45 : 0.82)} r={ww * 0.42} className="pk-dot" />
    </svg>
  );
}

/** sơ đồ bàn phím pianica: chạm để nghe (hoặc chọn nốt khi có onPick), tô sáng các nốt `highlight` */
export function PianoChart({ harpType, highlight = [], selected, nameStyle = 'letter', interactive = true, onPick }: {
  harpType: HarpType; highlight?: string[]; selected?: string | null; nameStyle?: NoteNameStyle; interactive?: boolean; onPick?: (token: string) => void;
}) {
  const [lo, hi] = PIANICA_RANGE[harpType === 'pianica37' ? 'pianica37' : 'pianica32'];
  const whites = whitesBetween(lo, hi);
  const key = (m: number, black: boolean) => {
    const t = midiToName(m);
    const on = highlight.includes(t);
    return (
      <button key={m} type="button" tabIndex={interactive ? 0 : -1}
        className={`pc-key ${black ? 'black' : 'white'}${on ? ' on' : ''}${selected === t ? ' sel' : ''}`}
        style={black ? { left: `calc(6px + ${whites.indexOf(m - 1) + 1} * var(--pc-w) - var(--pc-w) * 0.32)` } : undefined}
        onClick={interactive ? () => (onPick ? onPick(t) : previewNote(m)) : undefined}
        aria-label={`Phím ${midiToName(m, nameStyle)}`}>
        {!black && <span className="pc-name">{midiToName(m, nameStyle, m % 12 === 0)}</span>}
      </button>
    );
  };
  return (
    <div className="piano-wrap">
      <div className="piano-chart" role="group" aria-label="Bàn phím pianica" style={{ width: `calc(${whites.length} * var(--pc-w))` }}>
        {whites.map((m) => key(m, false))}
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(isBlack).map((m) => key(m, true))}
      </div>
    </div>
  );
}
