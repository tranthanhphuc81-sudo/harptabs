import { previewNote, previewChord } from '../audio/engine';
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

/** sơ đồ một hợp âm (khung dọc như sách hợp âm): dây trầm bên trái, x = không đánh, o = buông */
export function ChordDiagram({ name, inst, size = 'm', onPlay }: { name: string; inst: ChordInstrument; size?: 's' | 'm'; onPlay?: () => void }) {
  const shape = chordShape(name, inst);
  if (!shape) return null;
  const n = shape.length;
  const sx = size === 's' ? 9 : 13;
  const sy = size === 's' ? 11 : 15;
  const fretted = shape.filter((f) => f > 0);
  const top = fretted.length && Math.max(...fretted) > 4 ? Math.min(...fretted) : 1;
  const rows = 4;
  const padX = sx * 1.1;
  const padTop = sy * 1.1;
  const w = padX * 2 + sx * (n - 1) + (top > 1 ? sx : 0);
  const h = padTop + sy * rows + sy * 0.4;
  const x = (i: number) => padX + sx * i;
  const yRow = (r: number) => padTop + sy * r;
  // chặn: cùng một phím thấp nhất trên nhiều dây liền nhau từ dây cao → vẽ thanh chặn
  const minF = fretted.length ? Math.min(...fretted) : 0;
  const barreIdx = shape.map((f, i) => (f === minF ? i : -1)).filter((i) => i >= 0);
  const barre = minF > 0 && barreIdx.length >= 3 && barreIdx[barreIdx.length - 1] === n - 1 && shape.slice(barreIdx[0]).every((f) => f >= minF);
  const body = (
    <svg className={`chord-diagram size-${size}`} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <line key={`s${i}`} x1={x(i)} x2={x(i)} y1={yRow(0)} y2={yRow(rows)} className="cd-str" />)}
      {Array.from({ length: rows + 1 }, (_, r) => <line key={`f${r}`} x1={x(0)} x2={x(n - 1)} y1={yRow(r)} y2={yRow(r)} className={r === 0 && top === 1 ? 'cd-nut' : 'cd-fret'} />)}
      {top > 1 && <text x={x(n - 1) + sx * 0.6} y={yRow(0.5) + sy * 0.3} className="cd-pos" fontSize={sy * 0.75}>{top}</text>}
      {barre && <rect x={x(barreIdx[0]) - sx * 0.35} y={yRow(minF - top + 0.5) - sy * 0.28} width={x(n - 1) - x(barreIdx[0]) + sx * 0.7} height={sy * 0.56} rx={sy * 0.28} className="cd-dot" />}
      {shape.map((f, i) => f < 0
        ? <text key={i} x={x(i)} y={padTop - sy * 0.3} className="cd-mark" fontSize={sy * 0.7} textAnchor="middle">×</text>
        : f === 0
          ? <circle key={i} cx={x(i)} cy={padTop - sy * 0.5} r={sx * 0.28} className="cd-open" />
          : barre && f === minF ? null : <circle key={i} cx={x(i)} cy={yRow(f - top + 0.5)} r={Math.min(sx, sy) * 0.36} className="cd-dot" />)}
    </svg>
  );
  return (
    <button type="button" className="chord-box" onClick={onPlay ?? (() => previewChord(shapeMidis(shape, inst)))} aria-label={`Hợp âm ${name}, chạm để nghe`}>
      <span className="cb-name">{name}</span>
      {body}
    </button>
  );
}

/** các hợp âm trong bài, mỗi hợp âm một sơ đồ */
export function ChordStrip({ names, inst }: { names: string[]; inst: ChordInstrument }) {
  const uniq = [...new Set(names)].filter((n) => chordShape(n, inst));
  if (!uniq.length) return null;
  return (
    <div className="chord-strip" role="list" aria-label="Thế hợp âm trong bài">
      {uniq.map((n) => <ChordDiagram key={n} name={n} inst={inst} />)}
    </div>
  );
}
