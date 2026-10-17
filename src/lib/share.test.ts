import { describe, expect, it } from 'vitest';
import { SAMPLE_SONGS } from '../data/samples';
import { blankSong } from './db';
import { decodeSong, encodeSong, MAX_LINK, shareLink } from './share';

const song = blankSong({
  id: 'goc', title: 'Đêm đông', artist: 'Nguyễn Văn Thương', harpKey: 'G', bpm: 72, timeSig: '3/4', pickupBeats: 1, style: 'waltz',
  difficulty: 2, body: '# Đoạn 1\n4 -4:2 5:0.5 -3\'\nĐêm đông lạnh lẽo', tags: ['trữ tình'], chords: { '0': 'G', '3': 'Em' },
  notes: 'ghi chú riêng', favorite: true, lastPracticedAt: 123,
});

describe('chia sẻ bằng link', () => {
  it('giữ nguyên tab, trường độ, nhịp, tempo, hợp âm; bỏ phần riêng của người gửi', async () => {
    const s = (await decodeSong(await encodeSong(song)))!;
    expect(s).toMatchObject({
      title: 'Đêm đông', artist: 'Nguyễn Văn Thương', harpKey: 'G', bpm: 72, timeSig: '3/4', pickupBeats: 1, style: 'waltz',
      difficulty: 2, body: song.body, tags: ['trữ tình'], chords: { '0': 'G', '3': 'Em' }, source: 'import', favorite: false,
    });
    expect(s.notes).toBeUndefined();
    expect(s.lastPracticedAt).toBeUndefined();
    expect(s.id).not.toBe('goc'); // bài mới, không ghi đè bài cùng id của người nhận
  });

  it('mọi bài mẫu đều gửi được bằng link', async () => {
    for (const { sampleId, ...s } of SAMPLE_SONGS) {
      const url = await shareLink(blankSong({ ...s, id: sampleId }));
      expect(url.length, s.title).toBeLessThan(MAX_LINK);
    }
  });

  it('link hỏng hoặc bị sửa bậy → không mở', async () => {
    const good = await encodeSong(song);
    expect(await decodeSong(good.slice(0, 20))).toBeNull();
    expect(await decodeSong('x' + good.slice(1))).toBeNull();
    expect(await decodeSong('j' + btoa(JSON.stringify({ v: 1, s: { title: 5 } })))).toBeNull();
  });
});
