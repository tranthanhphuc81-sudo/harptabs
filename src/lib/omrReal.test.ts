import { describe, expect, it } from 'vitest';
import { notePitch, readSheet, toTranscription, type Gray } from './omr';
import { chordRows } from './chordOcr';
import { SHEETS } from '../test/fixtures/sheets';

/** giải nén ảnh xám mẫu (gzip, base64) */
async function sheet(name: keyof typeof SHEETS): Promise<Gray> {
  const { width, height, gz } = SHEETS[name];
  const bytes = Uint8Array.from(atob(gz), (c) => c.charCodeAt(0));
  const raw = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return { width, height, data: new Uint8Array(raw) };
}

const staffPitches = (r: ReturnType<typeof readSheet>, si: number) =>
  r.pages[0].notes.filter((n) => n.staff === si && !n.rest).map((n) => `${notePitch(n, r.keySig)}:${n.beats}`);

describe('đọc bản nhạc thật (ảnh in từ Mutopia)', () => {
  it("Soldier's Joy: nốt đầu nhóm có vạch nối (thân ngắn) không bị sót, nhận dấu nhắc lại", async () => {
    const r = readSheet([await sheet('soldiersJoy')]);
    expect(r.keySig).toBe(2);
    const st = r.pages[0].staves;
    expect(st.map((s) => (s.repeats ?? []).map((m) => m.kind).join(','))).toEqual(['start', 'end', 'start', 'end']);
    // khuông 1: nhịp lấy đà Fa# Sol, |: La Fa# Rê Fa# La Fa# Rê Fa# | La Rê Rê Đô# Si | …
    expect(staffPitches(r, 0)).toEqual([
      'F#4:0.5', 'G4:0.5',
      'A4:0.5', 'F#4:0.5', 'D4:0.5', 'F#4:0.5', 'A4:0.5', 'F#4:0.5', 'D4:0.5', 'F#4:0.5',
      'A4:1', 'D5:1', 'D5:1', 'C#5:0.5', 'B4:0.5',
      'A4:0.5', 'F#4:0.5', 'D4:0.5', 'F#4:0.5', 'A4:0.5', 'F#4:0.5', 'D4:0.5', 'F#4:0.5',
      'G4:1', 'E4:1', 'E4:1', 'F#4:0.5', 'G4:0.5',
    ]);
    expect(r.pages[0].notes.filter((n) => n.guess).length).toBeLessThanOrEqual(1);
  });

  it("Soldier's Joy: ngoặc lần 1 chỉ chơi ở lượt đầu, lượt nhắc lại nối sang lần 2", async () => {
    const r = readSheet([await sheet('soldiersJoy')]);
    const st = r.pages[0].staves;
    expect(st[1].firstEndings?.length).toBe(1);
    expect(st[3].firstEndings?.length).toBe(1);
    const t = toTranscription(r.pages, { title: '', keySig: r.keySig, timeSig: r.timeSig, tempo: 90 });
    const lines = t.sections[0].lines.map((l) => l.notes.map((n) => n.pitch).filter((p) => p !== 'R').join(' '));
    // phần A: lượt đầu kết bằng lần 1 (Rê Rê Rê Rê, Fa# Sol dẫn về), lượt nhắc lại bỏ lần 1, nối sang lần 2
    expect(lines[1].endsWith('D5 D5 D5 D5 F#4 G4')).toBe(true);
    expect(lines[3].endsWith('F#5 E5')).toBe(true);
    expect(lines[4]).toBe('D5 F#5 F#5 D5 E5');
  });

  it('tên hợp âm trên ngoặc lần 1 không bị dính vào đường kẻ của ngoặc', async () => {
    const r = readSheet([await sheet('soldiersJoy')]);
    // khuông 2: D (đầu ô 5), A (ô 7), D (trên ngoặc lần 1) — cả ba nằm trong cùng một hàng chữ
    const rows = chordRows(r.pages[0], 1);
    const clusters = (img: Gray) => {
      const xs: number[] = [];
      for (let x = 0; x < img.width; x++) {
        let ink = false;
        for (let y = 0; y < img.height && !ink; y++) ink = img.data[y * img.width + x] < 140;
        if (ink && (!xs.length || x - xs[xs.length - 1] > 40)) xs.push(x);
      }
      return xs;
    };
    expect(rows.some((row) => clusters(row.image).length >= 3)).toBe(true);
  });

  it('Red Apple Rag: thân nốt có vạch nối đứng trước nốt sau không bị đọc thành dấu giáng', async () => {
    const r = readSheet([await sheet('redAppleRag')]);
    expect(r.keySig).toBe(1);
    expect(staffPitches(r, 0)).toEqual([
      'B3:0.5', 'A3:0.5',
      'G3:0.5', 'A3:0.5', 'B3:0.5', 'C4:0.5', 'D4:0.5', 'F#4:0.5', 'G4:0.5', 'A4:0.5',
      'B4:0.5', 'D5:0.5', 'B4:0.5', 'A4:0.5', 'G4:0.5', 'E4:0.5', 'D4:0.5', 'B3:0.5',
      'C4:0.5', 'B3:0.5', 'C4:0.5', 'D4:0.5', 'E4:0.5', 'G4:0.5', 'C5:0.5', 'D5:0.5',
      'E5:0.5', 'G5:0.5', 'E5:0.5', 'D5:0.5', 'C5:2',
    ]);
    // cả bài không có nốt giáng nào
    expect(r.pages[0].notes.filter((n) => !n.rest && notePitch(n, r.keySig).includes('b'))).toEqual([]);
  });

  it('Good King Wenceslas (hợp xướng): chỉ đọc khuông trên của mỗi hệ, giữ hoá biểu 3 thăng', async () => {
    const r = readSheet([await sheet('goodKing')]);
    expect(r.keySig).toBe(3);
    // 2 hệ × (khuông Sol + khuông Fa) → chỉ 2 khuông giai điệu
    expect(r.pages[0].staves).toHaveLength(2);
    const ps = r.pages[0].notes.filter((n) => !n.rest).map((n) => notePitch(n, r.keySig));
    expect(ps.filter((p) => /^[FCG]\d/.test(p))).toEqual([]);
    expect(staffPitches(r, 0).slice(0, 3)).toEqual(['A4:1', 'A4:1', 'A4:1']);
  });

  it('Bach Cello Suite 3 (khoá Fa): dấu bình sau Si giáng không thành Si thăng', async () => {
    const r = readSheet([await sheet('celloBars70to75')]);
    expect(r.pages[0].staves.every((s) => s.clef === 'F')).toBe(true);
    const ps = r.pages[0].notes.filter((n) => !n.rest).map((n) => notePitch(n, r.keySig));
    expect(ps.filter((p) => /^(B#|E#|Cb|Fb)/.test(p))).toEqual([]);
    expect(ps).toContain('Bb3');
    expect(ps).toContain('B3');
  });
});
