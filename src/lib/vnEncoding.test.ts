import { describe, expect, it } from 'vitest';
import { decodeVn, detectVn, fixGarbled, vnDecoder } from './vnEncoding';
import { parseMidi } from './musicFile';

/** chuỗi gõ theo kiểu "vỡ font" (mỗi ký tự = một byte Latin-1) → byte */
const bytes = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe('bảng mã chữ Việt cũ', () => {
  it('VNI: chữ cái + byte dấu', () => {
    expect(decodeVn(bytes('Toâi ñi hoïc'), 'vni')).toBe('Tôi đi học');
    expect(decodeVn(bytes('Ngöôøi Vieät Nam'), 'vni')).toBe('Người Việt Nam');
    expect(decodeVn(bytes('Ñaø Naüng, Huyeàn, quyù, ngaén'), 'vni')).toBe('Đà Nẵng, Huyền, quý, ngắn');
    expect(decodeVn(bytes('VIEÄT NAM ÔI'), 'vni')).toBe('VIỆT NAM ƠI');
    expect(decodeVn(bytes('mình, chæ, ñoù, ò, kæ nieäm'), 'vni')).toBe('mình, chỉ, đó, ị, kỉ niệm');
  });

  it('TCVN3 (ABC): mỗi chữ có dấu một byte', () => {
    expect(decodeVn(bytes('T«i ®i häc'), 'tcvn3')).toBe('Tôi đi học');
    expect(decodeVn(bytes('Ng­êi ViÖt Nam'), 'tcvn3')).toBe('Người Việt Nam');
    expect(decodeVn(bytes('§µ N½ng'), 'tcvn3')).toBe('Đà Nẵng');
  });

  it('tự đoán bảng mã theo cả file', () => {
    expect(detectVn([bytes('Ngöôøi'), bytes('Vieät'), bytes('Nam'), bytes('ôi')])).toBe('vni');
    expect(detectVn([bytes('Ng­êi'), bytes('ViÖt'), bytes('Nam'), bytes('¬i')])).toBe('tcvn3');
    expect(detectVn([new TextEncoder().encode('Người Việt Nam ơi')])).toBe('utf8');
    expect(detectVn([bytes('Hello world')])).toBe('utf8');
  });

  it('lời tách từng ký tự: dấu VNI ở sự kiện sau chữ cái vẫn ghép đúng', () => {
    const dec = vnDecoder('vni');
    const parts = [...'Ngöôøi'].map((c) => dec(bytes(c)));
    expect(parts.join('').normalize('NFC')).toBe('Người');
    // phát hiện được dù mỗi đoạn chỉ một ký tự
    expect(detectVn([...'Toâi ñi hoïc. Ngöôøi Vieät Nam'].map(bytes))).toBe('vni');
  });
});

describe('nhập MIDI karaoke VNI / TCVN3', () => {
  const Q = 480;
  const vlq = (v: number) => { const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };
  function file(words: Uint8Array[]): Uint8Array {
    const ev: number[] = [];
    let last = 0;
    words.forEach((w, i) => {
      const t = (i + 1) * Q;
      ev.push(...vlq(t - last), 0xff, 0x05, ...vlq(w.length), ...w, 0, 0x90, 60 + (i % 5), 90);
      ev.push(...vlq(Q - 20), 0x80, 60 + (i % 5), 0);
      last = t + Q - 20;
    });
    ev.push(0, 0xff, 0x2f, 0);
    const head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (Q >> 8) & 0xff, Q & 0xff];
    return new Uint8Array([...head, 0x4d, 0x54, 0x72, 0x6b, 0, 0, (ev.length >> 8) & 0xff, ev.length & 0xff, ...ev]);
  }
  const lyricsOf = (f: ReturnType<typeof parseMidi>) =>
    f.transcribe(f.melodyPart).sections.flatMap((s) => s.lines.flatMap((l) => l.notes)).map((n) => n.lyric).filter(Boolean);

  it('lời VNI theo âm tiết: tự nhận, đọc đúng dấu; chọn tay bảng mã khác thì đọc theo đó', () => {
    const words = ['Ngöôøi', 'Vieät', 'Nam', 'ôi', 'Toâi', 'ñi', 'hoïc', 'veà', 'queâ'].map(bytes);
    const f = parseMidi(file(words));
    expect(f.encoding).toBe('vni');
    expect(lyricsOf(f)).toEqual(['Người', 'Việt', 'Nam', 'ơi', 'Tôi', 'đi', 'học', 'về', 'quê']);
    expect(lyricsOf(parseMidi(file(words), '', { encoding: 'latin1' }))[0]).toBe('Ngöôøi');
  });

  it('lời TCVN3 tách từng ký tự', () => {
    const text = 'T«i ®i häc ë ViÖt Nam';
    const chars = [...text].map(bytes);
    const f = parseMidi(file(chars));
    expect(f.encoding).toBe('tcvn3');
    expect(lyricsOf(f)).toEqual(['Tôi', 'đi', 'học', 'ở', 'Việt', 'Nam']);
  });
});

describe('sửa chữ đã lưu bị vỡ dấu', () => {
  it('nhận ra VNI / TCVN3 trong tab đã lưu, chỉ đổi phần chữ', () => {
    const body = '4 -4 5 6\nToâi ñi hoïc veà\n6 -6 7\nNgöôøi Vieät Nam';
    const f = fixGarbled(body, 'Queâ höông')!;
    expect(f.enc).toBe('vni');
    expect(f.fix(body)).toBe('4 -4 5 6\nTôi đi học về\n6 -6 7\nNgười Việt Nam');
    expect(f.fix('Queâ höông')).toBe('Quê hương');
    expect(fixGarbled('-4 5\nT«i ®i häc ë ViÖt Nam')!.fix('T«i ®i häc')).toBe('Tôi đi học');
  });

  it('chữ Việt đúng, chữ không dấu, chữ Tây: không đụng tới', () => {
    expect(fixGarbled('4 5\nTôi đi học về quê hương, Người Việt Nam ơi')).toBeNull();
    expect(fixGarbled('4 5\nHappy birthday to you')).toBeNull();
    expect(fixGarbled('Café crème à la française')).toBeNull();
    // dấu chấm giữa / độ trong tên tác giả, lời tiếng Anh: không phải lỗi font
    expect(fixGarbled('Amazing grace, how sweet the sound', 'Amazing Grace', 'John Newton (1779) · giai điệu New Britain')).toBeNull();
  });
});
