import { beforeEach, describe, expect, it, vi } from 'vitest';

// âm thanh giả: đồng hồ do test điều khiển, mọi tiếng chỉ được đếm
const clock = { t: 0, lat: 0 };
const calls: Record<string, number> = {};
const count = (name: string) => () => { calls[name] = (calls[name] ?? 0) + 1; };
const bassNotes: { midi: number; when: number }[] = [];
const melodyNotes: number[] = [];
vi.mock('./engine', () => ({
  audio: () => ({ currentTime: clock.t, outputLatency: clock.lat }),
  applyMix: () => {},
  setHumanVelocity: () => {},
  playTone: (midi: number) => { count('melody')(); melodyNotes.push(midi); },
  bass: (midi: number, when: number) => { count('bass')(); bassNotes.push({ midi, when }); },
  chordStab: count('comp'),
  kick: count('kick'),
  snare: count('snare'),
  hat: count('hat'),
  rim: count('rim'),
  shaker: count('shaker'),
  bongo: count('bongo'),
  conga: count('conga'),
  guiro: count('guiro'),
  clave: count('clave'),
  cowbell: count('cowbell'),
  clap: count('clap'),
  ride: count('ride'),
  surdo: count('surdo'),
  crash: count('crash'),
  tom: count('tom'),
  click: count('click'),
}));

const { Player } = await import('./player');
const { setSyncOffsetMs } = await import('./latency');

/** chạy bộ phát `seconds` giây (đồng hồ giả), trả về số tiếng mỗi loại */
function run(style: string, beatsPerBar: number, seconds = 4, chordOverrides?: Record<string, string>) {
  for (const k of Object.keys(calls)) delete calls[k];
  bassNotes.length = 0;
  clock.t = 0;
  const p = new Player({ bpm: 120, tempoScale: 1, beatsPerBar, pickupBeats: 0, style: style as never, melody: true, beat: true, click: false, countIn: false, loop: null, songKey: 'C', chordOverrides });
  // giai điệu C E G C lặp lại, mỗi nốt 1 phách
  p.load(Array.from({ length: 32 }, (_, i) => ({ token: '4', midi: [60, 64, 67, 72][i % 4], beats: 1, start: i, sectionIndex: 0, lineIndex: 0, eventIndex: i })));
  p.start(0);
  const tick = (p as unknown as { tick: () => void }).tick.bind(p);
  for (let s = 0; s < seconds; s += 0.05) { clock.t = s; tick(); }
  p.stop();
  return { ...calls };
}

beforeEach(() => { vi.stubGlobal('window', { setInterval: () => 0, clearInterval: () => {}, setTimeout: () => 0, clearTimeout: () => {} }); });

describe('bộ phát beat', () => {
  it('nhịp 2/4 có trống, bass, đệm (trước đây im lặng)', () => {
    const c = run('march', 2);
    expect(c.kick).toBeGreaterThan(0);
    expect(c.snare).toBeGreaterThan(0);
    expect(c.bass).toBeGreaterThan(0);
    expect(c.comp).toBeGreaterThan(0);
  });

  it('march 4/4: trống bass đúng 2 tiếng mỗi ô (phách 1, 3)', () => {
    // 4 giây ở 120 bpm = 8 phách = 2 ô (thêm một chút do lập lịch trước)
    const c = run('march', 4, 4);
    expect(c.kick).toBeGreaterThanOrEqual(4);
    expect(c.kick).toBeLessThanOrEqual(5);
  });

  it('polka 2/4: bass mỗi phách một nốt, hợp âm nửa sau mỗi phách', () => {
    const c = run('polka', 2, 4);
    expect(c.bass).toBeGreaterThanOrEqual(8);
    expect(c.comp).toBeGreaterThanOrEqual(8);
  });

  it('salsa: bass tumbao đón gốc hợp âm ô sau ở phách 4', () => {
    // ô 1 = C, ô 2 = F (mỗi khúc nửa ô chọn tay); 120 bpm → phách = 0.5 giây
    run('salsa', 4, 4, { '0': 'C', '2': 'C', '4': 'F', '6': 'F' });
    const start = bassNotes[0].when - 1.5 * 0.5; // nốt đầu là 2& (phách 1.5)
    const at = (beat: number) => bassNotes.find((n) => Math.abs(n.when - start - beat * 0.5) < 0.02)?.midi;
    expect(((at(1.5)! % 12) + 12) % 12).toBe(7); // quãng 5 của C = G
    expect(((at(3)! % 12) + 12) % 12).toBe(5); // phách 4: gốc của F (ô sau)
  });

  it('jazz: bass walking mỗi phách một nốt', () => {
    const c = run('jazz', 4, 4);
    expect(c.bass).toBeGreaterThanOrEqual(8);
    expect(c.bass).toBeLessThanOrEqual(9);
    expect(c.ride).toBeGreaterThan(0);
  });
});

describe('đèn nốt khớp với tiếng', () => {
  const at = (t: number, lat: number, offsetMs = 0) => {
    clock.t = 0; clock.lat = lat;
    setSyncOffsetMs(offsetMs);
    const p = new Player({ bpm: 120, tempoScale: 1, beatsPerBar: 4, pickupBeats: 0, style: 'none', melody: true, beat: false, click: false, countIn: false, loop: null, songKey: 'C' });
    p.load(Array.from({ length: 8 }, (_, i) => ({ token: '4', midi: 60, beats: 1, start: i, sectionIndex: 0, lineIndex: 0, eventIndex: i })));
    p.start(0); // nốt đầu lên lịch lúc 0,3 s, mỗi phách 0,5 s
    const tick = (p as unknown as { tick: () => void }).tick.bind(p);
    for (let s = 0; s <= t + 1e-9; s += 0.05) { clock.t = s; tick(); }
    clock.t = t;
    const b = p.currentBeat()!;
    p.stop();
    clock.lat = 0;
    setSyncOffsetMs(0);
    return b;
  };

  it('không có trễ: vị trí theo đồng hồ lên lịch', () => {
    expect(at(0.9, 0)).toBeCloseTo(1.2, 2);
  });

  it('loa trễ 200 ms: đèn lùi lại đúng 200 ms (0,4 phách ở 120 bpm), không sáng trước tiếng', () => {
    expect(at(0.9, 0.2)).toBeCloseTo(0.8, 2);
  });

  it('bù tay thêm 100 ms cho tai nghe Bluetooth báo thiếu trễ', () => {
    expect(at(0.9, 0.2, 100)).toBeCloseTo(0.6, 2);
  });

  it('máy báo độ trễ vô lý thì bỏ qua', () => {
    expect(at(0.9, 5)).toBeCloseTo(1.2, 2);
  });
});

describe('đổi tông khi phát (karaoke)', () => {
  const play = (transpose: number) => {
    melodyNotes.length = 0; bassNotes.length = 0; clock.t = 0;
    const p = new Player({ bpm: 120, tempoScale: 1, beatsPerBar: 4, pickupBeats: 0, style: 'ballad', melody: true, beat: true, click: false, countIn: false, loop: null, songKey: 'C', transpose });
    p.load(Array.from({ length: 8 }, (_, i) => ({ token: '4', midi: [60, 64, 67, 72][i % 4], beats: 1, start: i, sectionIndex: 0, lineIndex: 0, eventIndex: i })));
    p.start(0);
    const tick = (p as unknown as { tick: () => void }).tick.bind(p);
    for (let s = 0; s < 3; s += 0.05) { clock.t = s; tick(); }
    const chord = p.chordAt(0.5)?.name;
    p.stop();
    return { melody: [...new Set(melodyNotes)].sort((a, b) => a - b), bass: bassNotes.map((b) => b.midi % 12), chord };
  };

  it('giai điệu, hợp âm và bass cùng dịch, tab không đổi', () => {
    const base = play(0), up = play(2);
    expect(base.melody).toEqual([60, 64, 67, 72]);
    expect(up.melody).toEqual([62, 66, 69, 74]);
    expect(base.chord).toBe('C');
    expect(up.chord).toBe('D');
    expect(up.bass.length).toBeGreaterThan(0);
    expect(up.bass.every((pc, i) => pc === (base.bass[i] + 2) % 12)).toBe(true);
  });
});

