import { describe, expect, it } from 'vitest';
import { buildArrangement, gmVoice, keyShift, matchMidiToTab } from './midiArrange';
import { parseMidi } from './musicFile';
import { aiToTab } from './ai';
import { flatten, parseTab } from './tabText';

const Q = 480;
function midiFile(tracks: number[][]): Uint8Array {
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (Q >> 8) & 0xff, Q & 0xff];
  for (const t of tracks) out.push(0x4d, 0x54, 0x72, 0x6b, (t.length >>> 24) & 0xff, (t.length >> 16) & 0xff, (t.length >> 8) & 0xff, t.length & 0xff, ...t);
  return new Uint8Array(out);
}
const vlq = (v: number) => { const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };
const text = (s: string) => [...new TextEncoder().encode(s)];
function track(events: [number, number[]][]): number[] {
  const out: number[] = [];
  let last = 0;
  for (const [t, ev] of [...events].sort((a, b) => a[0] - b[0])) { out.push(...vlq(t - last), ...ev); last = t; }
  out.push(0, 0xff, 0x2f, 0);
  return out;
}
const note = (ch: number, beat: number, len: number, n: number, vel = 90): [number, number[]][] =>
  [[Math.round(beat * Q), [0x90 | ch, n, vel]], [Math.round((beat + len) * Q) - 10, [0x80 | ch, n, 0]]];

// bài karaoke: dạo 8 phách (piano + bass + trống), giọng hát vào ở phách 8 với lời
const meta = track([[0, [0xff, 0x58, 4, 4, 2, 24, 8]], [0, [0xff, 0x51, 3, 0x07, 0xa1, 0x20]]]);
const words = ['Một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín', 'mười'];
// 24 nốt (đủ dài để dò theo chuỗi cao độ)
const tune = [64, 65, 67, 69, 67, 65, 64, 62, 60, 62, 64, 67, 72, 71, 69, 67, 65, 64, 62, 64, 65, 62, 60, 60];
const vocal = track([
  [0, [0xff, 0x03, 5, ...text('Vocal')]],
  ...tune.flatMap((n, i) => [...note(0, 8 + i, 1, n), [Math.round((8 + i) * Q), [0xff, 0x05, ...vlq(text(words[i % words.length]).length), ...text(words[i % words.length])]] as [number, number[]]]),
]);
const piano = track([[0, [0xc1, 0]], ...[0, 4, 8, 12, 16, 20, 24, 28].flatMap((b) => [48, 52, 55].flatMap((n) => note(1, b, 4, n, 60)))]);
const bassTr = track([[0, [0xc2, 33]], ...[0, 4, 8, 12, 16, 20, 24, 28].flatMap((b) => note(2, b, 2, 36))]);
const drums = track([...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].flatMap((b) => note(9, b, 0.25, b % 2 ? 38 : 36))]);
const bytes = midiFile([meta, vocal, piano, bassTr, drums]);

/** nhập như trang Nhập bài: bè hát → tab cho kèn */
function importTab(target: 'auto' | 'C' | 'A') {
  const f = parseMidi(bytes);
  const tr = f.transcribe(f.melodyPart);
  const conv = aiToTab(tr, target, true);
  const flat = flatten(parseTab(conv.body, conv.harpKey, conv.harpType));
  return { f, tr, conv, flat };
}

describe('bản phối MIDI gốc', () => {
  it('nhạc cụ GM → nhạc cụ gần nhất; dịch giọng gọn', () => {
    expect(gmVoice(0)).toBe('piano');
    expect(gmVoice(25)).toBe('guitar');
    expect(gmVoice(33)).toBe('bass');
    expect(gmVoice(48)).toBe('violin');
    expect(gmVoice(73)).toBe('flute');
    expect(gmVoice(120)).toBeNull();
    expect(keyShift(12)).toBe(0);
    expect(keyShift(7)).toBe(-5);
    expect(keyShift(-3)).toBe(-3);
  });

  it('bỏ bè hát, giữ piano / bass / trống, đoạn dạo nằm trước phách 0 của tab', () => {
    const { f, tr, conv, flat } = importTab('auto');
    expect(f.parts.find((p) => p.id === f.melodyPart)?.name).toBe('Vocal');
    expect(tr.startBeat).toBe(8);
    expect(flat[0].start).toBe(0);
    const a = buildArrangement(bytes, { melodyPart: f.melodyPart, startBeat: tr.startBeat!, shift: conv.fit.shift });
    expect(a.parts.map((p) => p.voice).sort()).toEqual(['bass', 'drum', 'piano']);
    expect(a.start).toBe(-8);
    expect(a.end).toBeGreaterThan(flat[flat.length - 1].start);
    const ks = keyShift(conv.fit.shift);
    expect(a.notes.find((n) => n.voice === 'bass')!.midi).toBe(36 + ks);
    expect(a.notes.find((n) => n.voice === 'drum')!.midi).toBe(36);
  });

  it('nối lại file cho bài đã nhập trước: tìm đúng bè hát, chỗ bắt đầu, độ dịch giọng', () => {
    for (const target of ['auto', 'A'] as const) {
      const { f, tr, conv, flat } = importTab(target);
      expect(matchMidiToTab(bytes, flat)).toEqual({ melodyPart: f.melodyPart, startBeat: tr.startBeat, shift: conv.fit.shift });
    }
    // tab bài khác: không nối
    const other = flatten(parseTab('4 5 6 -6 6 5 4 -4 4 -4', 'C', 'diatonic'));
    expect(matchMidiToTab(bytes, other)).toBeNull();
  });

  it('đổi nhạc cụ / tắt từng bè: trống chỉ tắt được, bè khác đổi sang nhạc cụ bất kỳ', () => {
    const { f, tr, conv } = importTab('auto');
    const link = { melodyPart: f.melodyPart, startBeat: tr.startBeat!, shift: conv.fit.shift };
    const auto = buildArrangement(bytes, link);
    const piano = auto.parts.find((p) => p.voice === 'piano')!, drum = auto.parts.find((p) => p.voice === 'drum')!, bass = auto.parts.find((p) => p.voice === 'bass')!;
    const a = buildArrangement(bytes, link, { [piano.id]: 'guitar', [drum.id]: 'piano' as never, [bass.id]: 'off' });
    expect(a.notes.some((n) => n.voice === 'piano')).toBe(false);
    expect(a.notes.filter((n) => n.voice === 'guitar').length).toBe(piano.notes);
    expect(a.notes.filter((n) => n.voice === 'drum').length).toBe(drum.notes);
    expect(a.notes.some((n) => n.voice === 'bass')).toBe(false);
    expect(a.parts.map((p) => [p.voice, p.chosen])).toEqual(expect.arrayContaining([['piano', 'guitar'], ['bass', 'off'], ['drum', 'drum']]));
  });

  it('nối lại bài nhập bằng bản app cũ / đã sửa tab: dò theo chuỗi cao độ, tìm đúng chỗ bắt đầu', () => {
    const { f, tr, conv } = importTab('auto');
    // người dùng xoá 2 nốt đầu và sửa một nốt giữa bài: vị trí mọi nốt lệch 2 phách so với lúc nhập
    const body = conv.body;
    const flat = flatten(parseTab(body, conv.harpKey, conv.harpType));
    const edited = flat.slice(2).map((e, i) => ({ ...e, start: e.start - 2, midi: i === 4 ? (e.midi ?? 0) + 1 : e.midi }));
    const link = matchMidiToTab(bytes, edited)!;
    expect(link).not.toBeNull();
    expect(link.melodyPart).toBe(f.melodyPart);
    expect(link.startBeat).toBeCloseTo(tr.startBeat! + 2, 5);
    expect(keyShift(link.shift)).toBe(keyShift(conv.fit.shift));
  });
});

