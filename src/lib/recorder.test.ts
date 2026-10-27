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
  it('bài học sáo: mọi tab đọc được trên sáo alto', async () => {
    const { RECORDER_LESSONS } = await import('../data/recorderLessons');
    for (const l of RECORDER_LESSONS) for (const b of l.blocks) {
      if (b.t === 'tab') expect(parseTab(b.body, 'F', 'recorderAlto').issues, `${l.id}`).toEqual([]);
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
