import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { flatten, parseTab } from '../lib/tabText';
import { rhythmFeatures, suggestStyle } from './suggest';

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
    const ok = rated.filter((s) => suggestStyle(s, flatten(parseTab(s.body, s.harpKey))).style === s.style).length;
    expect(ok / rated.length).toBeGreaterThanOrEqual(0.8);
  });
});
