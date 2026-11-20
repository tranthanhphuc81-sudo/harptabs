import { HarpKey, HarpNote, HarpType, harpLayout, harpName, holeCount, isChromatic, isDanBau, isFingered, isFretted, isKeyboard, isTranh, isKalimba, isTremolo, isTwoRowChromatic, midiToName, NoteNameStyle } from '../lib/harp';
import { KalimbaChart, RecorderChart } from './Fingering';
import { FretboardChart } from './Fretboard';
import { PianoChart } from './Keyboard';
import { TranhChart } from './Tranh';
import { BauChart } from './DanBau';
import { previewNote } from '../audio/engine';
import { t } from '../lib/i18n';

interface Row { id: string; label: string; pick: (n: HarpNote) => boolean }

const ROWS: Row[] = [
  { id: 'ob', label: 'Overblow', pick: (n) => n.technique === 'overblow' },
  { id: 'bb2', label: t('Thổi bend 1 cung'), pick: (n) => n.technique === 'blowBend' && n.bend === 2 },
  { id: 'bb1', label: t('Thổi bend ½ cung'), pick: (n) => n.technique === 'blowBend' && n.bend === 1 },
  { id: 'blow', label: t('Thổi'), pick: (n) => n.technique === 'blow' },
  { id: 'hole', label: t('Lỗ'), pick: () => false },
  { id: 'draw', label: t('Hút'), pick: (n) => n.technique === 'draw' },
  { id: 'db1', label: t('Hút bend ½ cung'), pick: (n) => n.technique === 'drawBend' && n.bend === 1 },
  { id: 'db2', label: t('Hút bend 1 cung'), pick: (n) => n.technique === 'drawBend' && n.bend === 2 },
  { id: 'db3', label: t('Hút bend 1½ cung'), pick: (n) => n.technique === 'drawBend' && n.bend === 3 },
  { id: 'od', label: 'Overdraw', pick: (n) => n.technique === 'overdraw' },
];

const CHROM_ROWS: Row[] = [
  { id: 'bs', label: t('Thổi + gạt'), pick: (n) => n.technique === 'blowSlide' },
  { id: 'blow', label: t('Thổi'), pick: (n) => n.technique === 'blow' },
  { id: 'hole', label: t('Lỗ'), pick: () => false },
  { id: 'draw', label: t('Hút'), pick: (n) => n.technique === 'draw' },
  { id: 'ds', label: t('Hút + gạt'), pick: (n) => n.technique === 'drawSlide' },
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
        title={t('Lỗ {0} {1} = {2}', hole, n.dir === 'blow' ? t('thổi') : t('hút'), midiToName(n.midi, nameStyle))}
        aria-label={t('Lỗ {0} {1}, nốt {2}', hole, n.dir === 'blow' ? t('thổi') : t('hút'), midiToName(n.midi, nameStyle))}>
        {midiToName(n.midi, nameStyle, false)}
      </button>
    );
  };
  const cols = Array.from({ length: pairs }, (_, i) => i);
  return (
    <div className="harp-diagram tremolo" role="group" aria-label={t('Sơ đồ nốt {0}', harpName(harpKey, harpType).replace(/^Kèn/, 'kèn'))}
      style={{ ['--holes' as string]: pairs }}>
      <div className="hd-grid" style={{ gridTemplateColumns: `minmax(0, auto) repeat(${pairs}, minmax(0, 1fr))` }}>
        <div className="hd-label">{t('Thổi')}</div>
        {cols.map((i) => cell(2 * i + 1))}
        <div className="hd-label">{t('Lỗ')}</div>
        {cols.map((i) => <div key={i} className="hd-hole">{2 * i + 1}<span className="hd-pair">·{2 * i + 2}</span></div>)}
        <div className="hd-label">{t('Hút')}</div>
        {cols.map((i) => cell(2 * i + 2))}
      </div>
    </div>
  );
}

/** Tombo S-50: hàng trên (Đô#…) và hàng dưới (Đô…), mỗi ô là một lỗ — thổi hay hút tô màu theo hướng */
function TwoRowDiagram({ harpKey, harpType, highlight, nameStyle, interactive }: Required<Omit<Props, 'showAdvanced'>>) {
  const layout = harpLayout(harpKey, harpType);
  const holes = holeCount(harpType);
  const cell = (hole: number, upper: boolean) => {
    const n = layout.find((x) => x.hole === hole && x.slide === upper);
    if (!n) return <div key={hole} className="hd-empty" />;
    const what = t('Lỗ {0}{1} {2}', hole, upper ? t(' hàng trên') : '', n.dir === 'blow' ? t('thổi') : t('hút'));
    return (
      <button key={hole} type="button" className={`hd-cell ${n.dir}${highlight.includes(n.token) ? ' on' : ''}`}
        onClick={interactive ? () => previewNote(n.midi) : undefined}
        title={`${n.token} = ${midiToName(n.midi, nameStyle)}`}
        aria-label={t('{0}, nốt {1}', what, midiToName(n.midi, nameStyle))}>
        {midiToName(n.midi, nameStyle, false)}
      </button>
    );
  };
  const cols = Array.from({ length: holes }, (_, i) => i + 1);
  return (
    <div className="harp-diagram chromatic two-row" role="group" aria-label={t('Sơ đồ nốt {0}', harpName(harpKey, harpType).replace(/^Kèn/, 'kèn'))}
      style={{ ['--holes' as string]: holes }}>
      <div className="hd-grid" style={{ gridTemplateColumns: `minmax(0, auto) repeat(${holes}, minmax(0, 1fr))` }}>
        <div className="hd-label">{t('Hàng trên <')}</div>
        {cols.map((h) => cell(h, true))}
        <div className="hd-label">{t('Lỗ')}</div>
        {cols.map((h) => <div key={h} className="hd-hole">{h}</div>)}
        <div className="hd-label">{t('Hàng dưới')}</div>
        {cols.map((h) => cell(h, false))}
      </div>
    </div>
  );
}

export function HarpDiagram({ harpKey, harpType = 'diatonic', highlight = [], nameStyle = 'letter', showAdvanced = true, interactive = true }: Props) {
  if (isDanBau(harpType)) return <BauChart harpKey={harpKey} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isTranh(harpType)) return <TranhChart harpType={harpType} harpKey={harpKey} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isKeyboard(harpType)) return <PianoChart harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isFretted(harpType)) return <FretboardChart harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isKalimba(harpType)) return <KalimbaChart harpKey={harpKey} harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isFingered(harpType)) return <RecorderChart harpType={harpType} harpKey={harpKey} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isTremolo(harpType)) return <TremoloDiagram harpKey={harpKey} harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  if (isTwoRowChromatic(harpType)) return <TwoRowDiagram harpKey={harpKey} harpType={harpType} highlight={highlight} nameStyle={nameStyle} interactive={interactive} />;
  const layout = harpLayout(harpKey, harpType);
  const chrom = isChromatic(harpType);
  const holes = holeCount(harpType);
  const rows = chrom
    ? CHROM_ROWS.filter((r) => showAdvanced || !['bs', 'ds'].includes(r.id))
    : ROWS.filter((r) => showAdvanced || !['ob', 'od'].includes(r.id));
  return (
    <div className={`harp-diagram${chrom ? ' chromatic' : ''}`} role="group" aria-label={t('Sơ đồ nốt {0}', harpName(harpKey, harpType).replace(/^Kèn/, 'kèn'))}
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
                  aria-label={t('{0}, nốt {1}', n.token, midiToName(n.midi, nameStyle))}
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
