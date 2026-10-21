import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { midiToName, NoteNameStyle } from '../lib/harp';
import { FlatEvent, ParsedTab, TabLine } from '../lib/tabText';
import type { ChordSegment } from '../audio/harmony';

interface Props {
  parsed: ParsedTab;
  flat: FlatEvent[];
  active?: number | null;
  onNoteClick?: (flatIndex: number) => void;
  showNames?: boolean;
  nameStyle?: NoteNameStyle;
  size?: 's' | 'm' | 'l';
  compact?: boolean;
  /** hiện hợp âm đệm trên nốt; chạm vào để chọn hợp âm khác */
  chords?: ChordSegment[] | null;
  onChordClick?: (seg: ChordSegment) => void;
}

export function TokenText({ token }: { token: string }) {
  const m = /^(-?)(\d+)('*)(o?)(<?)$/.exec(token);
  if (!m) return <>{token}</>;
  return (
    <>
      {m[1] && <span className="tok-sign">−</span>}
      {m[2]}
      {m[3] && <sup className="tok-bend">{m[3].replace(/'/g, '′')}</sup>}
      {m[4] && <sup className="tok-over">o</sup>}
      {m[5] && <sup className="tok-slide">&lt;</sup>}
    </>
  );
}

interface LineProps {
  events: TabLine['events'];
  si: number;
  li: number;
  index: Map<string, number>;
  /** nốt đang sáng nếu nằm trong dòng này, không thì -1 (dòng khác giữ nguyên, không vẽ lại) */
  active: number;
  clickable: boolean;
  onNote: (fi: number) => void;
  showNames?: boolean;
  nameStyle: NoteNameStyle;
  chordsAt: Map<number, ChordSegment[]> | null;
  onChord: (seg: ChordSegment) => void;
}

const Line = memo(function Line({ events, si, li, index, active, clickable, onNote, showNames, nameStyle, chordsAt, onChord }: LineProps) {
  return (
    <div className="tabline">
      {events.map((ev, ei) => {
        const fi = index.get(`${si}.${li}.${ei}`) ?? -1;
        const isRest = ev.token === null;
        const draw = !!ev.token?.startsWith('-');
        const bad = !isRest && ev.midi === null;
        const cls = ['nt', isRest ? 'rest' : draw ? 'draw' : 'blow', bad ? 'bad' : '', fi === active ? 'is-active' : '']
          .filter(Boolean).join(' ');
        const label = isRest ? `nghỉ ${ev.beats} phách` : `${draw ? 'hút' : 'thổi'} lỗ ${ev.token!.replace('-', '').replace('<', ' bấm gạt')}${ev.lyric ? `, ${ev.lyric}` : ''}`;
        const note = (
          <button
            type="button"
            key={ei}
            data-i={fi}
            className={cls}
            style={{ ['--b' as string]: Math.min(ev.beats, 4) }}
            onClick={clickable ? () => onNote(fi) : undefined}
            tabIndex={clickable ? 0 : -1}
            aria-label={label}
          >
            {showNames && <span className="nt-name">{ev.midi !== null ? midiToName(ev.midi, nameStyle, false) : ''}</span>}
            <span className="nt-hole">{isRest ? '–' : <TokenText token={ev.token!} />}</span>
            <span className="nt-lyric">{ev.lyric ? ev.lyric + (ev.hyphen ? '-' : '') : ' '}</span>
          </button>
        );
        if (!chordsAt) return note;
        const segs = chordsAt.get(fi);
        return (
          <span key={ei} className="nt-cell">
            <span className="nt-chords">
              {segs?.map((seg) => (
                <button key={seg.start} type="button" className={`nt-chord${seg.manual ? ' manual' : ''}`}
                  onClick={() => onChord(seg)}
                  aria-label={`Hợp âm ${seg.chord.name}${seg.manual ? ' (chọn tay)' : ' (tự đoán)'}, chạm để đổi`}>
                  {seg.chord.name}
                </button>
              ))}
            </span>
            {note}
          </span>
        );
      })}
    </div>
  );
});

/** Khoảng màn hình không bị thanh điều khiển (.playerbar) và thanh menu (.nav) dính ở dưới che */
function visibleBand(): [number, number] {
  const h = window.innerHeight;
  let bottom = h;
  for (const sel of ['.playerbar', '.nav']) {
    const r = document.querySelector(sel)?.getBoundingClientRect();
    // chỉ tính khi thanh đang nằm ở nửa dưới màn hình (thanh điều khiển cuộn theo trang khi ở cuối bài)
    if (r && r.height > 0 && r.top > h * 0.35 && r.top < bottom) bottom = r.top;
  }
  return [0, bottom];
}

function TabViewInner({ parsed, flat, active, onNoteClick, showNames, nameStyle = 'letter', size = 'm', compact, chords, onChordClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const lastLine = useRef<string>('');
  // hàm bấm nốt / hợp âm giữ cố định giữa các lần vẽ (trang cha tạo hàm mới mỗi lần) để các dòng không phải vẽ lại
  const noteRef = useRef(onNoteClick);
  noteRef.current = onNoteClick;
  const chordRef = useRef(onChordClick);
  chordRef.current = onChordClick;
  const onNote = useCallback((fi: number) => noteRef.current?.(fi), []);
  const onChord = useCallback((seg: ChordSegment) => chordRef.current?.(seg), []);

  const index = useMemo(() => {
    const m = new Map<string, number>();
    flat.forEach((f, i) => m.set(`${f.sectionIndex}.${f.lineIndex}.${f.eventIndex}`, i));
    return m;
  }, [flat]);

  // khúc hợp âm gắn vào nốt đang vang ở đầu khúc
  const chordsAt = useMemo(() => {
    if (!chords) return null;
    const m = new Map<number, ChordSegment[]>();
    let i = 0;
    for (const seg of chords) {
      while (i < flat.length - 1 && flat[i].start + flat[i].beats <= seg.start + 1e-6) i++;
      const list = m.get(i) ?? [];
      list.push(seg);
      m.set(i, list);
    }
    return m;
  }, [chords, flat]);

  useEffect(() => {
    if (active == null || !ref.current) return;
    const f = flat[active];
    if (!f) return;
    const lineKey = `${f.sectionIndex}.${f.lineIndex}`;
    const lineChanged = lineKey !== lastLine.current;
    lastLine.current = lineKey;
    const el = ref.current.querySelector(`[data-i="${active}"]`);
    if (!el) return;
    // vùng nhìn thấy thật: trừ thanh điều khiển và thanh menu dính ở cuối màn hình
    const [top, bottom] = visibleBand();
    const r = el.getBoundingClientRect();
    const margin = Math.min(72, (bottom - top) / 4);
    const hidden = r.top < top + margin || r.bottom > bottom - margin;
    // sang dòng mới, hoặc nốt (dòng dài xuống hàng) trôi vào sau thanh điều khiển: đưa nốt về giữa vùng nhìn thấy
    if (!lineChanged && !hidden) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: (r.top + r.bottom) / 2 - (top + bottom) / 2, behavior: reduce ? 'auto' : 'smooth' });
  }, [active, flat]);

  if (!parsed.sections.length) return <p className="muted">Chưa có nốt nào.</p>;
  const act = active != null ? flat[active] : undefined;

  return (
    <div ref={ref} className={`tabview size-${size}${compact ? ' compact' : ''}`}>
      {parsed.sections.map((sec, si) => (
        <section key={si} className="tab-section">
          {sec.title && <h3 className="tab-section-title">{sec.title}</h3>}
          {sec.lines.map((line, li) =>
            line.kind === 'note' ? (
              <p key={li} className="tab-note-line">{line.text}</p>
            ) : (
              <Line key={li} events={line.events} si={si} li={li} index={index}
                active={act && act.sectionIndex === si && act.lineIndex === li ? active! : -1}
                clickable={!!onNoteClick} onNote={onNote} showNames={showNames} nameStyle={nameStyle}
                chordsAt={chordsAt} onChord={onChord} />
            ),
          )}
        </section>
      ))}
    </div>
  );
}

export const TabView = memo(TabViewInner);
