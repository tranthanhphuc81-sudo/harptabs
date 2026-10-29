import { useEffect, useRef, useState } from 'react';
import { previewChord, previewNote } from '../audio/engine';
import { KeyboardChord, leftHandChord } from '../lib/keyboardChord';
import { HarpType, keyboardRange, midiToName, NoteNameStyle } from '../lib/harp';

/**
 * Bàn phím (pianica, organ, piano): hình bàn phím thu nhỏ dưới mỗi nốt (tô phím cần bấm) và sơ đồ bàn phím đầy đủ
 * (chạm để nghe hoặc chọn nốt). Phím trắng ghi tên nốt, Đô có số quãng tám để biết Đô nào.
 */

const isBlack = (m: number) => [1, 3, 6, 8, 10].includes(((m % 12) + 12) % 12);

function whitesBetween(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (!isBlack(m)) out.push(m);
  return out;
}

/**
 * bàn phím thu nhỏ, phím cần bấm tô màu (phím đen tô cả chấm cho dễ thấy). Pianica: cả cây đàn.
 * Organ / piano (`wide`): cả cây đàn quá dài nên chỉ vẽ 3 quãng tám Đô3–Đô6 (vùng tay phải hay chơi), nốt ngoài vùng thì dời theo quãng tám.
 */
export function PianoIcon({ midi, size = 'm', wide = false }: { midi: number; size?: 's' | 'm' | 'l'; wide?: boolean }) {
  let lo = 53;
  let hi = midi > 84 ? 89 : 84;
  if (wide) {
    lo = 48;
    while (midi < lo) lo -= 12;
    while (midi > lo + 36) lo += 12;
    hi = lo + 36;
  }
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
  const [lo, hi] = keyboardRange(harpType);
  const whites = whitesBetween(lo, hi);
  // đàn dài (organ, piano): cuộn tới phím đang tô / phím chọn, không có thì tới Đô giữa
  const wrap = useRef<HTMLDivElement>(null);
  const focus = highlight[0] ?? selected ?? 'C4';
  useEffect(() => {
    const el = wrap.current?.querySelector<HTMLElement>(`[data-note="${focus}"]`);
    if (el && wrap.current) wrap.current.scrollLeft = el.offsetLeft - wrap.current.clientWidth / 2 + el.offsetWidth / 2;
  }, [focus]);
  const key = (m: number, black: boolean) => {
    const t = midiToName(m);
    const on = highlight.includes(t);
    return (
      <button key={m} type="button" tabIndex={interactive ? 0 : -1} data-note={t}
        className={`pc-key ${black ? 'black' : 'white'}${on ? ' on' : ''}${selected === t ? ' sel' : ''}`}
        style={black ? { left: `calc(6px + ${whites.indexOf(m - 1) + 1} * var(--pc-w) - var(--pc-w) * 0.32)` } : undefined}
        onClick={interactive ? () => (onPick ? onPick(t) : previewNote(m)) : undefined}
        aria-label={`Phím ${midiToName(m, nameStyle)}`}>
        {!black && <span className="pc-name">{midiToName(m, nameStyle, m % 12 === 0)}</span>}
      </button>
    );
  };
  return (
    <div className="piano-wrap" ref={wrap}>
      <div className="piano-chart" role="group" aria-label="Bàn phím" style={{ width: `calc(${whites.length} * var(--pc-w))` }}>
        {whites.map((m) => key(m, false))}
        {Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(isBlack).map((m) => key(m, true))}
      </div>
    </div>
  );
}

/** một hợp âm tay trái vẽ trên đoạn bàn phím nhỏ: phím cần bấm tô màu, số ngón tay ghi trên phím */
export function ChordKeys({ chord, nameStyle = 'letter' }: { chord: KeyboardChord; nameStyle?: NoteNameStyle }) {
  // đoạn phím vừa màn hình điện thoại: bắt đầu ở Đô hoặc Fa ngay dưới nốt thấp nhất, kéo tới quá nốt cao nhất hai phím
  const min = Math.min(...chord.notes);
  const lo = min - (min % 12 >= 5 ? (min % 12) - 5 : min % 12);
  let hi = Math.max(lo + 16, Math.max(...chord.notes) + 2);
  while (isBlack(hi)) hi++;
  const whites = whitesBetween(lo, hi);
  const ww = 22, wh = 92;
  const xOf = (m: number) => whites.indexOf(m) * ww;
  const at = (m: number) => chord.notes.indexOf(m);
  const label = (m: number, black: boolean) => {
    const i = at(m);
    if (i < 0) return null;
    const cx = black ? xOf(m - 1) + ww : xOf(m) + ww / 2;
    return (
      <g key={`f${m}`}>
        <circle cx={cx} cy={black ? wh * 0.42 : wh * 0.72} r={8} className="ck-dot" />
        <text x={cx} y={(black ? wh * 0.42 : wh * 0.72) + 4} textAnchor="middle" className="ck-finger">{chord.fingers[i]}</text>
      </g>
    );
  };
  const blacks = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(isBlack);
  return (
    <figure className="chord-keys">
      <svg width={whites.length * ww} height={wh + 16} viewBox={`0 0 ${whites.length * ww} ${wh + 16}`} role="img"
        aria-label={`Tay trái bấm ${chord.notes.map((m) => midiToName(m, nameStyle)).join(', ')}`}>
        {whites.map((m) => <rect key={m} x={xOf(m)} y={0} width={ww - 1} height={wh} rx={3} className={at(m) >= 0 ? 'pk-on' : 'pk-white'} />)}
        {blacks.map((m) => <rect key={m} x={xOf(m - 1) + ww * 0.66} y={0} width={ww * 0.68} height={wh * 0.6} rx={2} className={at(m) >= 0 ? 'pk-on' : 'pk-black'} />)}
        {whites.map((m) => label(m, false))}
        {blacks.map((m) => label(m, true))}
        {whites.filter((m) => m % 12 === 0).map((m) => <text key={`c${m}`} x={xOf(m) + ww / 2} y={wh + 12} textAnchor="middle" className="ck-c">{midiToName(m, nameStyle)}</text>)}
      </svg>
    </figure>
  );
}

/** các hợp âm trong bài cho tay trái (organ, piano): chạm tên hợp âm để nghe và xem thế bấm trên bàn phím */
export function KeyboardChordStrip({ names, nameStyle }: { names: string[]; nameStyle?: NoteNameStyle }) {
  const uniq = [...new Set(names)].filter((n) => leftHandChord(n));
  const [picked, setPicked] = useState<string | null>(null);
  if (!uniq.length) return null;
  const cur = picked && uniq.includes(picked) ? picked : uniq[0];
  const chord = leftHandChord(cur)!;
  const pick = (n: string) => { setPicked(n); previewChord(leftHandChord(n)!.notes); };
  return (
    <section className="kb-chords" aria-label="Hợp âm tay trái">
      <div className="kb-chord-names" role="tablist">
        {uniq.map((n) => (
          <button key={n} type="button" role="tab" aria-selected={n === cur} className={`cp-chip${n === cur ? ' on' : ''}`} onClick={() => pick(n)}>{n}</button>
        ))}
      </div>
      <ChordKeys chord={chord} nameStyle={nameStyle} />
      <p className="small muted">Tay trái <strong>{cur}</strong>: {chord.notes.map((m, i) => `${midiToName(m, nameStyle)} (ngón ${chord.fingers[i]})`).join(' – ')}. Bấm ở đầu ô nhịp có hợp âm, giữ tới khi đổi hợp âm.</p>
    </section>
  );
}
