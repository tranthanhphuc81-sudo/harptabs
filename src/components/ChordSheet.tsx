import { memo, useMemo } from 'react';
import type { ChordSegment } from '../audio/harmony';
import type { BeatStyle } from '../audio/patterns';
import type { FlatEvent, ParsedTab } from '../lib/tabText';

/**
 * Bảng lời + hợp âm kiểu sách đệm hát: tên hợp âm đặt trên chữ đúng chỗ đổi hợp âm.
 * Dòng không có lời thì chỉ hiện chuỗi hợp âm theo khúc. Chạm chữ để phát từ đó; chữ đang hát được tô sáng.
 */

interface Item {
  fi: number;
  chord?: string;
  text: string;
}

/** điệu quạt / gõ gợi ý theo kiểu nhịp (↓ quạt xuống, ↑ quạt lên, B = gảy dây trầm) */
export function strumHint(style: BeatStyle, timeSig: string): { name: string; pattern: string } {
  const beats = Number(timeSig.split('/')[0]) || 4;
  if (style === 'waltz' || beats === 3) return { name: 'Valse', pattern: 'B ↓ ↓  (1 trầm, 2 – 3 quạt)' };
  if (beats === 6 || style === 'slowrock') return { name: 'Slow rock', pattern: 'B ↓ ↓ ↑ ↓ ↓  mỗi nửa ô' };
  switch (style) {
    case 'bolero': return { name: 'Bolero', pattern: 'B ↓↑ ↓  B ↓↑ ↓↑' };
    case 'rumba': case 'chacha': return { name: 'Rumba', pattern: 'B ↓ ↑ B ↑ ↓ ↑' };
    case 'bossa': case 'samba': return { name: 'Bossa', pattern: 'B ↓ ↓ B ↓ B ↓ ↓' };
    case 'shuffle': case 'jazz': return { name: 'Shuffle', pattern: '↓ ↓↑ ↓ ↓↑ (nhịp nảy)' };
    case 'reggae': case 'ska': return { name: 'Reggae', pattern: '– ↑ – ↑ (chặn tiếng, gõ phách nghịch)' };
    case 'train': case 'country': case 'polka': case 'march': return { name: 'Đồng quê', pattern: 'B ↓ B ↓ (trầm – quạt xen kẽ)' };
    case 'rock': case 'disco': return { name: 'Rock', pattern: '↓ ↓ ↓ ↓ ↓ ↓ ↓ ↓ (quạt đều nửa phách)' };
    default: return { name: 'Quạt chả', pattern: '↓ ↓↑ ↑↓↑' };
  }
}

function chordStartingIn(segs: ChordSegment[], from: number, to: number): ChordSegment | undefined {
  return segs.find((s) => s.start >= from - 1e-6 && s.start < to - 1e-6);
}

function chordAtBeat(segs: ChordSegment[], beat: number): ChordSegment | undefined {
  return segs.find((s) => beat >= s.start - 1e-6 && beat < s.end - 1e-6);
}

export function buildSheet(parsed: ParsedTab, flat: FlatEvent[], segs: ChordSegment[]) {
  const sections: { title?: string; lines: Item[][] }[] = [];
  let last = '';
  parsed.sections.forEach((sec, si) => {
    const out: Item[][] = [];
    sec.lines.forEach((line, li) => {
      if (line.kind !== 'tab') return;
      const evs = flat.map((f, fi) => ({ f, fi })).filter(({ f }) => f.sectionIndex === si && f.lineIndex === li);
      const hasLyrics = evs.some(({ f }) => f.lyric);
      const items: Item[] = [];
      evs.forEach(({ f, fi }, k) => {
        const seg = (k === 0 ? chordAtBeat(segs, f.start) : undefined) ?? chordStartingIn(segs, f.start, f.start + f.beats);
        const name = seg && seg.chord.root >= 0 ? seg.chord.name : undefined;
        const chord = name && (name !== last || k === 0) ? name : undefined;
        if (name) last = name;
        const text = hasLyrics ? (f.lyric ? f.lyric + (f.hyphen ? '-' : ' ') : '') : '';
        // dòng không lời: chỉ giữ chỗ đổi hợp âm; dòng có lời: bỏ nốt luyến / nghỉ không có hợp âm mới
        if (!text && !chord) return;
        items.push({ fi, chord, text });
      });
      if (items.length) out.push(items);
    });
    if (out.length || sec.title) sections.push({ title: sec.title, lines: out });
  });
  return sections;
}

interface Props {
  parsed: ParsedTab;
  flat: FlatEvent[];
  /** khúc hợp âm (đã đổi theo capo nếu có) */
  segs: ChordSegment[];
  active: number | null;
  onSeek: (fi: number) => void;
}

export const ChordSheet = memo(function ChordSheet({ parsed, flat, segs, active, onSeek }: Props) {
  const sections = useMemo(() => buildSheet(parsed, flat, segs), [parsed, flat, segs]);
  return (
    <div className="chord-sheet">
      {sections.map((sec, si) => (
        <section key={si} className="cs-sec">
          {sec.title && <h3 className="cs-title">{sec.title}</h3>}
          {sec.lines.map((items, li) => {
            const end = (k: number) => (items[k + 1]?.fi ?? Infinity);
            return (
              <p key={li} className="cs-line">
                {items.map((it, k) => (
                  <span key={it.fi} className={`cs-syl${active != null && active >= it.fi && active < end(k) ? ' on' : ''}${it.text ? '' : ' bare'}`}
                    data-beat={flat[it.fi]?.start} onClick={() => onSeek(it.fi)}>
                    <b className="cs-chord">{it.chord ?? ' '}</b>
                    <span className="cs-text">{it.text || ' '}</span>
                  </span>
                ))}
              </p>
            );
          })}
        </section>
      ))}
    </div>
  );
});
