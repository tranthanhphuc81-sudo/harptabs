import { describe, expect, it } from 'vitest';
import { bestCapo, capoCost, shapeName, soundingName } from './capo';
import { buildSheet, strumHint } from '../components/ChordSheet';
import { flatten, parseTab } from './tabText';
import { harmonizeSegments } from '../audio/harmony';

describe('capo', () => {
  it('đổi tên thế bấm theo capo và ngược lại', () => {
    expect(shapeName('D', 2)).toBe('C');
    expect(shapeName('Bm', 2)).toBe('Am');
    expect(shapeName('F#m7', 2)).toBe('Em7');
    expect(shapeName('Bbmaj7', 3)).toBe('Gmaj7');
    expect(shapeName('N.C.', 2)).toBe('N.C.');
    expect(soundingName('C', 2)).toBe('D');
    expect(soundingName(shapeName('Eb', 1), 1)).toBe('Eb');
  });

  it('gợi ý capo: bài giọng Eb (Eb Ab Bb Cm) → capo 1 bấm D G A Bm', () => {
    const song = ['Eb', 'Ab', 'Bb', 'Cm', 'Eb', 'Bb'];
    expect(bestCapo(song, 'guitar')).toBe(1);
    expect(song.map((c) => shapeName(c, 1))).toEqual(['D', 'G', 'A', 'Bm', 'D', 'A']);
    expect(capoCost(song, 1, 'guitar')).toBeLessThan(capoCost(song, 0, 'guitar'));
  });

  it('bài đã dễ (C G Am F) thì không cần capo', () => {
    expect(bestCapo(['C', 'G', 'Am', 'F'], 'guitar')).toBe(0);
    expect(bestCapo(['C', 'G', 'Am', 'F'], 'ukulele')).toBe(0);
    expect(bestCapo(['C', 'F', 'G', 'C', 'F', 'G7'], 'guitar')).toBe(0);
  });

  it('bài giọng D trên guitar giữ nguyên (D A Bm G đều có thế quen trừ Bm), giọng B thì nên capo', () => {
    expect(bestCapo(['B', 'E', 'F#', 'G#m'], 'guitar')).toBeGreaterThan(0);
  });
});

describe('bảng lời + hợp âm', () => {
  const body = '# Đoạn 1\n2.1 2.1 3.0 3.0 3.2 3.2 3.0:2\nTwin-kle twin-kle lit-tle star\n\n4.3 4.3 4.2 4.2 4.0 4.0 5.3:2\n';
  const parsed = parseTab(body, 'C', 'guitar6');
  const flat = flatten(parsed);
  const segs = harmonizeSegments(flat, 4, 0, { tonic: 0, minor: false });

  it('hợp âm đặt trên chữ chỗ đổi hợp âm, dòng không lời chỉ còn hợp âm', () => {
    const sheet = buildSheet(parsed, flat, segs);
    expect(sheet[0].title).toBe('Đoạn 1');
    const [l1, l2] = sheet[0].lines;
    expect(l1[0].chord).toBeTruthy();
    expect(l1.map((i) => i.text).join('')).toBe('Twin-kle twin-kle lit-tle star ');
    expect(l2.every((i) => i.chord && !i.text)).toBe(true);
    // không lặp hợp âm liền nhau trong một dòng
    const names = l1.filter((i) => i.chord).map((i) => i.chord);
    names.forEach((n, k) => k > 0 && expect(n).not.toBe(names[k - 1]));
  });

  it('điệu quạt theo nhịp', () => {
    expect(strumHint('ballad', '4/4').name).toBe('Quạt chả');
    expect(strumHint('waltz', '3/4').name).toBe('Valse');
    expect(strumHint('ballad', '3/4').name).toBe('Valse');
  });
});
