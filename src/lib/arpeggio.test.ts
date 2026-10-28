import { describe, expect, it } from 'vitest';
import { buildArpeggio } from './arpeggio';
import { flatten, parseTab } from './tabText';
import { harmonizeSegments } from '../audio/harmony';
import { midiToName } from './harp';

const segsOf = (names: string[], len: number) => names.map((n, i) => {
  const root = { C: 0, F: 5, G: 7, Am: 9 }[n]!;
  return { start: i * len, end: (i + 1) * len, manual: true, chord: { root, minor: n.endsWith('m'), name: n } };
});

describe('tab đệm rải', () => {
  it('guitar 4/4: mỗi nửa ô bass – dây 3 – 2 – 1, nửa sau đổi bass phụ; nốt đúng hợp âm', () => {
    const a = buildArpeggio(segsOf(['C', 'C'], 2), { inst: 'guitar', capo: 0, beatsPerBar: 4, pickupBeats: 0 });
    expect(a.flat.map((e) => e.token)).toEqual(['5.3', '3.0', '2.1', '1.0', '4.2', '3.0', '2.1', '1.0']);
    expect(a.flat.map((e) => midiToName(e.midi!))).toEqual(['C3', 'G3', 'C4', 'E4', 'E3', 'G3', 'C4', 'E4']);
    expect(a.flat.every((e) => e.beats === 0.5)).toBe(true);
  });

  it('valse 3/4: B 3 2 1 2 3 mỗi ô; ukulele rải dây 4 → 1', () => {
    const g = buildArpeggio(segsOf(['G'], 3), { inst: 'guitar', capo: 0, beatsPerBar: 3, pickupBeats: 0 });
    expect(g.flat.map((e) => e.token)).toEqual(['6.3', '3.0', '2.0', '1.3', '2.0', '3.0']);
    const u = buildArpeggio(segsOf(['C'], 2), { inst: 'ukulele', capo: 0, beatsPerBar: 4, pickupBeats: 0 });
    expect(u.flat.map((e) => e.token)).toEqual(['4.0', '3.0', '2.0', '1.3']);
  });

  it('capo: số phím tính từ capo (thế C), tiếng phát ra cao thêm capo', () => {
    const a = buildArpeggio(segsOf(['C'], 2).map((s) => ({ ...s, chord: { root: 2, minor: false, name: 'D' } })), { inst: 'guitar', capo: 2, beatsPerBar: 4, pickupBeats: 0 });
    expect(a.flat[0].token).toBe('5.3');
    expect(midiToName(a.flat[0].midi!)).toBe('D3');
  });

  it('bài thật: đủ thời lượng, lời gắn vào nốt rải, xuống dòng mỗi 2 ô', () => {
    const body = '2.1 2.1 3.0 3.0 3.2 3.2 3.0:2\nTwin-kle twin-kle lit-tle star\n\n4.3 4.3 4.2 4.2 4.0 4.0 5.3:2\nHow I won-der what you are\n';
    const melody = flatten(parseTab(body, 'C', 'guitar6'));
    const segs = harmonizeSegments(melody, 4, 0, { tonic: 0, minor: false });
    const a = buildArpeggio(segs, { inst: 'guitar', capo: 0, beatsPerBar: 4, pickupBeats: 0, lyrics: melody });
    const end = (f: typeof a.flat) => f[f.length - 1].start + f[f.length - 1].beats;
    expect(end(a.flat)).toBe(end(melody));
    expect(a.flat.filter((e) => e.lyric).map((e) => e.lyric)).toEqual(melody.filter((e) => e.lyric).map((e) => e.lyric));
    expect(a.parsed.sections[0].lines).toHaveLength(2);
  });
});
