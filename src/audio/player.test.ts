import { beforeEach, describe, expect, it, vi } from 'vitest';

// âm thanh giả: đồng hồ do test điều khiển, mọi tiếng chỉ được đếm
const clock = { t: 0 };
const calls: Record<string, number> = {};
const count = (name: string) => () => { calls[name] = (calls[name] ?? 0) + 1; };
vi.mock('./engine', () => ({
  audio: () => ({ currentTime: clock.t }),
  applyMix: () => {},
  setHumanVelocity: () => {},
  playTone: count('melody'),
  bass: count('bass'),
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
  crash: count('crash'),
  tom: count('tom'),
  click: count('click'),
}));

const { Player } = await import('./player');

/** chạy bộ phát `seconds` giây (đồng hồ giả), trả về số tiếng mỗi loại */
function run(style: string, beatsPerBar: number, seconds = 4) {
  for (const k of Object.keys(calls)) delete calls[k];
  clock.t = 0;
  const p = new Player({ bpm: 120, tempoScale: 1, beatsPerBar, pickupBeats: 0, style: style as never, melody: true, beat: true, click: false, countIn: false, loop: null, songKey: 'C' });
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

  it('jazz: bass walking mỗi phách một nốt', () => {
    const c = run('jazz', 4, 4);
    expect(c.bass).toBeGreaterThanOrEqual(8);
    expect(c.bass).toBeLessThanOrEqual(9);
    expect(c.ride).toBeGreaterThan(0);
  });
});
