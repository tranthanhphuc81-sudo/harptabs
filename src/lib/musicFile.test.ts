import { describe, expect, it } from 'vitest';
import { aiToTab } from './ai';
import { parseMidi, parseMusicXml, parseXml, readMusicFile } from './musicFile';

const notesOf = (t: ReturnType<ReturnType<typeof parseMusicXml>['transcribe']>) =>
  t.sections.flatMap((s) => s.lines.flatMap((l) => l.notes)).map((n) => `${n.pitch}:${+n.beats.toFixed(3)}${n.lyric ? `:${n.lyric}` : ''}`);

// ───── MusicXML mẫu: Sol trưởng 3/4, nhịp lấy đà, luyến qua vạch nhịp, hợp âm, lặp có khung 1. 2., liên ba
const note = (step: string, oct: number, dur: number, extra = '') =>
  `<note><pitch><step>${step[0]}</step>${step[1] === '#' ? '<alter>1</alter>' : ''}<octave>${oct}</octave></pitch><duration>${dur}</duration><voice>1</voice>${extra}</note>`;
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="4.0">
  <work><work-title>Ru em &amp; mẹ</work-title></work>
  <identification><creator type="composer">Trần Văn A</creator></identification>
  <part-list><score-part id="P1"><part-name>Voice</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list>
  <part id="P1">
    <measure number="0" implicit="yes">
      <attributes><divisions>6</divisions><key><fifths>1</fifths></key><time><beats>3</beats><beat-type>4</beat-type></time></attributes>
      <direction><sound tempo="96"/></direction>
      ${note('D', 4, 6, '<lyric><syllabic>single</syllabic><text>Ru</text></lyric>')}
    </measure>
    <measure number="1">
      <barline location="left"><repeat direction="forward"/></barline>
      ${note('G', 4, 6, '<lyric><syllabic>begin</syllabic><text>ầu</text></lyric>')}
      ${note('B', 4, 6, '')}<note><chord/><pitch><step>D</step><octave>5</octave></pitch><duration>6</duration><voice>1</voice></note>
      ${note('A', 4, 6, '<tie type="start"/><lyric><syllabic>end</syllabic><text>ơ</text></lyric>')}
    </measure>
    <measure number="2">
      <barline location="left"><ending number="1" type="start"/></barline>
      ${note('A', 4, 6, '<tie type="stop"/>')}<note><rest/><duration>6</duration><voice>1</voice></note>${note('F#', 4, 6)}
      <barline location="right"><ending number="1" type="stop"/><repeat direction="backward"/></barline>
    </measure>
    <measure number="3">
      <barline location="left"><ending number="2" type="start"/></barline>
      ${note('E', 5, 4)}${note('D', 5, 4)}${note('C', 5, 4)}${note('B', 4, 6)}
      <backup><duration>18</duration></backup>
      <note><pitch><step>G</step><octave>3</octave></pitch><duration>18</duration><voice>2</voice></note>
      <barline location="right"><ending number="2" type="stop"/></barline>
    </measure>
  </part>
  <part id="P2"><measure number="0" implicit="yes"><attributes><divisions>1</divisions></attributes>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>1</duration><voice>1</voice></note></measure></part>
</score-partwise>`;

describe('nhập MusicXML', () => {
  it('đọc XML: thuộc tính, ký tự thoát, phần tử tự đóng', () => {
    const d = parseXml('<a x="1 &lt; 2"><b/>chữ &amp; số<c y=\'z\'>ok</c></a>');
    const a = d.children[0];
    expect(a.attrs.x).toBe('1 < 2');
    expect(a.children.map((c) => c.name)).toEqual(['b', 'c']);
    expect(a.text).toBe('chữ & số');
    expect(a.children[1].text).toBe('ok');
  });

  it('tên bài, tác giả, giọng, nhịp, tốc độ, nhịp lấy đà; chọn bè giọng hát', () => {
    const f = parseMusicXml(XML, 'file');
    expect(f.title).toBe('Ru em & mẹ');
    expect(f.artist).toBe('Trần Văn A');
    expect(f.melodyPart).toBe('P1');
    const t = f.transcribe(f.melodyPart);
    expect(t.songKey).toBe('G');
    expect(t.timeSignature).toBe('3/4');
    expect(t.tempo).toBe(96);
    expect(t.pickupBeats).toBe(1);
  });

  it('mở dấu lặp có khung 1. 2., gộp luyến, hợp âm lấy nốt cao, bỏ bè 2, liên ba, lời có gạch nối', () => {
    const f = parseMusicXml(XML);
    expect(notesOf(f.transcribe('P1'))).toEqual([
      'D4:1:Ru',
      // lượt 1: ô 1 + khung "1."
      'G4:1:ầu-', 'D5:1', 'A4:2:ơ', 'R:1', 'F#4:1',
      // lượt 2: ô 1 + khung "2." (liên ba 3 nốt móc đơn = 1 phách)
      'G4:1:ầu-', 'D5:1', 'A4:1:ơ', 'E5:0.667', 'D5:0.667', 'C5:0.667', 'B4:1',
    ]);
  });

  it('chuyển thành tab harmonica', () => {
    const t = parseMusicXml(XML).transcribe('P1');
    const c = aiToTab(t, 'G', false);
    expect(c.harpKey).toBe('G');
    expect(c.fit.stats.unplayable).toBe(0);
    expect(c.body).toContain('Ru');
  });

  it('.mxl (zip) đọc được', async () => {
    const enc = new TextEncoder();
    const container = enc.encode('<?xml version="1.0"?><container><rootfiles><rootfile full-path="score.xml"/></rootfiles></container>');
    // nén deflate như MuseScore
    const deflated = new Uint8Array(await new Response(new Blob([enc.encode(XML)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const zip = makeZip([['META-INF/container.xml', container, 0], ['score.xml', deflated, 8]]);
    const f = await readMusicFile(zip, 'Ru em.mxl');
    expect(f.kind).toBe('musicxml');
    expect(f.title).toBe('Ru em & mẹ');
  });

  it('file lạ thì báo lỗi dễ hiểu', async () => {
    await expect(readMusicFile(new TextEncoder().encode('hello'), 'x.txt')).rejects.toThrow(/MusicXML|MIDI/);
  });
});

/** zip tối giản (CRC để 0: bộ đọc không kiểm) */
function makeZip(entries: [string, Uint8Array, number][]): Uint8Array {
  const enc = new TextEncoder();
  const parts: number[] = [], central: number[] = [];
  const u16 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff);
  const u32 = (a: number[], v: number) => a.push(v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >>> 24) & 0xff);
  for (const [name, data, method] of entries) {
    const nb = enc.encode(name), off = parts.length;
    u32(parts, 0x04034b50); u16(parts, 20); u16(parts, 0); u16(parts, method); u32(parts, 0); u32(parts, 0);
    u32(parts, data.length); u32(parts, 0); u16(parts, nb.length); u16(parts, 0); parts.push(...nb, ...data);
    u32(central, 0x02014b50); u16(central, 20); u16(central, 20); u16(central, 0); u16(central, method); u32(central, 0); u32(central, 0);
    u32(central, data.length); u32(central, 0); u16(central, nb.length); u16(central, 0); u16(central, 0); u16(central, 0); u16(central, 0); u32(central, 0); u32(central, off);
    central.push(...nb);
  }
  const eocd: number[] = [];
  u32(eocd, 0x06054b50); u16(eocd, 0); u16(eocd, 0); u16(eocd, entries.length); u16(eocd, entries.length); u32(eocd, central.length); u32(eocd, parts.length); u16(eocd, 0);
  return new Uint8Array([...parts, ...central, ...eocd]);
}

// ───── MIDI mẫu
function midiFile(tracks: number[][], tpq = 480): Uint8Array {
  const out = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (tpq >> 8) & 0xff, tpq & 0xff];
  for (const t of tracks) out.push(0x4d, 0x54, 0x72, 0x6b, (t.length >>> 24) & 0xff, (t.length >> 16) & 0xff, (t.length >> 8) & 0xff, t.length & 0xff, ...t);
  return new Uint8Array(out);
}
const vlq = (v: number) => { const b = [v & 0x7f]; while ((v >>= 7)) b.unshift((v & 0x7f) | 0x80); return b; };
const text = (s: string) => [...new TextEncoder().encode(s)];
/** sự kiện: [tick tuyệt đối, bytes] → track (delta time) */
function track(events: [number, number[]][]): number[] {
  const out: number[] = [];
  let last = 0;
  for (const [t, ev] of [...events].sort((a, b) => a[0] - b[0])) { out.push(...vlq(t - last), ...ev); last = t; }
  out.push(0, 0xff, 0x2f, 0);
  return out;
}

describe('nhập MIDI', () => {
  const Q = 480;
  // track đầu: tên bài, 3/4, 120 bpm, Fa trưởng (1 giáng)
  const meta = track([[0, [0xff, 0x03, ...vlq(text('Bài thử').length), ...text('Bài thử')]], [0, [0xff, 0x58, 4, 3, 2, 24, 8]], [0, [0xff, 0x51, 3, 0x07, 0xa1, 0x20]], [0, [0xff, 0x59, 2, 0xff, 0]]]);
  // đệm piano: hợp âm thấp, dài
  const piano = track([0, 3, 6].flatMap((bar) => [48, 52, 55].flatMap((n): [number, number[]][] => [[bar * 3 * Q, [0x91, n, 70]], [(bar + 1) * 3 * Q - 10, [0x81, n, 0]]])));
  // giai điệu: nhịp lấy đà 1 phách (bắt đầu phách 3 ô 1), lệch giờ ±15 tick như người chơi thật, có lời
  const mel: [number, number, number][] = [[2 * Q + 12, Q - 30, 72], [3 * Q - 8, Q, 77], [4 * Q + 5, Q / 2, 76], [4.5 * Q, Q / 2, 74], [5 * Q, 2 * Q - 20, 70], [7 * Q + 160, Q / 3, 69], [7 * Q + 320, Q / 3, 70], [7 * Q + 480 - 2, Q / 3, 72]];
  const lyric = ['Ngủ', 'đi', 'con', 'ơi'];
  const melody = track([
    [0, [0xff, 0x03, 6, ...text('Melody')]],
    ...mel.flatMap(([t, d, n], i): [number, number[]][] => [[t, [0x90, n, 90]], [t + d, [0x80, n, 0]], ...(lyric[i] ? [[t, [0xff, 0x05, ...vlq(text(lyric[i]).length), ...text(lyric[i])]] as [number, number[]]] : [])]),
  ]);
  const file = midiFile([meta, piano, melody]);

  it('chọn đúng track giai điệu, đọc nhịp, tốc độ, giọng', () => {
    const f = parseMidi(file, 'x');
    expect(f.title).toBe('Bài thử');
    expect(f.parts).toHaveLength(2);
    expect(f.parts.find((p) => p.id === f.melodyPart)?.name).toBe('Melody');
    const t = f.transcribe(f.melodyPart);
    expect(t.timeSignature).toBe('3/4');
    expect(t.tempo).toBe(120);
    expect(t.songKey).toBe('F');
  });

  it('lượng tử hoá cả liên ba, nhịp lấy đà, gắn lời', () => {
    const f = parseMidi(file);
    const t = f.transcribe(f.melodyPart);
    expect(t.pickupBeats).toBe(1);
    expect(notesOf(t)).toEqual([
      'C5:1:Ngủ', 'F5:1:đi', 'E5:0.5:con', 'D5:0.5:ơi', 'Bb4:2', 'R:0.333', 'A4:0.333', 'Bb4:0.333', 'C5:0.333',
    ]);
  });

  it('đọc qua readMusicFile theo nội dung file', async () => {
    const f = await readMusicFile(file, 'bai-thu.mid');
    expect(f.kind).toBe('midi');
  });

  it('file karaoke: đánh lại cùng phím, nốt nhả sớm, lời tách từng ký tự', () => {
    // "Tuổi đời chân đơn côi": mỗi ký tự lời là một sự kiện; nốt 70 đánh lại khi chưa nhả;
    // các nốt chỉ kêu 1/4 phách; chữ cuối câu nhả sớm rồi lặng 3 phách
    const ev: [number, number[]][] = [[0, [0xff, 0x03, 6, ...text('Melody')]]];
    // lùi 3 phách: sự kiện chữ ở tick 0 là phần đầu file (tên bài…), bị bỏ qua
    const O = 3;
    const note = (beat: number, len: number, n: number) => { ev.push([(beat + O) * Q, [0x90, n, 90]]); if (len) ev.push([(beat + O + len) * Q, [0x80, n, 0]]); };
    note(0, 0.25, 67); note(1, 0.25, 69);
    note(2, 0, 70); note(3, 0.25, 70); // nốt 70 bật lại ở phách 3 khi chưa nhả
    note(4, 0.25, 72); note(8, 1, 74);
    const chars = ['/T', 'u', 'ổ', 'i', ' ', 'đ', 'ờ', 'i', ' ', 'c', 'h', 'â', 'n', ' ', 'đ', 'ơ', 'n', ' ', 'c', 'ô', 'i', ' ', '/n', 'h', 'é'];
    const at = [0, 0.1, 0.2, 0.3, 0.4, 1, 1.1, 1.2, 1.3, 2, 2.1, 2.2, 2.3, 2.5, 3, 3.1, 3.2, 3.3, 4, 4.1, 4.2, 4.3, 8, 8.2, 8.4];
    chars.forEach((c, i) => ev.push([Math.round((at[i] + O) * Q), [0xff, 0x01, ...vlq(text(c).length), ...text(c)]]));
    const f = parseMidi(midiFile([meta, track(ev)]));
    expect(notesOf(f.transcribe(f.melodyPart))).toEqual([
      'G4:1:Tuổi', 'A4:1:đời', 'Bb4:1:chân', 'Bb4:1:đơn', 'C5:3:côi', 'R:1', 'D5:1:nhé',
    ]);
  });
});
