import { useState } from 'react';
import { previewNote, previewChord } from '../audio/engine';
import { useAppState } from '../state';
import { chordShape, ChordInstrument, shapeMidis } from '../data/chordShapes';
import { GUITAR_FRETS, GUITAR_STRING_NAMES, GUITAR_TUNING, parseFretToken, UKULELE_FRETS, UKULELE_STRING_NAMES, UKULELE_TUNING } from '../data/guitar';
import { fretToken } from '../data/guitar';
import { HarpType, midiToName, NoteNameStyle } from '../lib/harp';

/**
 * Guitar / ukulele: hình cần đàn dưới nốt, sơ đồ cần đàn (chạm để nghe / chọn nốt), sơ đồ hợp âm.
 * Cần đàn vẽ nằm ngang như tab: dây 1 (cao nhất) ở trên, phím tăng dần sang phải.
 */

const MARKERS = [3, 5, 7, 9, 12, 15];

export function fretInfo(type: HarpType) {
  return type === 'ukulele4'
    ? { tuning: UKULELE_TUNING, frets: UKULELE_FRETS, names: UKULELE_STRING_NAMES, inst: 'ukulele' as ChordInstrument }
    : { tuning: GUITAR_TUNING, frets: GUITAR_FRETS, names: GUITAR_STRING_NAMES, inst: 'guitar' as ChordInstrument };
}

/** token "dây.phím" vẽ như một cột tab: các dây nằm ngang, số phím nằm trên dây cần đánh */
export function FretTokenText({ token, strings = 6 }: { token: string; strings?: number }) {
  const p = parseFretToken(token);
  if (!p) return <>{token}</>;
  return (
    <span className={`tok-gtr s${strings}`} aria-label={`dây ${p.string} phím ${p.fret}`}>
      {Array.from({ length: strings }, (_, i) => (
        <span key={i} className="gl">
          <i />{i + 1 === p.string && <b>{p.fret}</b>}<i />
        </span>
      ))}
    </span>
  );
}

/** hình cần đàn thu nhỏ: chấm ở dây và phím cần bấm (phím 0: vòng tròn ở đầu cần) */
export function FretIcon({ strings, string, fret, size = 'm' }: { strings: number; string: number; fret: number; size?: 's' | 'm' | 'l' }) {
  const sx = size === 's' ? 9 : size === 'l' ? 22 : 13;
  const sy = size === 's' ? 4.5 : size === 'l' ? 12 : 6.5;
  const span = 4;
  const lo = fret <= span ? 1 : fret - 2;
  const nut = lo === 1;
  const pad = sy * 0.9;
  const w = sx * (span + 0.8) + pad;
  const h = sy * (strings - 1) + pad * 2 + (nut ? 0 : sy * 1.4);
  const x0 = pad + sx * 0.6;
  const y = (s: number) => pad + sy * (s - 1);
  return (
    <svg className={`fret-icon size-${size}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {Array.from({ length: strings }, (_, i) => <line key={`s${i}`} x1={x0} x2={x0 + sx * span} y1={y(i + 1)} y2={y(i + 1)} className="fi-str" />)}
      {Array.from({ length: span + 1 }, (_, i) => <line key={`f${i}`} x1={x0 + sx * i} x2={x0 + sx * i} y1={y(1)} y2={y(strings)} className={i === 0 && nut ? 'fi-nut' : 'fi-fret'} />)}
      {fret === 0
        ? <circle cx={x0 - sx * 0.35} cy={y(string)} r={sy * 0.42} className="fi-open" />
        : <circle cx={x0 + sx * (fret - lo + 0.5)} cy={y(string)} r={sy * 0.5} className="fi-dot" />}
      {!nut && <text x={x0 + sx * 0.5} y={y(strings) + sy * 1.3} className="fi-num" fontSize={sy * 1.2} textAnchor="middle">{lo}</text>}
    </svg>
  );
}

/** sơ đồ cần đàn: mọi dây × phím, ghi tên nốt; chạm để nghe (hoặc chọn nốt nếu có onPick) */
export function FretboardChart({ harpType, highlight = [], selected, nameStyle = 'letter', interactive = true, onPick, maxFret }: {
  harpType: HarpType; highlight?: string[]; selected?: string | null; nameStyle?: NoteNameStyle; interactive?: boolean; onPick?: (token: string) => void; maxFret?: number;
}) {
  const { tuning, frets, names } = fretInfo(harpType);
  const last = Math.min(frets, maxFret ?? frets);
  return (
    <div className="fretboard-wrap">
      <div className="fretboard" role="grid" aria-label="Sơ đồ cần đàn" style={{ gridTemplateColumns: `1.6em repeat(${last + 1}, minmax(2.3em, 1fr))` }}>
        <span className="fb-corner" />
        {Array.from({ length: last + 1 }, (_, f) => <span key={`h${f}`} className={`fb-head${MARKERS.includes(f) ? ' mark' : ''}`}>{f}</span>)}
        {tuning.map((open, si) => [
          <span key={`n${si}`} className="fb-sname">{names[si]}</span>,
          ...Array.from({ length: last + 1 }, (_, f) => {
            const t = fretToken(si + 1, f);
            const on = highlight.includes(t);
            return (
              <button key={t} type="button" role="gridcell" tabIndex={interactive ? 0 : -1}
                className={`fb-cell${f === 0 ? ' open' : ''}${on ? ' on' : ''}${selected === t ? ' sel' : ''}`}
                onClick={interactive ? () => (onPick ? onPick(t) : previewNote(open + f)) : undefined}
                aria-label={`Dây ${si + 1} phím ${f}: ${midiToName(open + f, nameStyle)}`}>
                {midiToName(open + f, nameStyle, false)}
              </button>
            );
          }),
        ])}
      </div>
    </div>
  );
}

/** các ô (dây.phím) của một thế hợp âm, để tô trên cần đàn */
export function shapeTokens(shape: number[]): string[] {
  const n = shape.length;
  return shape.flatMap((f, i) => (f < 0 ? [] : [fretToken(n - i, f)]));
}

/**
 * Sơ đồ một hợp âm. Mặc định dựng đứng như sách hợp âm (dây trầm bên trái, đầu cần ở trên);
 * Cài đặt "nằm ngang" thì vẽ cùng hướng với tab (dây 1 ở trên, đầu cần bên trái). × = không gảy, ○ = dây buông.
 */
export function ChordDiagram({ name, inst, size = 'm', onPlay, selected }: { name: string; inst: ChordInstrument; size?: 's' | 'm'; onPlay?: () => void; selected?: boolean }) {
  const { settings } = useAppState();
  const horiz = !!settings.chordHorizontal;
  const shape = chordShape(name, inst);
  if (!shape) return null;
  const n = shape.length;
  // sA: khoảng cách giữa hai dây, sB: khoảng cách giữa hai phím
  const sA = size === 's' ? 9 : 13;
  const sB = size === 's' ? 11 : 15;
  const fretted = shape.filter((f) => f > 0);
  const top = fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1;
  const rows = 4;
  // tên dây buông từ dây trầm lên (dây 1 guitar viết "e" thường như trên cần đàn, khỏi lẫn với dây 6)
  const names = (inst === 'guitar' ? ['E', 'A', 'D', 'G', 'B', 'e'] : ['G', 'C', 'E', 'A']);
  // lề: phía dây (tên dây / số phím) và phía đầu cần (× ○)
  const padA = sA * 1.1;
  const padB = sB * 1.15;
  const tail = sB * 1.1; // chỗ ghi tên dây
  const posRoom = top > 1 ? sA * 1.2 : 0;
  // toạ độ theo (thứ tự dây từ trầm lên, vị trí phím tính từ đầu cần)
  const P = (i: number, r: number): [number, number] => horiz
    ? [tail + padB + sB * r, padA + sA * (n - 1 - i)]
    : [padA + sA * i, padB + sB * r];
  const w = horiz ? tail + padB + sB * rows + sB * 0.4 : padA * 2 + sA * (n - 1) + posRoom;
  const h = horiz ? padA * 2 + sA * (n - 1) + posRoom : padB + sB * rows + tail;
  const line = (a: [number, number], b: [number, number], cls: string, key: string) => <line key={key} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className={cls} />;
  // chặn: cùng một phím thấp nhất trên nhiều dây liền nhau tới dây cao nhất → thanh chặn
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const barreIdx = shape.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
  const barre = minF > 0 && barreIdx.length >= 3 && barreIdx[barreIdx.length - 1] === n - 1 && shape.slice(barreIdx[0]).every((f) => f >= minF);
  const dotR = Math.min(sA, sB) * 0.36;
  const barreRect = () => {
    const [x1, y1] = P(barreIdx[0], minF - top + 0.5);
    const [x2, y2] = P(n - 1, minF - top + 0.5);
    const t = sB * 0.56;
    return <rect x={Math.min(x1, x2) - (horiz ? t / 2 : sA * 0.35)} y={Math.min(y1, y2) - (horiz ? sA * 0.35 : t / 2)}
      width={horiz ? t : Math.abs(x2 - x1) + sA * 0.7} height={horiz ? Math.abs(y2 - y1) + sA * 0.7 : t} rx={t / 2} className="cd-dot" />;
  };
  const posLabel = top > 1 && (() => {
    const [x, y] = horiz ? P(-0.9, 0.5) : P(n - 1 + 0.6, 0.5);
    return <text x={x} y={y + sB * 0.28} className="cd-pos" fontSize={sB * 0.75} textAnchor={horiz ? 'middle' : 'start'}>{top}</text>;
  })();
  const body = (
    <svg className={`chord-diagram size-${size}${horiz ? ' horiz' : ''}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => line(P(i, 0), P(i, rows), 'cd-str', `s${i}`))}
      {Array.from({ length: rows + 1 }, (_, r) => line(P(0, r), P(n - 1, r), r === 0 && top === 1 ? 'cd-nut' : 'cd-fret', `f${r}`))}
      {posLabel}
      {barre && barreRect()}
      {shape.map((f, i) => {
        if (f < 0) { const [x, y] = P(i, -0.5); return <text key={i} x={x} y={y + sB * 0.25} className="cd-mark" fontSize={sB * 0.7} textAnchor="middle">×</text>; }
        if (f === 0) { const [x, y] = P(i, -0.5); return <circle key={i} cx={x} cy={y} r={sA * 0.28} className="cd-open" />; }
        if (barre && f === minF) return null;
        const [x, y] = P(i, f - top + 0.5);
        return <circle key={i} cx={x} cy={y} r={dotR} className="cd-dot" />;
      })}
      {/* tên dây buông: dưới sơ đồ (dựng đứng) hoặc bên trái (nằm ngang) */}
      {names.map((nm, i) => {
        const [x, y] = horiz ? [tail * 0.45, P(i, 0)[1]] : [P(i, 0)[0], padB + sB * rows + tail * 0.75];
        return <text key={`n${i}`} x={x} y={y + (horiz ? sB * 0.22 : 0)} className="cd-sname" fontSize={sB * 0.58} textAnchor="middle">{nm}</text>;
      })}
    </svg>
  );
  return (
    <button type="button" className={`chord-box${selected ? ' on' : ''}`} onClick={onPlay ?? (() => previewChord(shapeMidis(shape, inst)))} aria-label={`Hợp âm ${name}, chạm để nghe`} aria-pressed={selected}>
      <span className="cb-name">{name}</span>
      {body}
    </button>
  );
}

/** các hợp âm trong bài, mỗi hợp âm một sơ đồ; chạm để nghe và xem thế tay đó trên cần đàn nằm ngang (cùng hướng với tab) */
export function ChordStrip({ names, inst }: { names: string[]; inst: ChordInstrument }) {
  const { settings } = useAppState();
  const [picked, setPicked] = useState<string | null>(null);
  const uniq = [...new Set(names)].filter((n) => chordShape(n, inst));
  if (!uniq.length) return null;
  const shape = picked ? chordShape(picked, inst) : null;
  const pick = (n: string) => {
    const s = chordShape(n, inst);
    if (s) previewChord(shapeMidis(s, inst));
    setPicked((p) => (p === n ? null : n));
  };
  const maxFret = shape ? Math.max(5, ...shape) + 1 : 5;
  return (
    <>
      <div className="chord-strip" role="list" aria-label="Thế hợp âm trong bài">
        {uniq.map((n) => <ChordDiagram key={n} name={n} inst={inst} selected={picked === n} onPlay={() => pick(n)} />)}
      </div>
      {picked && shape && (
        <div className="chord-on-neck">
          <p className="small muted">Thế <strong>{picked}</strong> trên cần đàn (cùng hướng với tab: dây 1 ở trên). Ô sáng là chỗ bấm, cột 0 là dây buông.</p>
          <FretboardChart harpType={inst === 'ukulele' ? 'ukulele4' : 'guitar6'} highlight={shapeTokens(shape)} nameStyle={settings.noteNames} maxFret={maxFret} />
        </div>
      )}
    </>
  );
}
