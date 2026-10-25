import { describe, expect, it } from 'vitest';
import { assignSyllables, looksLikeLyrics, lyricBands, lyricSlots, relyric, staffLyrics, toSyllables } from './lyricOcr';
import type { Gray, OmrNote, OmrPage } from './omr';
import { toTranscription } from './omr';

const SP = 13.5;
const note = (id: string, x: number, step = 2, extra: Partial<OmrNote> = {}): OmrNote => ({
  id, page: 0, staff: 0, x, y: 154 - (step * SP) / 2, step, accidental: null, beats: 1, hollow: false, dot: false, rest: false, ...extra,
});
const w = (text: string, x0: number, x1: number, confidence = 90) => ({ text, x0, x1, confidence });

/** trang trắng 700×400: khuông 100..154, các khối "chữ" đen */
function page(blocks: [number, number, number, number][], notes: OmrNote[] = []): Pick<OmrPage, 'image' | 'staves' | 'notes'> {
  const W = 700, H = 400;
  const data = new Uint8Array(W * H).fill(255);
  for (let i = 0; i < 5; i++) data.fill(0, Math.round(100 + i * SP) * W + 20, Math.round(100 + i * SP) * W + 620);
  for (const [x0, y0, x1, y1] of blocks) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x += 2) data[y * W + x] = 0;
  const image: Gray = { width: W, height: H, data };
  return { image, staves: [{ page: 0, top: 100, bottom: 154, space: SP, bars: [], xRight: 620 }], notes };
}

describe('đọc lời dưới khuông', () => {
  it('tìm dải lời 1 ngay dưới khuông (bỏ đuôi nốt), lời 2 là dải sau', () => {
    // đuôi nốt quay xuống tới ~bottom+1,5 khe; lời 1 ở bottom+3 khe, lời 2 ở bottom+6 khe
    const p = page([[60, 154, 62, 175], [40, 196, 560, 214], [40, 236, 520, 254]], [note('a', 61, 5)]);
    const bands = lyricBands(p, 0);
    expect(bands.length).toBe(2);
    expect(bands[0].y0).toBeLessThanOrEqual(196);
    expect(bands[0].y1).toBeGreaterThanOrEqual(214);
    expect(bands[0].y1).toBeLessThan(236);
    expect(bands[1].y0).toBeGreaterThan(214);
  });

  it('tách âm tiết, bỏ số lời và ký tự rác', () => {
    const s = toSyllables([w('1.', 0, 10), w('Hà-Nội', 20, 80), w('|', 85, 86), w('ơi', 90, 110)]);
    expect(s.map((x) => x.text)).toEqual(['Hà', 'Nội', 'ơi']);
    expect(s[1].x0).toBeCloseTo(44); // chia theo số ký tự: 2 + 3
    expect(looksLikeLyrics(s)).toBe(true);
    expect(looksLikeLyrics(toSyllables([w('~~', 0, 10, 20), w('ii', 20, 30, 20)]))).toBe(false);
  });

  it('gắn âm tiết vào nốt gần nhất theo thứ tự; chữ luyến bỏ trống nốt giữa; bỏ dấu lặng, nốt nối', () => {
    const notes = [note('n1', 100), note('n2', 150), note('n3', 180), note('r', 220, 2, { rest: true }), note('n4', 260), note('t', 300, 2, { tied: true }), note('n5', 340)];
    const slots = lyricSlots(notes, 0);
    expect(slots.map((n) => n.id)).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
    // "Một" căn giữa nốt 1, "hai" căn trái dưới nốt 2 (luyến sang nốt 3), "ba" dưới nốt 4, "bốn" dưới nốt 5
    const m = assignSyllables(slots, [w('Một', 85, 115), w('hai', 145, 175), w('ba', 252, 272), w('bốn', 330, 360)]);
    expect([...m]).toEqual([['n1', 'Một'], ['n2', 'hai'], ['n4', 'ba'], ['n5', 'bốn']]);
    // nhiều chữ hơn chỗ còn lại: vẫn chừa đủ nốt
    const tight = assignSyllables(slots.slice(0, 3), [w('a', 95, 105), w('b', 96, 106), w('c', 97, 107)]);
    expect([...tight.keys()]).toEqual(['n1', 'n2', 'n3']);
  });

  it('sửa lời: chia lại theo các nốt đang có lời, thừa thì sang nốt sau; vào tab', () => {
    const notes = [note('n1', 100, 2, { lyric: 'Mot' }), note('n2', 150), note('n3', 180, 2, { lyric: 'hai' }), note('n4', 220)];
    const slots = lyricSlots(notes, 0);
    expect(staffLyrics(notes, 0)).toBe('Mot hai');
    const m = relyric(slots, ' Một  hai ba ');
    expect(Object.fromEntries(m)).toEqual({ n1: 'Một', n2: '', n3: 'hai', n4: 'ba' });
    const withLyrics = notes.map((n) => ({ ...n, lyric: m.get(n.id) || undefined }));
    const tr = toTranscription([{ notes: withLyrics, staves: [{ page: 0, top: 100, bottom: 154, space: SP, bars: [], xRight: 620 }] }], { title: 'x', keySig: 0, timeSig: '4/4', tempo: 90 });
    expect(tr.sections[0].lines[0].notes.map((n) => n.lyric)).toEqual(['Một', '', 'hai', 'ba']);
  });
});
