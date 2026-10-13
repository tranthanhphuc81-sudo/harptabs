import { describe, expect, it } from 'vitest';
import { Gray, keyName, notePitch, readSheet, toTranscription } from './omr';

/** Vẽ một khuông nhạc giả lập: khoá (khối cao), nốt, vạch nhịp — đủ để kiểm tra các luật đọc */
type Sym = { kind: 'note'; step: number; beats: 0.5 | 1 | 1.5 | 2 | 3 | 4; sharp?: boolean } | { kind: 'bar' };

function render(symbols: Sym[], S = 14): Gray {
  const width = 80 + symbols.length * 4 * S + 40, height = 14 * S;
  const data = new Uint8Array(width * height).fill(255);
  const dot = (x: number, y: number) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < width && y < height) data[y * width + x] = 0;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number) => { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) dot(x, y); };
  const top = 5 * S, bottom = top + 4 * S;
  const right = width - 20;
  for (let i = 0; i < 5; i++) rect(20, top + i * S - 1, right, top + i * S + 1);
  // "khoá Sol": khối cao 7 khe
  for (let y = top - 1.5 * S; y < bottom + 1.5 * S; y++) for (let x = 26; x < 26 + 2 * S; x++) {
    const dx = (x - 26 - S) / S, dy = (y - (top + 2 * S)) / (3.5 * S);
    if (Math.abs(dx * dx + dy * dy - 0.8) < 0.25) dot(x, y);
  }
  let x = 30 + 3.5 * S;
  for (const sym of symbols) {
    if (sym.kind === 'bar') { rect(Math.round(x), top - 1, Math.round(x) + 2, bottom + 1); x += 1.5 * S; continue; }
    const cyy = bottom - sym.step * (S / 2);
    const hollow = sym.beats >= 2;
    if (sym.sharp) x += 1.5 * S; // chừa chỗ cho dấu thăng
    if (sym.beats === 4) {
      // nốt tròn: bầu dục rộng, lòng nghiêng, không thân
      for (let yy = -S; yy <= S; yy++) for (let xx = -S; xx <= S; xx++) {
        const u = xx / (0.85 * S), v = yy / (0.5 * S);
        const iu = (xx * 0.6 - yy * 0.8) / (0.4 * S), iv = (xx * 0.8 + yy * 0.6) / (0.24 * S);
        if (u * u + v * v <= 1 && iu * iu + iv * iv > 1) dot(x + xx, cyy + yy);
      }
      x += 4 * S; continue;
    }
    if (sym.sharp) {
      // dấu thăng: hai nét dọc + hai nét ngang dày, đứng trước đầu nốt
      const ax = x - 1.9 * S;
      rect(Math.round(ax - 0.2 * S), Math.round(cyy - 1.4 * S), Math.round(ax - 0.2 * S) + 2, Math.round(cyy + 1.3 * S));
      rect(Math.round(ax + 0.25 * S), Math.round(cyy - 1.5 * S), Math.round(ax + 0.25 * S) + 2, Math.round(cyy + 1.2 * S));
      for (const dy of [-0.45, 0.45]) for (let t = -0.45 * S; t < 0.6 * S; t++) for (let k = 0; k < 4; k++) dot(ax + t, cyy + dy * S - t * 0.3 + k);
    }
    // đầu nốt hình bầu dục hơi nghiêng
    for (let yy = -S; yy <= S; yy++) for (let xx = -S; xx <= S; xx++) {
      const u = (xx * 0.95 + yy * 0.3) / (0.66 * S), v = (-xx * 0.3 + yy * 0.95) / (0.45 * S);
      // nốt trắng như bản in: vành dày hai bên, lòng là khe nghiêng
      const iu = (xx * 0.8 - yy * 0.6) / (0.4 * S), iv = (xx * 0.6 + yy * 0.8) / (0.17 * S);
      if (u * u + v * v <= 1 && !(hollow && iu * iu + iv * iv <= 1)) dot(x + xx, cyy + yy);
    }
    const up = sym.step < 4;
    const sx = up ? Math.round(x + 0.62 * S) : Math.round(x - 0.66 * S);
    const tip = up ? cyy - 3.5 * S : cyy + 3.5 * S;
    rect(sx, Math.round(Math.min(cyy, tip)), sx + 2, Math.round(Math.max(cyy, tip)));
    if (sym.beats === 0.5) {
      // móc: nét chéo dày đi từ đầu thân về bên phải
      for (let t = 0; t < 1.6 * S; t++) for (let k = 0; k < 4; k++) for (let j = 0; j < 3; j++) dot(sx + 1 + t * 0.55 + j, (up ? tip + t : tip - t) + k);
    }
    if (sym.beats === 1.5 || sym.beats === 3) {
      const dy = sym.step % 2 === 0 ? -S / 2 : 0; // nốt trên dòng kẻ: chấm ở khe trên
      for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) if (xx * xx + yy * yy <= 7) dot(x + 1.3 * S + xx, cyy + dy + yy);
    }
    x += 4 * S;
  }
  return { width, height, data };
}

const N = (step: number, beats: 0.5 | 1 | 1.5 | 2 | 3 | 4 = 1, sharp = false): Sym => ({ kind: 'note', step, beats, sharp });
const BAR: Sym = { kind: 'bar' };

describe('đọc khuông nhạc (OMR)', () => {
  it('tên nốt theo bậc, hoá biểu và dấu hoá riêng', () => {
    const n = (step: number, accidental: -1 | 0 | 1 | null = null) => ({ step, accidental, rest: false });
    expect(notePitch(n(0), 0)).toBe('E4');
    expect(notePitch(n(-2), 0)).toBe('C4');
    expect(notePitch(n(5), 0)).toBe('C5');
    expect(notePitch(n(8), 0)).toBe('F5');
    expect(notePitch(n(1), 1)).toBe('F#4');
    expect(notePitch(n(4), -1)).toBe('Bb4');
    expect(notePitch(n(4), -1 + 0)).toBe('Bb4');
    expect(notePitch(n(4, 0), -1)).toBe('B4');
    expect(notePitch(n(2, 1), 0)).toBe('G#4');
    expect(notePitch({ step: 4, accidental: null, rest: true }, 0)).toBe('R');
    expect(keyName(0)).toBe('C');
    expect(keyName(1)).toBe('G');
    expect(keyName(-2)).toBe('Bb');
  });

  it('đọc đúng cao độ, kể cả nốt trên dòng kẻ phụ', () => {
    const steps = [-2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8];
    const r = readSheet([render(steps.map((s) => N(s)))]);
    expect(r.pages).toHaveLength(1);
    expect(r.pages[0].notes.filter((n) => !n.rest).map((n) => notePitch(n, 0)))
      .toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5']);
  });

  it('đọc trường độ: nốt đen, móc đơn, nốt trắng, chấm dôi; vạch nhịp', () => {
    const r = readSheet([render([
      N(2), N(3, 0.5), N(4, 0.5), N(5, 2), BAR,
      N(4, 1.5), N(3, 0.5), N(2, 2), BAR,
      N(1, 3), N(0), BAR,
      N(2), N(2), N(3), N(4),
    ])]);
    const notes = r.pages[0].notes.filter((n) => !n.rest);
    expect(notes.map((n) => `${notePitch(n, 0)}:${n.beats}`)).toEqual([
      'G4:1', 'A4:0.5', 'B4:0.5', 'C5:2',
      'B4:1.5', 'A4:0.5', 'G4:2',
      'F4:3', 'E4:1',
      'G4:1', 'G4:1', 'A4:1', 'B4:1',
    ]);
    expect(r.pages[0].staves[0].bars).toHaveLength(3);
    expect(r.meter).toBe(4);
    expect(r.timeSig).toBe('4/4');
  });

  it('ô nhịp thiếu phách được chèn dấu lặng', () => {
    const r = readSheet([render([N(2), N(2), N(2), N(2), BAR, N(3), N(3), N(3), BAR, N(4), N(4), N(4), N(4), BAR, N(2, 2), N(2, 2)])]);
    const seq = r.pages[0].notes.map((n) => `${notePitch(n, 0)}:${n.beats}`);
    expect(seq.slice(4, 8)).toEqual(['A4:1', 'A4:1', 'A4:1', 'R:1']);
  });

  it('nốt tròn và dấu thăng giữa bài (giữ hiệu lực đến hết ô nhịp)', () => {
    const r = readSheet([render([N(2), N(3), N(4), N(5), BAR, N(1, 1, true), N(2), N(1), N(0), BAR, N(1), N(2), N(3), N(4), BAR, N(3, 4)])]);
    expect(r.pages[0].notes.map((n) => `${notePitch(n, 0)}:${n.beats}`)).toEqual([
      'G4:1', 'A4:1', 'B4:1', 'C5:1',
      'F#4:1', 'G4:1', 'F#4:1', 'E4:1',
      'F4:1', 'G4:1', 'A4:1', 'B4:1',
      'A4:4',
    ]);
  });

  it('không thấy khuông nhạc thì không bịa nốt', () => {
    const blank: Gray = { width: 200, height: 100, data: new Uint8Array(200 * 100).fill(255) };
    const r = readSheet([blank]);
    expect(r.pages).toHaveLength(0);
  });

  it('xuất sang cấu trúc dùng chung để chuyển tab', () => {
    const r = readSheet([render([N(-2), N(0), N(2), N(3)])]);
    const t = toTranscription(r.pages, { title: 'Thử', keySig: 0, timeSig: '4/4', tempo: 90 });
    expect(t.sections[0].lines[0].notes.map((n) => n.pitch)).toEqual(['C4', 'E4', 'G4', 'A4']);
    expect(t.songKey).toBe('C');
    expect(t.timeSignature).toBe('4/4');
  });
});
