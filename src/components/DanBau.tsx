import { previewNote } from '../audio/engine';
import { BAU_NODES, BAU_OPEN } from '../data/danbau';
import { HarpKey, keyOffset, midiToName, NoteNameStyle } from '../lib/harp';

/**
 * Đàn bầu: dây đàn nằm ngang, cần đàn bên trái, ngựa đàn bên phải. Điểm bồi 1/n nằm cách ngựa 1/n chiều dài dây,
 * nên các điểm dồn dần về phía ngựa. Hình dưới mỗi nốt: vạch các điểm bồi, điểm cần chạm tô màu,
 * mũi tên lên / xuống khi phải nắn cần.
 */

/** ký hiệu điểm bồi: ½ ⅓ ¼ ⅕ ⅙ ⅐ ⅛; dây buông: ○ */
export const BAU_GLYPH: Record<number, string> = { 1: '○', 2: '½', 3: '⅓', 4: '¼', 5: '⅕', 6: '⅙', 7: '⅐', 8: '⅛' };

export function BauIcon({ n, bend, size = 'm' }: { n: number; bend: number; size?: 's' | 'm' | 'l' }) {
  const W = size === 's' ? 46 : size === 'l' ? 140 : 70;
  const H = size === 's' ? 14 : size === 'l' ? 40 : 20;
  const left = W * 0.06, right = W * 0.94;
  const L = right - left;
  // điểm 1/k tính từ ngựa (bên phải)
  const xOf = (k: number) => right - L / k;
  const y = H * 0.55;
  return (
    <svg className={`bau-icon size-${size}`} width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect x={left - W * 0.04} y={y - H * 0.35} width={W * 0.04} height={H * 0.7} className="bi-rod" />
      <rect x={right} y={y - H * 0.25} width={W * 0.03} height={H * 0.5} className="bi-rod" />
      <line x1={left} x2={right} y1={y} y2={y} className="bi-str" />
      {BAU_NODES.filter((x) => x.n > 1).map(({ n: k }) => <line key={k} x1={xOf(k)} x2={xOf(k)} y1={y - H * 0.18} y2={y + H * 0.18} className="bi-node" />)}
      {n > 1
        ? <circle cx={xOf(n)} cy={y} r={H * 0.2} className="bi-on" />
        : <rect x={right - L * 0.08} y={y - H * 0.2} width={L * 0.06} height={H * 0.4} className="bi-on" />}
      {bend !== 0 && (
        <g className="bi-bend">
          <path d={bend > 0 ? `M ${left + W * 0.04} ${H * 0.04} l ${W * 0.05} ${H * 0.3} h ${-W * 0.1} Z` : `M ${left + W * 0.04} ${H * 0.96} l ${W * 0.05} ${-H * 0.3} h ${-W * 0.1} Z`} />
          <text x={left + W * 0.11} y={bend > 0 ? H * 0.32 : H * 0.98} fontSize={H * 0.36}>{Math.abs(bend)}</text>
        </g>
      )}
    </svg>
  );
}

/**
 * sơ đồ đàn bầu: các điểm bồi xếp đều theo thứ tự (điểm thật dồn sát ngựa đàn, khó bấm trên màn hình nhỏ —
 * vị trí thật xem ở hình nhỏ dưới mỗi nốt); chạm để nghe (hoặc chọn nốt khi có onPick)
 */
export function BauChart({ harpKey = 'C', highlight = [], selected, nameStyle = 'letter', interactive = true, onPick }: {
  harpKey?: HarpKey; highlight?: string[]; selected?: string | null; nameStyle?: NoteNameStyle; interactive?: boolean; onPick?: (token: string) => void;
}) {
  const open = BAU_OPEN + keyOffset(harpKey);
  const nodeOf = (t: string | null | undefined) => Number(/^b(\d)/.exec(t ?? '')?.[1] ?? 0);
  const hi = new Set(highlight.map(nodeOf));
  return (
    <div className="bau-chart" role="group" aria-label="Sơ đồ đàn bầu">
      <div className="bc-string" aria-hidden="true" />
      <div className="bc-nodes">
        {BAU_NODES.map(({ n, semis }) => {
          const t = `b${n}`;
          return (
            <button key={n} type="button" tabIndex={interactive ? 0 : -1}
              className={`bc-node${hi.has(n) ? ' on' : ''}${nodeOf(selected) === n ? ' sel' : ''}`}
              onClick={interactive ? () => (onPick ? onPick(t) : previewNote(open + semis)) : undefined}
              aria-label={`${n === 1 ? 'Dây buông' : `Bồi 1/${n}`}: ${midiToName(open + semis, nameStyle)}`}>
              <span className="bc-frac">{BAU_GLYPH[n]}</span>
              <span className="bc-name">{midiToName(open + semis, nameStyle, false)}</span>
            </button>
          );
        })}
      </div>
      <p className="small muted bc-hint">Cần đàn bên trái, ngựa đàn bên phải. Chạm nhẹ cạnh bàn tay vào điểm bồi rồi gảy; ↑ / ↓ là nắn cần cho nốt cao / thấp đi mấy nửa cung.</p>
    </div>
  );
}
