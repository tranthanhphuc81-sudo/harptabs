import { memo, useEffect, useMemo, useRef } from 'react';
import { midiToName, NoteNameStyle } from '../lib/harp';
import { FlatEvent, ParsedTab } from '../lib/tabText';

interface Props {
  parsed: ParsedTab;
  flat: FlatEvent[];
  active?: number | null;
  onNoteClick?: (flatIndex: number) => void;
  showNames?: boolean;
  nameStyle?: NoteNameStyle;
  size?: 's' | 'm' | 'l';
  compact?: boolean;
}

export function TokenText({ token }: { token: string }) {
  const m = /^(-?)(\d+)('*)(o?)$/.exec(token);
  if (!m) return <>{token}</>;
  return (
    <>
      {m[1] && <span className="tok-sign">−</span>}
      {m[2]}
      {m[3] && <sup className="tok-bend">{m[3].replace(/'/g, '′')}</sup>}
      {m[4] && <sup className="tok-over">o</sup>}
    </>
  );
}

function TabViewInner({ parsed, flat, active, onNoteClick, showNames, nameStyle = 'letter', size = 'm', compact }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastLine = useRef<string>('');

  const index = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((f, i) => m.set(`${f.sectionIndex}.${f.lineIndex}.${f.eventIndex}`, i));
    return m;
  }, [flat]);

  useEffect(() => {
    if (active == null || !ref.current) return;
    const f = flat[active];
    if (!f) return;
    const lineKey = `${f.sectionIndex}.${f.lineIndex}`;
    if (lineKey === lastLine.current) return;
    lastLine.current = lineKey;
    const el = ref.current.querySelector(`[data-i="${active}"]`);
    if (el && 'scrollIntoView' in el) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      (el as HTMLElement).scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
  }, [active, flat]);

  if (!parsed.sections.length) return <p className="muted">Chưa có nốt nào.</p>;

  return (
    <div ref={ref} className={`tabview size-${size}${compact ? ' compact' : ''}`}>
      {parsed.sections.map((sec, si) => (
        <section key={si} className="tab-section">
          {sec.title && <h3 className="tab-section-title">{sec.title}</h3>}
          {sec.lines.map((line, li) =>
            line.kind === 'note' ? (
              <p key={li} className="tab-note-line">{line.text}</p>
            ) : (
              <div key={li} className="tabline">
                {line.events.map((ev, ei) => {
                  const fi = index.get(`${si}.${li}.${ei}`) ?? -1;
                  const isRest = ev.token === null;
                  const draw = !!ev.token?.startsWith('-');
                  const bad = !isRest && ev.midi === null;
                  const cls = ['nt', isRest ? 'rest' : draw ? 'draw' : 'blow', bad ? 'bad' : '', fi === active ? 'is-active' : '']
                    .filter(Boolean).join(' ');
                  const label = isRest ? `nghỉ ${ev.beats} phách` : `${draw ? 'hút' : 'thổi'} lỗ ${ev.token!.replace('-', '')}${ev.lyric ? `, ${ev.lyric}` : ''}`;
                  return (
                    <button
                      type="button"
                      key={ei}
                      data-i={fi}
                      className={cls}
                      style={{ ['--b' as string]: Math.min(ev.beats, 4) }}
                      onClick={onNoteClick ? () => onNoteClick(fi) : undefined}
                      tabIndex={onNoteClick ? 0 : -1}
                      aria-label={label}
                    >
                      {showNames && <span className="nt-name">{ev.midi !== null ? midiToName(ev.midi, nameStyle, false) : ''}</span>}
                      <span className="nt-hole">{isRest ? '–' : <TokenText token={ev.token!} />}</span>
                      <span className="nt-lyric">{ev.lyric ? ev.lyric + (ev.hyphen ? '-' : '') : ' '}</span>
                    </button>
                  );
                })}
              </div>
            ),
          )}
        </section>
      ))}
    </div>
  );
}

export const TabView = memo(TabViewInner);
