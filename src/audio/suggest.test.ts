import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { rhythmFeatures, suggestInstrument, suggestStyle } from './suggest';

const notes = (beats: number[], midis: number[], lyrics: string[] = []) => {
  let t = 0;
  return beats.map((b, i) => { const n = { start: t, beats: b, midi: midis[i % midis.length], lyric: lyrics[i] }; t += b; return n; });
};
const base = { timeSig: '4/4', bpm: 90 };

describe('tự chọn kiểu nhịp', () => {
  it('từ khoá thể loại trong tên / thẻ thắng mọi luật khác', () => {
    expect(suggestStyle({ ...base, title: 'Đắp mộ cuộc tình (Bolero)' }, []).style).toBe('bolero');
    expect(suggestStyle({ ...base, title: 'La Cumparsita', tags: ['tango'] }, []).style).toBe('tango');
    expect(suggestStyle({ ...base, timeSig: '3/4', title: 'Blues ballad', tags: ['blues'] }, []).style).toBe('shuffle');
  });

  it('nhịp 3/4 và 6/8 → valse, 2/4 nhanh → polka', () => {
    expect(suggestStyle({ ...base, timeSig: '3/4' }, []).style).toBe('waltz');
    expect(suggestStyle({ ...base, timeSig: '6/8' }, []).style).toBe('waltz');
    expect(suggestStyle({ ...base, timeSig: '2/4', bpm: 120 }, []).style).toBe('polka');
  });

  it('giai điệu chùm ba / chấm dôi → shuffle (nhanh) hoặc slow rock (chậm)', () => {
    const swung = notes([0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 1], [60, 62, 64, 65]);
    expect(rhythmFeatures(swung).dotted).toBeGreaterThan(0.5);
    expect(suggestStyle({ ...base, bpm: 110 }, swung).style).toBe('shuffle');
    expect(suggestStyle({ ...base, bpm: 66 }, swung).style).toBe('slowrock');
  });

  it('lời Việt, giọng thứ, chậm vừa → bolero', () => {
    const viet = notes([1, 1, 1, 1, 2, 2], [57, 60, 64, 62, 60, 57], ['Chiều', 'nay', 'một', 'mình', 'trên', 'phố']);
    expect(rhythmFeatures(viet).vietnamese).toBe(true);
    expect(suggestStyle({ ...base, bpm: 80, songKey: 'Am' }, viet).style).toBe('bolero');
    // cùng giai điệu nhưng giọng trưởng và lời Anh → không phải bolero
    expect(suggestStyle({ ...base, bpm: 80, songKey: 'C' }, notes([1, 1, 1, 1, 2, 2], [60, 64, 67, 65, 64, 60], ['Hey', 'there'])).style).toBe('ballad');
  });

  it('khớp phần lớn kiểu nhịp người soạn đã chọn cho bài mẫu', () => {
    const rated = SAMPLE_SONGS.filter((s) => s.style !== 'metronome' && s.style !== 'none');
    const ok = rated.filter((s) => suggestStyle(s, flatten(parseTab(s.body, s.harpKey, s.harpType))).style === s.style).length;
    expect(ok / rated.length).toBeGreaterThanOrEqual(0.8);
  });
});

describe('tự chọn nhạc cụ', () => {
  const inst = (song: Partial<typeof base> & { title?: string; tags?: string[] }, style: Parameters<typeof suggestInstrument>[2], ns: Parameters<typeof suggestInstrument>[1] = []) =>
    suggestInstrument({ ...base, ...song }, ns, style).instrument;

  it('bài ghi rõ nhạc cụ, thánh ca, dân ca Việt thắng kiểu nhịp', () => {
    expect(inst({ title: 'Romance (guitar)' }, 'waltz')).toBe('guitar');
    expect(inst({ title: 'Song of the Wind', tags: ['fiddle'] }, 'country')).toBe('violin');
    expect(inst({ title: 'Hồn quê', tags: ['sáo trúc'] }, 'ballad')).toBe('flute');
    expect(inst({ title: 'Đồi thông hai mộ', tags: ['huýt sáo'] }, 'ballad')).toBe('whistle');
    expect(inst({ title: 'The Good, the Bad and the Ugly (whistling)' }, 'country')).toBe('whistle');
    expect(inst({ title: 'Amazing Grace', tags: ['hymn'] }, 'waltz')).toBe('organ');
    expect(inst({ title: 'Lý cây đa', tags: ['dân ca quan họ'] }, 'ballad')).toBe('flute');
    expect(inst({ title: 'Bắc kim thang', tags: ['dân ca'] }, 'ballad', notes([1, 1], [60, 62], ['Bắc', 'kim']))).toBe('flute');
    // dân ca nước ngoài / không có lời Việt: không phải sáo trúc
    expect(inst({ title: 'Greensleeves', tags: ['dân ca Anh'] }, 'ballad', notes([1, 1], [60, 62], ['Đi', 'đi']))).toBe('piano');
    expect(inst({ title: 'Danny Boy', tags: ['dân ca'] }, 'train')).toBe('harmonica');
    // "sao" (vì sao, ngôi sao) không phải sáo trúc
    expect(inst({ title: 'Sao em nỡ vội lấy chồng' }, 'bolero')).toBe('guitar');
  });

  it('theo kiểu nhịp: bolero/rumba/bossa → guitar, tango/polka → accordion, jazz → sax…', () => {
    expect(inst({}, 'bolero')).toBe('guitar');
    expect(inst({}, 'rumba')).toBe('guitar');
    expect(inst({}, 'bossa')).toBe('guitar');
    expect(inst({}, 'tango')).toBe('accordion');
    expect(inst({}, 'polka')).toBe('accordion');
    expect(inst({}, 'jazz')).toBe('sax');
    expect(inst({}, 'chacha')).toBe('organ');
    expect(inst({}, 'ballad')).toBe('piano');
    expect(inst({}, 'samba')).toBe('flute');
  });

  it('nhạc blues, rock, đồng quê, hành khúc giữ kèn harmonica', () => {
    for (const s of ['shuffle', 'rock', 'country', 'train', 'march', 'none'] as const) expect(inst({}, s)).toBe('harmonica');
  });

  it('valse theo tốc độ, ballad chậm giai điệu cao → violin', () => {
    expect(inst({ bpm: 120 }, 'waltz')).toBe('violin');
    expect(inst({ bpm: 170 }, 'waltz')).toBe('accordion');
    const high = notes([1, 1, 1, 1], [76, 79, 81, 77]);
    const low = notes([1, 1, 1, 1], [60, 62, 64, 65]);
    expect(inst({ bpm: 66 }, 'ballad', high)).toBe('violin');
    expect(inst({ bpm: 66 }, 'ballad', low)).toBe('piano');
  });

  it('nhạc cụ mới: ghi rõ tên, hát ru → hộp nhạc, dân ca Việt chậm → đàn bầu', () => {
    expect(inst({ title: 'Trống cơm', tags: ['đàn bầu'] }, 'ballad')).toBe('danbau');
    expect(inst({ title: 'Lưu thủy (đàn tranh)' }, 'ballad')).toBe('dantranh');
    expect(inst({ title: 'Il Silenzio', tags: ['trumpet'] }, 'march')).toBe('trumpet');
    expect(inst({ title: 'Stranger on the Shore (clarinet)' }, 'ballad')).toBe('clarinet');
    expect(inst({ title: 'The Swan', tags: ['cello'] }, 'waltz')).toBe('cello');
    expect(inst({ title: 'Tico Tico (marimba)' }, 'samba')).toBe('marimba');
    expect(inst({ title: 'Edelweiss', tags: ['hộp nhạc'] }, 'waltz')).toBe('musicbox');
    expect(inst({ title: 'Ave Verum', tags: ['hợp xướng'] }, 'ballad')).toBe('choir');
    expect(inst({ title: "Brahms' Lullaby" }, 'waltz')).toBe('musicbox');
    expect(inst({ title: 'Lý ngựa ô', tags: ['dân ca Nam Bộ'], bpm: 66 }, 'ballad')).toBe('danbau');
    expect(inst({ title: 'Lý ngựa ô', tags: ['dân ca Nam Bộ'], bpm: 110 }, 'ballad')).toBe('flute');
    // "chorus" (điệp khúc) không phải hợp xướng
    expect(inst({ title: 'Song', notes: 'Chorus lặp lại hai lần' } as never, 'rock')).toBe('harmonica');
  });

  it('thêm nhạc cụ: dân tộc, dây, phím, gõ', () => {
    expect(inst({ title: 'Ngựa phi đường xa', tags: ['đàn nhị'] }, 'ballad')).toBe('dannhi');
    expect(inst({ title: 'Dạ cổ hoài lang', tags: ['vọng cổ'] }, 'ballad')).toBe('dannguyet');
    expect(inst({ title: 'Lễ hội', tags: ['kèn bầu'] }, 'march')).toBe('kenbau');
    expect(inst({ title: 'Aloha Oe' }, 'waltz')).toBe('ukulele');
    expect(inst({ title: 'Foggy Mountain Breakdown', tags: ['bluegrass'] }, 'country')).toBe('banjo');
    expect(inst({ title: 'Canon', tags: ['đàn hạc'] }, 'ballad')).toBe('danhac');
    expect(inst({ title: 'Song of Storms (ocarina)' }, 'waltz')).toBe('ocarina');
    expect(inst({ title: 'Autumn Leaves', tags: ['vibraphone'] }, 'jazz')).toBe('vibraphone');
    expect(inst({ title: 'Kalimba lullaby' }, 'ballad')).toBe('kalimba');
    expect(inst({ title: 'Just the Two of Us (piano điện)' }, 'ballad')).toBe('epiano');
    expect(inst({ title: 'Take on Me', tags: ['synth'] }, 'disco')).toBe('synth');
    expect(inst({ title: 'Jamaica Farewell', tags: ['calypso'] }, 'reggae')).toBe('steeldrum');
    // "blues harp" là kèn harmonica, không phải đàn hạc
    expect(inst({ title: 'Blues harp boogie' }, 'shuffle')).toBe('harmonica');
    // vẫn còn: piano thường, dân ca quan họ → sáo trúc
    expect(inst({ title: 'Für Elise (piano)' }, 'waltz')).toBe('piano');
    expect(inst({ title: 'Lý cây đa', tags: ['dân ca quan họ'] }, 'ballad')).toBe('flute');
  });

  it('tiếng độc lạ: chỉ chọn khi bài ghi rõ', () => {
    expect(inst({ title: 'Super Mario Bros. theme' }, 'disco')).toBe('chiptune');
    expect(inst({ title: 'Tetris (Korobeiniki)' }, 'polka')).toBe('chiptune');
    expect(inst({ title: 'Ave Maria', tags: ['theremin'] }, 'ballad')).toBe('theremin');
    expect(inst({ title: 'Space Oddity' }, 'ballad')).toBe('space');
    expect(inst({ title: 'Mèo con', tags: ['tiếng mèo'] }, 'polka')).toBe('meow');
    expect(inst({ title: 'Mr. Roboto', tags: ['robot'] }, 'disco')).toBe('talkbox');
    // bài thường không bị đổi sang tiếng độc lạ
    expect(inst({ title: 'Chú mèo con' }, 'polka')).toBe('accordion');
    expect(inst({ title: 'Twinkle Twinkle Little Star' }, 'none')).toBe('harmonica');
  });

  it('luôn có lý do để hiện cho người dùng', () => {
    expect(suggestInstrument({ ...base }, [], 'tango').reason).toMatch(/accordion/);
  });
});

describe('danh sách nhạc cụ', () => {
  it('mỗi nhạc cụ nằm đúng một nhóm trong ô chọn', async () => {
    const { INSTRUMENT_GROUPS, INSTRUMENT_OPTIONS } = await import('./engine');
    const grouped = INSTRUMENT_GROUPS.flatMap((g) => g.items);
    expect([...grouped].sort()).toEqual(INSTRUMENT_OPTIONS.map((o) => o.value).sort());
    expect(new Set(grouped).size).toBe(grouped.length);
  });
});
