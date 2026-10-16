import { describe, expect, it } from 'vitest';
import { harpLayout, parseToken, nameToMidi, midiToName, harpForSongKey, positionKey, normalizeKey } from './harp';
import { parseTab, serializeTab, flatten, totalBeats } from './tabText';
import { bestTabs, fitToHarp, rankHarpKeys, rekeyBody, midisOf } from './converter';

describe('harp layout', () => {
  it('kèn C có đúng nốt thổi/hút cơ bản', () => {
    expect(parseToken('4', 'C')!.midi).toBe(60 + 12);
    expect(parseToken('-4', 'C')!.midi).toBe(74);
    expect(parseToken('+1', 'C')!.midi).toBe(60);
    expect(parseToken('10', 'C')!.midi).toBe(96);
  });

  it('bend đúng số nửa cung và chặn bend không tồn tại', () => {
    expect(parseToken("-3'", 'C')!.midi).toBe(70);
    expect(parseToken("-3''", 'C')!.midi).toBe(69);
    expect(parseToken("-3'''", 'C')!.midi).toBe(68);
    expect(parseToken("-2''", 'C')!.midi).toBe(65);
    expect(parseToken("-5'", 'C')).toBeNull();
    expect(parseToken("-4''", 'C')).toBeNull();
    expect(parseToken("8'", 'C')!.midi).toBe(87);
    expect(parseToken("10''", 'C')!.midi).toBe(94);
    expect(parseToken("7'", 'C')).toBeNull();
  });

  it('overblow / overdraw', () => {
    expect(parseToken('6o', 'C')!.midi).toBe(82);
    expect(parseToken('4o', 'C')!.midi).toBe(75);
    expect(parseToken('-7o', 'C')!.midi).toBe(85);
    expect(parseToken('3o', 'C')).toBeNull();
  });

  it('chấp nhận dấu nháy copy từ web', () => {
    expect(parseToken('-3’', 'C')!.token).toBe("-3'");
    expect(parseToken('−4', 'C')!.token).toBe('-4');
  });

  it('kèn G thấp hơn C 5 nửa cung, kèn D cao hơn 2', () => {
    expect(parseToken('1', 'G')!.midi).toBe(55);
    expect(parseToken('1', 'D')!.midi).toBe(62);
  });

  it('mỗi kèn có 19 nốt bend + 7 over', () => {
    const l = harpLayout('C');
    expect(l.filter((n) => n.technique === 'drawBend').length).toBe(8);
    expect(l.filter((n) => n.technique === 'blowBend').length).toBe(4);
    expect(l.filter((n) => n.over).length).toBe(7);
  });

  it('tên nốt', () => {
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('F#5')).toBe(78);
    expect(nameToMidi('Bb3')).toBe(58);
    expect(nameToMidi('x')).toBeNull();
    expect(midiToName(61)).toBe('C#4');
    expect(midiToName(60, 'solfege')).toBe('Đô4');
  });

  it('vị trí và tông kèn', () => {
    expect(positionKey('C', 2)).toBe('G');
    expect(harpForSongKey('G', 2)).toBe('C');
    expect(harpForSongKey('E', 2)).toBe('A');
    expect(harpForSongKey('Dm', 3)).toBe('C');
    expect(normalizeKey('c#')).toBe('Db');
  });
});

describe('tab text', () => {
  const body = `# Đoạn 1
4 4 -4 4 7 -7:2
Hap-py birth-day to you

r 4:0.5 4:1/2 -4 | 4 -8 7:2
_ py birth-day to you
Ghi chú tự do`;

  it('phân tích nốt, độ dài, lời', () => {
    const p = parseTab(body, 'C');
    expect(p.issues).toEqual([]);
    expect(p.sections).toHaveLength(1);
    const lines = p.sections[0].lines;
    expect(lines[0].kind).toBe('tab');
    if (lines[0].kind !== 'tab' || lines[1].kind !== 'tab') throw new Error();
    expect(lines[0].events.map((e) => e.lyric)).toEqual(['Hap', 'py', 'birth', 'day', 'to', 'you']);
    expect(lines[0].events[0].hyphen).toBe(true);
    expect(lines[0].events[5].beats).toBe(2);
    expect(lines[1].events[0].token).toBeNull();
    expect(lines[1].events[1].beats).toBe(0.5);
    expect(lines[1].events[2].beats).toBe(0.5);
    expect(lines[1].events[1].lyric).toBeUndefined(); // "_" luyến
    expect(lines[1].events[2].lyric).toBe('py');
    expect(lines[2].kind).toBe('note');
    expect(totalBeats(p)).toBe(14);
  });

  it('báo lỗi lỗ không chơi được', () => {
    const p = parseTab("4 -5' 5", 'C');
    expect(p.issues[0].level).toBe('error');
  });

  it('liên ba ghi dạng phân số và đọc lại đúng', () => {
    const p = parseTab('4:2/3 5:2/3 -5:2/3 6:1/3', 'C');
    const text = serializeTab(p.sections);
    expect(text).toContain('4:2/3');
    expect(text).toContain('6:1/3');
    expect(flatten(parseTab(text, 'C')).map((e) => +e.beats.toFixed(4))).toEqual([0.6667, 0.6667, 0.6667, 0.3333]);
  });

  it('serialize rồi parse lại giữ nguyên', () => {
    const p = parseTab(body, 'C');
    const again = parseTab(serializeTab(p.sections), 'C');
    expect(flatten(again).map((e) => [e.token, e.beats, e.lyric ?? ''])).toEqual(
      flatten(p).map((e) => [e.token, e.beats, e.lyric ?? '']),
    );
  });
});

describe('converter', () => {
  it('ưu tiên nốt tự nhiên và lỗ gần nhau', () => {
    // C D E F G A B C (quãng 5 của kèn C)
    const fit = bestTabs([72, 74, 76, 77, 79, 81, 83, 84], 'C');
    expect(fit.tokens).toEqual(['4', '-4', '5', '-5', '6', '-6', '-7', '7']);
    expect(fit.stats.bends).toBe(0);
  });

  it('chọn G4 ở lỗ 3 thổi hoặc -2 tuỳ nốt bên cạnh', () => {
    const fit = bestTabs([71, 67, 71], 'C'); // B G B: -3 ? -3
    expect(fit.tokens[0]).toBe('-3');
    expect(['-2', '3']).toContain(fit.tokens[1]);
  });

  it('dịch quãng tám để tránh bend', () => {
    // Amazing Grace quãng thấp có A4 (cần bend) → nên lên quãng tám
    const low = [67, 72, 76, 72, 76, 74, 72, 69, 67];
    const fit = fitToHarp(low, 'C');
    expect(fit.shift).toBe(12);
    expect(fit.stats.bends).toBe(0);
  });

  it('gợi ý kèn đúng tông bài', () => {
    // giai điệu thang âm D trưởng
    const d = [62, 64, 66, 67, 69, 71, 73, 74].map((x) => x + 12);
    expect(rankHarpKeys(d)[0].key).toBe('D');
  });

  it('chuyển bài sang kèn khác vẫn giữ lời', () => {
    const r = rekeyBody('4 -4 5\nDo re mi', 'C', 'G', 'any');
    const p = parseTab(r.body, 'G');
    expect(p.issues).toEqual([]);
    expect(flatten(p).map((e) => e.lyric)).toEqual(['Do', 're', 'mi']);
    // cùng tab khi dịch giọng tự do
    expect(midisOf(p).length).toBe(3);
    expect(r.fit.stats.natural).toBe(3);
  });
});

import { SAMPLE_SONGS } from '../data/samples';
describe('bài mẫu', () => {
  for (const s of SAMPLE_SONGS) {
    it(`"${s.title}" không có lỗi và lời khớp nốt`, () => {
      const p = parseTab(s.body, s.harpKey, s.harpType);
      expect(p.issues).toEqual([]);
    });
  }
});

import { LESSONS } from '../data/lessons';
describe('bài tập trong bài học', () => {
  for (const l of LESSONS) for (const b of l.blocks) if (b.t === 'tab') {
    it(`${l.id}: ${b.caption ?? 'tab'}`, () => expect(parseTab(b.body, b.harpKey ?? 'C', b.harpType).issues).toEqual([]));
  }
});
