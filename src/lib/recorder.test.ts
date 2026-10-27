import { describe, expect, it } from 'vitest';
import { harpLayout, harpName, isTabToken, parseToken } from './harp';
import { rekeyBody } from './converter';
import { parseTab } from './tabText';
import { SAMPLE_SONGS } from '../data/samples';

describe('sáo dọc alto (Fa) và soprano (Đô)', () => {
  it('alto: F4–G6 đủ 27 nốt, mỗi nốt có thế bấm 8 lỗ', () => {
    const l = harpLayout('F', 'recorderAlto');
    expect(l).toHaveLength(27);
    expect(l[0]).toMatchObject({ token: 'F4', midi: 65, fingers: 'xxxxxxxx' });
    expect(l[26].token).toBe('G6');
    expect(l.every((n) => /^[xoh]{8}$/.test(n.fingers!))).toBe(true);
    expect(harpName('F', 'recorderAlto')).toBe('Sáo alto (Fa)');
  });
  it('soprano ghi thấp hơn tiếng thật một quãng tám, cùng thế bấm với alto', () => {
    const s = harpLayout('C', 'recorderSoprano');
    expect(s[0]).toMatchObject({ token: 'C4', midi: 72 });
    expect(s.map((n) => n.fingers)).toEqual(harpLayout('F', 'recorderAlto').map((n) => n.fingers));
  });
  it('đọc tên nốt, cả cách viết thăng / giáng tương đương', () => {
    expect(parseToken('Bb4', 'F', 'recorderAlto')?.midi).toBe(70);
    expect(parseToken('A#4', 'F', 'recorderAlto')?.midi).toBe(70);
    expect(parseToken('E4', 'F', 'recorderAlto')).toBeNull(); // dưới tầm sáo alto
    expect(isTabToken('Hap-py', 'recorderAlto')).toBe(false);
    const p = parseTab('F4 G4:2 r A4\nMột hai ba\n', 'F', 'recorderAlto');
    expect(p.issues).toEqual([]);
    expect(p.sections[0].lines[0]).toMatchObject({ kind: 'tab' });
  });
  it('bài mẫu harmonica chuyển được sang sáo alto, không thiếu nốt', () => {
    for (const s of SAMPLE_SONGS.slice(0, 15)) {
      const r = rekeyBody(s.body, s.harpKey, 'F', 'any', s.harpType ?? 'diatonic', 'recorderAlto');
      expect(r.fit.stats.unplayable, s.title).toBe(0);
    }
  });
});

describe('nội dung app sáo', () => {
  it('bài mẫu xếp lại cho sáo alto: đủ nhiều bài, không lỗi ký hiệu', async () => {
    const { recorderSamples } = await import('../data/recorderSamples');
    const base = SAMPLE_SONGS.filter((s) => !s.harpType || s.harpType === 'diatonic');
    const out = recorderSamples(base);
    expect(out.length).toBeGreaterThan(10);
    for (const s of out) expect(parseTab(s.body, 'F', 'recorderAlto').issues.filter((i) => i.level === 'error'), s.title).toEqual([]);
  });
  it('bài học sáo: mọi tab đọc được trên đúng loại sáo của bài', async () => {
    const { RECORDER_LESSONS } = await import('../data/recorderLessons');
    for (const l of RECORDER_LESSONS) for (const b of l.blocks) {
      if (b.t === 'tab') expect(parseTab(b.body, b.harpKey ?? 'F', b.harpType ?? 'recorderAlto').issues, `${l.id}`).toEqual([]);
    }
  });
});

describe('sáo tenor', () => {
  it('tenor Đô: C4–D6 ghi đúng cao độ, cùng thế bấm', () => {
    const t = harpLayout('C', 'recorderTenor');
    expect(t[0]).toMatchObject({ token: 'C4', midi: 60 });
    expect(t[26]).toMatchObject({ token: 'D6', midi: 86 });
    expect(harpName('C', 'recorderTenor')).toBe('Sáo tenor (Đô)');
  });
});

describe('blues cho sáo', () => {
  it('lick blues (viết cho kèn) đổi sang sáo alto ở mọi giọng, đủ nốt, đủ phách', async () => {
    const { LICKS } = await import('../data/licks');
    const { lickForRecorder } = await import('./jazz');
    const { totalBeats } = await import('./tabText');
    for (const l of LICKS) for (let tonic = 0; tonic < 12; tonic++) {
      const body = lickForRecorder(l.body, tonic, 'recorderAlto');
      const p = parseTab(body, 'F', 'recorderAlto');
      expect(p.issues.filter((i) => i.level === 'error'), `${l.id} @${tonic}`).toEqual([]);
      expect(totalBeats(p)).toBeCloseTo(l.bars * 4, 6);
      expect(body.split(/\s+/).filter((t) => t.startsWith('r')).length, `${l.id} @${tonic}: nốt thiếu`).toBe(l.body.split(/\s+/).filter((t) => t.startsWith('r')).length);
    }
  });
  it('thang âm blues giọng Sol trên sáo alto', async () => {
    const { bluesScaleTokens } = await import('./blues');
    const t = bluesScaleTokens('F', 'recorderAlto', 7);
    expect(t).toContain('G4');
    expect(t).toContain('Bb4');
    expect(t).toContain('C#5');
  });
});

describe('sáo bass và kiểu bấm German', () => {
  it('bass Fa: F3–G5', () => {
    const b = harpLayout('F', 'recorderBass');
    expect(b[0]).toMatchObject({ token: 'F3', midi: 53 });
    expect(b[26].token).toBe('G5');
  });
  it('German: Bb4 trên alto bấm thẳng, đổi lại thì Baroque', async () => {
    const { setRecorderFingering } = await import('./harp');
    const bb = () => harpLayout('F', 'recorderAlto').find((n) => n.token === 'Bb4')!;
    expect(bb().technique).toBe('crossFingered');
    setRecorderFingering('german');
    expect(bb()).toMatchObject({ fingers: 'xxxxxooo', technique: 'fingered' });
    setRecorderFingering('baroque');
    expect(bb().technique).toBe('crossFingered');
  });
});

describe('sáo trúc 6 lỗ', () => {
  it('sáo Đô: bịt hết ra Sol4, mở dần La Si Đô Rê Mi, mở hết Fa', () => {
    const l = harpLayout('C', 'saoTruc6');
    expect(l).toHaveLength(24);
    const tok = (f: string) => l.find((n) => n.fingers === f && n.technique === 'fingered')?.token;
    expect(tok('xxxxxx')).toBe('G4');
    expect(tok('xxxxxo')).toBe('A4');
    expect(tok('xxxooo')).toBe('C5');
    expect(tok('oooooo')).toBe('F5');
    expect(harpName('C', 'saoTruc6')).toBe('Sáo trúc Đô (C, bịt hết ra Sol)');
  });
  it('sáo Sol bịt hết ra Rê4; bài mẫu chuyển được sang sáo Đô hoặc chọn được tông sáo hợp', async () => {
    expect(harpLayout('G', 'saoTruc6')[0].token).toBe('D4');
    const { rankHarpKeys, midisOf } = await import('./converter');
    for (const s of SAMPLE_SONGS.slice(0, 10)) {
      const best = rankHarpKeys(midisOf(parseTab(s.body, s.harpKey, s.harpType ?? 'diatonic')), 1, 'saoTruc6')[0];
      expect(best.stats.unplayable, s.title).toBe(0);
    }
  });
});

describe('sáo trúc: nhiều cách gọi "bịt hết ra nốt"', () => {
  it('mỗi cách gọi đủ 24 nốt liền nửa cung, mở dần đúng thang trưởng của tông sáo', async () => {
    const { setSaoTrucClosed } = await import('./harp');
    const { DEGREE_NAMES } = await import('../data/saoTrucFingerings');
    for (let d = 1; d <= 7; d++) {
      setSaoTrucClosed(d);
      const l = harpLayout('C', 'saoTruc6');
      expect(l, DEGREE_NAMES[d - 1]).toHaveLength(24);
      expect(l.every((n) => n.fingers && n.fingers.length === 6)).toBe(true);
      // các nốt mở dần 0…6 lỗ (thế thường) đều thuộc thang Đô trưởng
      const naturals = l.filter((n) => /^x*o*$/.test(n.fingers!) && n.technique === 'fingered').map((n) => n.midi % 12);
      expect(naturals.every((pc) => [0, 2, 4, 5, 7, 9, 11].includes(pc))).toBe(true);
    }
    setSaoTrucClosed(1);
    expect(harpLayout('C', 'saoTruc6')[0].token).toBe('C5'); // sáo Đô bịt hết ra Đô
    expect(harpLayout('C', 'saoTruc6').find((n) => n.fingers === 'oooooo' && n.technique === 'fingered')?.token).toBe('B5');
    setSaoTrucClosed(2);
    expect(harpLayout('D', 'saoTruc6')[0].token).toBe('E5'); // sáo Rê bịt hết ra Mi
    setSaoTrucClosed(5);
    expect(harpLayout('C', 'saoTruc6')[0].token).toBe('G4');
  });
});
