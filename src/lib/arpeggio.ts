/**
 * Tab đệm rải (fingerstyle) cho guitar / ukulele: từ các khúc hợp âm của bài sinh ra từng nốt gảy,
 * ghi "dây.phím" như tab giai điệu. Guitar: ngón cái gảy dây bass (dây trầm nhất của thế bấm, nửa sau ô đổi sang dây bass kế bên),
 * các ngón còn lại gảy dây 3 – 2 – 1. Ukulele: rải từ dây 4 lên dây 1.
 * Có capo thì số phím tính từ capo (như tab thật), cao độ phát ra cộng thêm capo.
 */
import { chordShape, type ChordInstrument } from '../data/chordShapes';
import { GUITAR_TUNING, UKULELE_TUNING } from '../data/guitar';
import { shapeName } from './capo';
import type { ChordSegment } from '../audio/harmony';
import type { FlatEvent, ParsedTab, TabEvent, TabLine } from './tabText';

/** mẫu rải cho một khúc đệm, mỗi phần tử một nốt móc đơn (nửa phách): 'B' bass, 'A' bass phụ, số = dây */
export function arpPattern(segBeats: number, inst: ChordInstrument): (string | number)[] {
  if (inst === 'ukulele') return segBeats >= 3 ? [4, 3, 2, 1, 2, 3] : [4, 3, 2, 1];
  if (segBeats >= 3) return ['B', 3, 2, 1, 2, 3];
  return ['B', 3, 2, 1];
}

export interface Arpeggio {
  parsed: ParsedTab;
  flat: FlatEvent[];
}

/**
 * `segs`: khúc hợp âm (tên hợp âm nghe thật); `lyrics`: các nốt giai điệu có lời (gắn lời vào nốt rải cùng lúc);
 * `barsPerLine`: số ô nhịp mỗi dòng tab.
 */
export function buildArpeggio(segs: ChordSegment[], opts: {
  inst: ChordInstrument; capo: number; beatsPerBar: number; pickupBeats: number; lyrics?: FlatEvent[]; barsPerLine?: number;
}): Arpeggio {
  const { inst, capo, beatsPerBar: bpb, pickupBeats: pickup } = opts;
  const tuning = inst === 'guitar' ? GUITAR_TUNING : UKULELE_TUNING; // dây 1 → dây cuối
  const n = tuning.length;
  const perLine = (opts.barsPerLine ?? 2) * bpb;
  const lines: TabLine[] = [];
  const flat: FlatEvent[] = [];
  let cur: TabEvent[] = [];
  let lineStart = 0;
  let segInBar = 0;

  const push = (ev: TabEvent & { start: number }) => {
    // ngắt dòng ở đầu ô nhịp đủ số ô
    if (cur.length && ev.start >= pickup - 1e-6 && ev.start - lineStart >= perLine - 1e-6 && Math.abs(((ev.start - pickup) % bpb)) < 1e-6) {
      lines.push({ kind: 'tab', events: cur, lineNo: lines.length + 1 });
      cur = [];
      lineStart = ev.start;
    }
    cur.push(ev);
    flat.push({ ...ev, start: ev.start, sectionIndex: 0, lineIndex: lines.length, eventIndex: cur.length - 1 });
  };

  for (const seg of segs) {
    const len = seg.end - seg.start;
    const shape = seg.chord.root >= 0 ? chordShape(shapeName(seg.chord.name, capo), inst) : null;
    // khúc lấy đà / không hợp âm: nghỉ
    if (!shape || seg.start < pickup - 1e-6) {
      push({ token: null, midi: null, beats: len, start: seg.start });
      continue;
    }
    // shape: phím từng dây từ dây trầm (dây n) lên dây cao (dây 1)
    const fretOf = (string: number) => shape[n - string];
    const played = Array.from({ length: n }, (_, i) => n - i).filter((s) => fretOf(s) >= 0); // dây trầm → cao
    const bass = played[0];
    const alt = played[1] ?? bass;
    segInBar = Math.abs((seg.start - pickup) % bpb) < 1e-6 ? 0 : segInBar + 1;
    const pattern = arpPattern(len, inst);
    const step = len / pattern.length;
    pattern.forEach((p, i) => {
      let string = p === 'B' ? (segInBar % 2 === 1 ? alt : bass) : p === 'A' ? alt : (p as number);
      if (fretOf(string) < 0) string = played[played.length - 1];
      const fret = fretOf(string);
      push({ token: `${string}.${fret}`, midi: tuning[string - 1] + capo + fret, beats: step, start: seg.start + i * step });
    });
  }
  if (cur.length) lines.push({ kind: 'tab', events: cur, lineNo: lines.length + 1 });

  // lời bài: gắn vào nốt rải bắt đầu cùng lúc (hoặc ngay trước) chữ đó
  if (opts.lyrics?.length) {
    const sung = opts.lyrics.filter((e) => e.lyric);
    for (const l of sung) {
      let best = -1;
      for (let i = 0; i < flat.length && flat[i].start <= l.start + 1e-6; i++) if (flat[i].token) best = i;
      if (best < 0 || flat[best].lyric) continue;
      const f = flat[best];
      f.lyric = l.lyric;
      if (l.hyphen) f.hyphen = true;
      const ev = lines[f.lineIndex].events[f.eventIndex];
      ev.lyric = l.lyric;
      if (l.hyphen) ev.hyphen = true;
    }
  }
  return { parsed: { sections: [{ lines }], issues: [] }, flat };
}
