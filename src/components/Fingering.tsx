import { fingeringKey, HarpKey, HarpType, harpLayout, isFingered, midiToName, NoteNameStyle } from '../lib/harp';
import { previewNote } from '../audio/engine';
import { KALIMBA_KEYS, parseKalimbaFingers } from '../data/kalimba';
import { parseFretFingers } from '../data/guitar';
import { FretIcon } from './Fretboard';
import { PianoIcon } from './Keyboard';
import { TranhIcon } from './Tranh';
import { BauIcon } from './DanBau';
import { parseBauFingers } from '../data/danbau';
import { parseTranhFingers } from '../data/tranh';
import { TokenText } from './TabView';

/**
 * Hình thế bấm: sáo dọc 8 lỗ = ngón cái (lỗ sau, lệch trái) rồi 7 lỗ trước — 3 lỗ tay trái, khoảng hở, 4 lỗ tay phải;
 * sáo trúc 6 lỗ = 3 lỗ tay trái, khoảng hở, 3 lỗ tay phải. fingers: x (kín) / o (mở) / h (nửa).
 */
export function FingeringIcon({ fingers, size = 'm' }: { fingers: string; size?: 's' | 'm' | 'l' }) {
  const k = parseKalimbaFingers(fingers);
  if (k) return <KalimbaIcon pos={k.pos} keys={k.keys} size={size} />;
  if (/^p\d+$/.test(fingers)) return <PianoIcon midi={Number(fingers.slice(1))} size={size} />;
  if (fingers.length === 12) return <OcarinaIcon fingers={fingers} size={size} />;
  const bau = parseBauFingers(fingers);
  if (bau) return <BauIcon n={bau.n} bend={bau.bend} size={size} />;
  const tr = parseTranhFingers(fingers);
  if (tr) return <TranhIcon count={tr.count} string={tr.string} press={tr.press} size={size} />;
  const g = parseFretFingers(fingers);
  if (g) return <FretIcon strings={g.strings} string={g.string} fret={g.fret} size={size} />;
  const r = size === 's' ? 3.2 : size === 'l' ? 6 : 4.5;
  const gap = r * 2.6;
  const six = fingers.length === 6;
  const w = six ? r * 3 : r * 6;
  const rows = six ? 6 : 8;
  const h = gap * rows + r * 2.5;
  // nhóm tay trái 3 lỗ, tay phải phần còn lại; 8 lỗ có thêm ngón cái ở hàng đầu
  const y = (i: number) => r * 1.4 + gap * i + (six ? (i >= 3 ? gap * 0.5 : 0) : (i >= 4 ? gap * 0.5 : 0));
  const hole = (i: number, cx: number, cy: number) => {
    const st = fingers[i] ?? 'o';
    return (
      <g key={i}>
        <circle cx={cx} cy={cy} r={r} className="fg-ring" />
        {st === 'x' && <circle cx={cx} cy={cy} r={r * 0.78} className="fg-fill" />}
        {st === 'h' && <path d={`M ${cx} ${cy - r * 0.78} A ${r * 0.78} ${r * 0.78} 0 0 0 ${cx} ${cy + r * 0.78} Z`} className="fg-fill" />}
      </g>
    );
  };
  return (
    <svg className={`fingering size-${size}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {six
        ? [0, 1, 2, 3, 4, 5].map((i) => hole(i, w / 2, y(i)))
        : <>{hole(0, r * 1.3, y(0))}{[1, 2, 3, 4, 5, 6, 7].map((i) => hole(i, w - r * 2.2, y(i)))}</>}
    </svg>
  );
}

/**
 * Ocarina 12 lỗ (sơ đồ): hàng trên 4 lỗ tay trái (trỏ → út), hàng dưới 4 lỗ tay phải, lỗ phụ nhỏ dưới ngón giữa mỗi tay,
 * hai lỗ ngón cái (mặt sau) vẽ hình vuông ở đáy: trái, phải. fingers: Lt Rt Li Lm Lr Lp Ri Rm Rr Rp Ls Rs.
 */
export function OcarinaIcon({ fingers, size = 'm' }: { fingers: string; size?: 's' | 'm' | 'l' }) {
  const r = size === 's' ? 2.6 : size === 'l' ? 6 : 3.8;
  const gap = r * 2.7;
  const w = gap * 4 + r * 2;
  const h = r * 13;
  const cx = (i: number) => r * 2 + gap * i;
  const st = (i: number) => fingers[i] ?? 'o';
  const hole = (i: number, x: number, y: number, rr = r, square = false) => (
    <g key={i}>
      {square ? <rect x={x - rr} y={y - rr} width={rr * 2} height={rr * 2} rx={rr * 0.3} className="fg-ring" /> : <circle cx={x} cy={y} r={rr} className="fg-ring" />}
      {st(i) === 'x' && (square ? <rect x={x - rr * 0.75} y={y - rr * 0.75} width={rr * 1.5} height={rr * 1.5} rx={rr * 0.2} className="fg-fill" /> : <circle cx={x} cy={y} r={rr * 0.78} className="fg-fill" />)}
      {st(i) === 'h' && <path d={`M ${x} ${y - rr * 0.78} A ${rr * 0.78} ${rr * 0.78} 0 0 0 ${x} ${y + rr * 0.78} Z`} className="fg-fill" />}
    </g>
  );
  return (
    <svg className={`fingering ocarina size-${size}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <rect x={0.5} y={0.5} width={w - 1} height={h * 0.74} rx={r * 3} className="oc-body" />
      {[2, 3, 4, 5].map((i, k) => hole(i, cx(k) - r * 0.4, r * 2.3))}
      {hole(10, cx(1) - r * 0.4, r * 4.6, r * 0.6)}
      {[6, 7, 8, 9].map((i, k) => hole(i, cx(k) + r * 0.4, r * 6.9))}
      {hole(11, cx(1) + r * 0.4, r * 9.0, r * 0.6)}
      {hole(0, cx(0), h - r * 1.4, r * 0.8, true)}
      {hole(1, cx(3), h - r * 1.4, r * 0.8, true)}
    </svg>
  );
}

/** Kalimba thu nhỏ: 17 (hoặc 8, 10) phím, phím giữa dài nhất, tô phím cần gảy */
export function KalimbaIcon({ pos, keys = KALIMBA_KEYS, size = 'm' }: { pos: number; keys?: number; size?: 's' | 'm' | 'l' }) {
  const n = keys;
  const bw = size === 's' ? 2.4 : size === 'l' ? 6 : 3.6;
  const gap = bw * 0.45;
  const H = size === 's' ? 26 : size === 'l' ? 90 : 44;
  const w = n * bw + (n - 1) * gap;
  const center = Math.floor(n / 2);
  return (
    <svg className={`kalimba-icon size-${size}`} width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => {
        const len = H * (1 - Math.abs(i - center) * 0.045);
        return <rect key={i} x={i * (bw + gap)} y={0} width={bw} height={len} rx={bw / 2} className={i === pos ? 'ki-on' : 'ki-off'} />;
      })}
    </svg>
  );
}

/** Sơ đồ kalimba: phím đúng thứ tự trên đàn, ghi số tab, chạm để nghe, tô sáng các nốt `highlight` */
export function KalimbaChart({ harpKey = 'C', harpType = 'kalimba17', highlight = [], nameStyle = 'letter', interactive = true }: { harpKey?: HarpKey; harpType?: HarpType; highlight?: string[]; nameStyle?: NoteNameStyle; interactive?: boolean }) {
  const layout = [...harpLayout(harpKey, harpType)].sort((a, b) => a.hole - b.hole);
  const center = Math.floor(layout.length / 2);
  return (
    <div className="kalimba-chart" role="list" aria-label="Sơ đồ kalimba">
      {layout.map((n) => (
        <button key={n.token} type="button" role="listitem" className={`kc-tine${highlight.includes(n.token) ? ' on' : ''}`}
          style={{ height: `${100 - Math.abs(n.hole - 1 - center) * 4.5}%` }}
          onClick={interactive ? () => previewNote(n.midi) : undefined} tabIndex={interactive ? 0 : -1}
          aria-label={`${n.token} — ${midiToName(n.midi, nameStyle)}`}>
          <span className="kc-num"><TokenText token={n.token} /></span>
          <span className="kc-name">{midiToName(n.midi, nameStyle, false)}</span>
        </button>
      ))}
    </div>
  );
}

/** thế bấm của một nốt (token tên nốt) trên sáo `type` (sáo trúc cần tông), hoặc null */
export function fingeringOf(token: string | null | undefined, type: HarpType, key: HarpKey = 'C'): string | null {
  if (!token || !isFingered(type)) return null;
  return harpLayout(fingeringKey(type, key), type).find((n) => n.token === token)?.fingers ?? null;
}

/** Bảng thế bấm cả tầm sáo: chạm để nghe, tô sáng các nốt `highlight` */
export function RecorderChart({ harpType, harpKey = 'C', highlight = [], nameStyle = 'letter', interactive = true }: { harpType: HarpType; harpKey?: HarpKey; highlight?: string[]; nameStyle?: NoteNameStyle; interactive?: boolean }) {
  const layout = harpLayout(fingeringKey(harpType, harpKey), harpType);
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
