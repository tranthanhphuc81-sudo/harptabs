import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { beatsPerBar } from '../lib/types';
import { songTonality } from '../lib/harp';
import { bassMidi, chordAt, chordVoicing, walkingNote, estimateTonality, harmonize, harmonizeSegments, parseChord, parseTonality, transposeChords } from './harmony';

const song = (id: string) => {
  const s = SAMPLE_SONGS.find((x) => x.sampleId === id)!;
  const flat = flatten(parseTab(s.body, s.harpKey, s.harpType));
  return { s, flat, spans: harmonize(flat, beatsPerBar(s.timeSig), s.pickupBeats, parseTonality(s.songKey || songTonality(s.harpKey, s.position))) };
};

describe('đệm hợp âm', () => {
  it('đọc tên tông', () => {
    expect(parseTonality('G')).toEqual({ tonic: 7, minor: false });
    expect(parseTonality('Dm')).toEqual({ tonic: 2, minor: true });
    expect(parseTonality('Bb thứ')).toEqual({ tonic: 10, minor: true });
    expect(parseTonality('F#')).toEqual({ tonic: 6, minor: false });
    expect(parseTonality('')).toBeNull();
  });

  it('Twinkle: C F C F C G C', () => {
    const { spans } = song('twinkle');
    expect(spans.slice(0, 7).map((c) => c.chord.name)).toEqual(['C', 'F', 'C', 'F', 'C', 'G', 'C']);
  });

  it('kết bài về hợp âm chủ', () => {
    for (const id of ['twinkle', 'happy-birthday', 'oh-susanna', 'clementine', 'jingle-bells']) {
      const { spans } = song(id);
      expect(spans[spans.length - 1].chord.name).toBe('C');
    }
  });

  it('đoán được tông khi bài không ghi', () => {
    expect(estimateTonality(song('twinkle').flat)).toEqual({ tonic: 0, minor: false });
  });

  it('tra hợp âm theo phách và nốt bass nằm trong tầm', () => {
    const { spans } = song('twinkle');
    expect(chordAt(spans, 4.5)?.name).toBe('F');
    expect(chordAt(spans, 999)).toBeNull();
    for (const sp of spans) {
      for (const fifth of [false, true]) {
        const m = bassMidi(sp.chord, fifth);
        expect(m).toBeGreaterThanOrEqual(40);
        expect(m).toBeLessThan(52);
      }
    }
  });

  it('thế bấm hợp âm đệm nằm gọn quanh G3–F#4', () => {
    expect(chordVoicing({ root: 0, minor: false, name: 'C' })).toEqual([60, 64, 67]);
    expect(chordVoicing({ root: 9, minor: true, name: 'Am' })).toEqual([57, 60, 64]);
    expect(chordVoicing({ root: 7, minor: false, name: 'G' })).toEqual([55, 59, 62]);
  });

  it('bass walking dẫn theo hợp âm kế tiếp', () => {
    const C = parseChord('C')!, F = parseChord('F')!, G = parseChord('G')!;
    const spans = [
      { start: 0, end: 4, chord: C },
      { start: 4, end: 6, chord: F },
      { start: 6, end: 8, chord: G },
      { start: 8, end: 12, chord: C },
    ];
    const notes: number[] = [];
    let prev: number | null = null;
    for (let b = 0; b < 12; b++) { prev = walkingNote(spans, b, prev); notes.push(prev!); }
    const pc = (m: number) => ((m % 12) + 12) % 12;
    // phách đổi hợp âm đánh đúng gốc
    expect([0, 4, 6, 8].map((b) => pc(notes[b]))).toEqual([0, 5, 7, 0]);
    // phách ngay trước khi đổi là nốt dẫn nửa cung vào gốc hợp âm sau
    for (const [b, root] of [[3, 5], [5, 7], [7, 0]] as const) {
      expect(Math.abs(notes[b] - notes[b + 1]), `phách ${b}`).toBe(1);
      expect(pc(notes[b + 1])).toBe(root);
    }
    // không lặp nốt liền nhau, không nhảy quá một quãng 8, nằm trong tầm bass
    for (let b = 1; b < notes.length; b++) {
      expect(notes[b]).not.toBe(notes[b - 1]);
      expect(Math.abs(notes[b] - notes[b - 1])).toBeLessThanOrEqual(12);
    }
    expect(notes.every((m) => m >= 36 && m <= 55)).toBe(true);
    expect(walkingNote([{ start: 0, end: 4, chord: parseChord('N.C.')! }], 0, null)).toBeNull();
  });

  it('bài trống không có hợp âm', () => {
    expect(harmonize([], 4, 0)).toEqual([]);
  });

  it('hợp âm chọn tay ghi đè hợp âm tự đoán, kể cả ngoài giọng', () => {
    const { s: sg, flat } = song('twinkle');
    const key = parseTonality('C');
    const segs = harmonizeSegments(flat, beatsPerBar(sg.timeSig), sg.pickupBeats, key, { '4': 'Am', '6': 'E', '8': 'N.C.' });
    const at = (b: number) => segs.find((x) => x.start === b)!;
    expect(at(4).chord.name).toBe('Am');
    expect(at(4).manual).toBe(true);
    expect(at(6).chord.name).toBe('E');
    expect(at(8).chord.root).toBe(-1);
    expect(at(0).manual).toBe(false);
    // khúc khác vẫn tự đoán bình thường, không bị hợp âm ngoài giọng lan sang
    expect(segs.filter((x) => !x.manual).every((x) => x.chord.name !== 'E' && x.chord.root >= 0)).toBe(true);
  });

  it('đọc tên hợp âm và dịch giọng', () => {
    expect(parseChord('F#m')).toEqual({ root: 6, minor: true, name: 'F#m' });
    expect(parseChord('Bb')?.root).toBe(10);
    expect(parseChord('xyz')).toBeNull();
    expect(transposeChords({ '0': 'C', '2': 'Am', '4': 'N.C.' }, 7)).toEqual({ '0': 'G', '2': 'Em', '4': 'N.C.' });
    expect(transposeChords({ '0': 'C' }, 12)).toEqual({ '0': 'C' });
  });
});

describe('dịch khúc hợp âm khi đổi tông', () => {
  it('dịch tên và gốc hợp âm, giữ N.C., không đổi khi dịch 0', async () => {
    const { transposeSpans } = await import('./harmony');
    const spans = [
      { start: 0, end: 2, chord: { root: 0, minor: false, name: 'C' } },
      { start: 2, end: 4, chord: { root: 9, minor: true, name: 'Am' } },
      { start: 4, end: 6, chord: { root: -1, minor: false, name: 'N.C.' } },
    ];
    expect(transposeSpans(spans, 0)).toBe(spans);
    expect(transposeSpans(spans, 3).map((s) => s.chord.name)).toEqual(['Eb', 'Cm', 'N.C.']);
    expect(transposeSpans(spans, -2).map((s) => s.chord.root)).toEqual([10, 7, -1]);
  });
});
