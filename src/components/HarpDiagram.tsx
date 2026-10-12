import { HarpKey, HarpNote, harpLayout, midiToName, NoteNameStyle } from '../lib/harp';
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

interface Props {
  harpKey: HarpKey;
  highlight?: string[];
  nameStyle?: NoteNameStyle;
  showAdvanced?: boolean;
  interactive?: boolean;
}

export function HarpDiagram({ harpKey, highlight = [], nameStyle = 'letter', showAdvanced = true, interactive = true }: Props) {
  const layout = harpLayout(harpKey);
  const rows = ROWS.filter((r) => showAdvanced || !['ob', 'od'].includes(r.id));
  return (
    <div className="harp-diagram" role="group" aria-label={`Sơ đồ nốt kèn ${harpKey}`}>
      <div className="hd-grid" style={{ gridTemplateColumns: `minmax(0, auto) repeat(10, minmax(0, 1fr))` }}>
        {rows.map((r) => (
          <div key={r.id} className={`hd-row hd-${r.id}`} style={{ display: 'contents' }}>
            <div className="hd-label">{r.label}</div>
            {Array.from({ length: 10 }, (_, i) => {
              const hole = i + 1;
              if (r.id === 'hole') return <div key={hole} className="hd-hole">{hole}</div>;
              const n = layout.find((x) => x.hole === hole && r.pick(x));
              if (!n) return <div key={hole} className="hd-empty" />;
              const on = highlight.includes(n.token);
              return (
                <button
                  key={hole}
                  type="button"
                  className={`hd-cell ${n.dir}${n.bend || n.over ? ' adv' : ''}${on ? ' on' : ''}`}
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
