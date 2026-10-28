import { HarpKey, HarpNote, HarpType, harpLayout, harpName, holeCount, isChromatic, isFingered, isFretted, isKalimba, isTremolo, midiToName, NoteNameStyle } from '../lib/harp';
import { KalimbaChart, RecorderChart } from './Fingering';
import { FretboardChart } from './Fretboard';
import { previewNote } from '../audio/engine';

interface Row { id: string; label: string; pick: (n: HarpNote) => boolean }

const ROWS: Row[] = [
  { id: 'ob', label: 'Overblow', pick: (n) => n.technique === 'overblow' },
  { id: 'bb2', label: 'Thổi bend 1 cung', pick: (n) => n.technique === 'blowBend' && n.bend === 2 },
  { id: 'bb1', label: 'Thổi bend ½ cung', pick: (n) => n.technique === 'blowBend' && n.bend === 1 },
  { id: 'blow', label: 'Thổi', pick: (n) => n.technique === 'blow' },
  { id: 'hole', label: 'Lỗ', pick: () => false },
  { id: 'draw', label: 'Hút', pick: (n) => n.technique === 'draw' },
  { id: 'db1', label: 'Hút bend ½ cung', pick: (n) => n.technique === 'drawBend' && n.bend === 1 },
  { id: 'db2', label: 'Hút bend 1 cung', pick: (n) => n.technique === 'drawBend' && n.bend === 2 },
  { id: 'db3', label: 'Hút bend 1½ cung', pick: (n) => n.technique === 'drawBend' && n.bend === 3 },
  { id: 'od', label: 'Overdraw', pick: (n) => n.technique === 'overdraw' },
];

const CHROM_ROWS: Row[] = [
  { id: 'bs', label: 'Thổi + gạt', pick: (n) => n.technique === 'blowSlide' },
  { id: 'blow', label: 'Thổi', pick: (n) => n.technique === 'blow' },
  { id: 'hole', label: 'Lỗ', pick: () => false },
  { id: 'draw', label: 'Hút', pick: (n) => n.technique === 'draw' },
  { id: 'ds', label: 'Hút + gạt', pick: (n) => n.technique === 'drawSlide' },
];

interface Props {
  harpKey: HarpKey;
  harpType?: HarpType;
  highlight?: string[];
  nameStyle?: NoteNameStyle;
  showAdvanced?: boolean;
  interactive?: boolean;
}

/** Tremolo: mỗi cột là một cặp lỗ — thổi (lỗ lẻ) ở trên, hút (lỗ chẵn) ở dưới, như sách tremolo hay in */
function TremoloDiagram({ harpKey, harpType, highlight, nameStyle, interactive }: Required<Omit<Props, 'showAdvanced'>>) {
  const layout = harpLayout(harpKey, harpType);
  const pairs = Math.ceil(holeCount(harpType) / 2);
  const cell = (hole: number) => {
    const n = layout.find((x) => x.hole === hole);
    if (!n) return <div key={hole} className="hd-empty" />;
    return (
      <button key={hole} type="button" className={`hd-cell ${n.dir}${highlight.includes(n.token) ? ' on' : ''}`}
        onClick={interactive ? () => previewNote(n.midi) : undefined}
        title={`Lỗ ${hole} ${n.dir === 'blow' ? 'thổi' : 'hút'} = ${midiToName(n.midi, nameStyle)}`}
        aria-label={`Lỗ ${hole} ${n.dir === 'blow' ? 'thổi' : 'hút'}, nốt ${midiToName(n.midi, nameStyle)}`}>
        {midiToName(n.midi, nameStyle, false)}
      </button>
    );
  };
  const cols = Array.from({ length: pairs }, (_, i) => i);
  return (
    <div className="harp-diagram tremolo" role="group" aria-label={`Sơ đồ nốt ${harpName(harpKey, harpType).replace(/^Kèn/, 'kèn')}`}
      style={{ ['--holes' as string]: pairs }}>
      <div className="hd-grid" style={{ gridTemplateColumns: `minmax(0, auto) repeat(${pairs}, minmax(0, 1fr))` }}>
        <div className="hd-label">Thổi</div>
        {cols.map((i) => cell(2 * i + 1))}
        <div className="hd-label">Lỗ</div>
        {cols.map((i) => <div key={i} className="hd-hole">{2 * i + 1}<span className="hd-pair">·{2 * i + 2}</span></div>)}
        <div className="hd-label">Hút</div>
        {cols.map((i) => cell(2 * i + 2))}
      </div>
    </div>
  );
}

export function HarpDiagram({ harpKey, harpType = 'diatonic', highlight = [], nameStyle = 'letter', showAdvanced = true, interactive = true }: Props) {
  if (isFretted(harpType)) return <FretboardChart harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isKalimba(harpType)) return <KalimbaChart harpKey={harpKey} harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isFingered(harpType)) return <RecorderChart harpType={harpType} harpKey={harpKey} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isTremolo(harpType)) return <TremoloDiagram harpKey={harpKey} harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  const layout = harpLayout(harpKey, harpType);
  const chrom = isChromatic(harpType);
  const holes = holeCount(harpType);
  const rows = chrom
    ? CHROM_ROWS.filter((r) => showAdvanced || !['bs', 'ds'].includes(r.id))
    : ROWS.filter((r) => showAdvanced || !['ob', 'od'].includes(r.id));
  return (
    <div className={`harp-diagram${chrom ? ' chromatic' : ''}`} role="group" aria-label={`Sơ đồ nốt ${harpName(harpKey, harpType).replace(/^Kèn/, 'kèn')}`}
      style={{ ['--holes' as string]: holes }}>
      <div className="hd-grid" style={{ gridTemplateColumns: `minmax(0, auto) repeat(${holes}, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.id} className={`hd-row hd-${r.id}`} style={{ display: 'contents' }}>
            <div className="hd-label">{r.label}</div>
            {Array.from({ length: holes }, (_, i) => {
              const hole = i + 1;
              if (r.id === 'hole') return <div key={hole} className="hd-hole">{hole}</div>;
              const n = layout.find((x) => x.hole === hole && r.pick(x));
              if (!n) return <div key={hole} className="hd-empty" />;
              const on = highlight.includes(n.token);
              return (
                <button
                  key={hole}
                  type="button"
                  className={`hd-cell ${n.dir}${n.bend || n.over || n.slide ? ' adv' : ''}${on ? ' on' : ''}`}
                  onClick={interactive ? () => previewNote(n.midi) : undefined}
                  title={`${n.token} = ${midiToName(n.midi, nameStyle)}`}
                  aria-label={`${n.token}, nốt ${midiToName(n.midi, nameStyle)}`}
                >
                  {midiToName(n.midi, nameStyle, false)}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
