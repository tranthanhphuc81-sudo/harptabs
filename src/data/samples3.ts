/**
 * Bài mẫu country / folk Mỹ – Anh – Ireland – Scotland đã hết bản quyền.
 * Giai điệu lấy từ bản nhạc nhúng trong Wikipedia (nguồn ghi ở từng bài), chuyển sang kèn C
 * bằng bộ chuyển của app (chọn cách dịch giọng ít bend nhất). Chỉ có giai điệu, không kèm lời.
 * Tệp do scratchpad/abc/emit.py sinh ra — sửa ở đó nếu cần sinh lại.
 */
import type { SampleSong } from './samples';

export const FOLK_SAMPLES: SampleSong[] = [
  {
    sampleId: 'red-river-valley',
    title: 'Red River Valley',
    artist: 'Dân ca đồng quê Mỹ · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 90, timeSig: '4/4', pickupBeats: 1,
    style: 'ballad', difficulty: 1, tags: ['đồng quê', 'dân ca Mỹ', 'cao bồi'],
    notes: 'Bài cao bồi kinh điển. Câu cuối có quãng nhảy xa — giữ kèn yên, chỉ trượt môi.',
    body: `6:0.5 7:0.5 8 8:0.5 8:0.5 8 -8:0.5 8:0.5 -8 7:2 8:0.5 8:0.5

8 7:0.5 8:0.5 9 -9:0.5 8:0.5 -8:3 9:0.5 -9:0.5

8 8:0.5 -8:0.5 7 -8:0.5 8:0.5 9 -9:2 -6:0.5 -6:0.5

6 -7:0.5 7:0.5 -8 8:0.5 -8:0.5 7:4
`,
  },
  {
    sampleId: 'streets-of-laredo',
    title: 'Streets of Laredo',
    artist: 'Dân ca cao bồi Mỹ · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 96, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['đồng quê', 'cao bồi'],
    body: `9 9:1.5 -9:0.5 8 -9 9 -9 8:1.5 -8:0.5 7

-7 6:1.5 6:0.5 7:2 7 -8 8 -9

8 -8 7 -8:2 9 9:1.5 -9:0.5 8

-9 9 -9 8:1.5 -8:0.5 7 -7 6:1.5 6:0.5

7:1.5 7:0.5 7 -8 8 -9 8 -7 -7

7:2 9 7:1.5 7:0.5 7 8 9:2 -9:1.5 -9:0.5 -9

-10 10:2 9:1.5 9:0.5 9 -10 9 8

7:0.5 7:0.5 -8 8 -8:2 9:0.5 9:0.5 7:1.5 7:0.5 7

8 9:2 -9:1.5 -9:0.5 -9 -10 10:2 9:1.5 9:0.5 9

-10 9 8:0.5 8:0.5 -8 8 -8 7:2
`,
  },
  {
    sampleId: 'aura-lee',
    title: 'Aura Lee',
    artist: 'George R. Poulton (1861) · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'F', bpm: 72, timeSig: '2/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['đồng quê', 'trữ tình'],
    notes: 'Giai điệu sau này được dùng cho bài "Love Me Tender" (1956).',
    body: `7:0.75 -9:0.25 8:0.5 -9:0.5 9:0.5 -8:0.5 9 -9:0.5 8:0.5 -8:0.5 8:0.5

-9:1.5 r:0.5 7:0.75 -9:0.25 8:0.5 -9:0.5 9:0.5 -8:0.5 9

-9:0.5 8:0.5 -8:0.5 8:0.5 -9:2
`,
  },
  {
    sampleId: 'danny-boy',
    title: 'Danny Boy (Londonderry Air)',
    artist: 'Dân ca Ireland · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 66, timeSig: '4/4', pickupBeats: 1.5,
    style: 'ballad', difficulty: 3, tags: ['dân ca Ireland', 'trữ tình'],
    notes: 'Bài dài, quãng rộng. Thổi chậm, kéo hơi đều; câu cao nhất lên lỗ 8–9.',
    body: `-3:0.5 4:0.5 -4:0.5 5:1.5 -4:0.5 5:0.5 -6:0.5 6:0.5 5:0.5 -4:0.5 4:0.5 -3'' r:0.5 4:0.5 5:0.5 -5:0.5

6:1.5 -6:0.5 6:0.5 5:0.5 4:0.5 5:0.5 -4:2 r:0.5 -3:0.5 4:0.5 -4:0.5

5:1.5 -4:0.5 5:0.5 -6:0.5 6:0.5 5:0.5 -4:0.5 4:0.5 -3'':0.5 -3''':0.5 -3'':0.5 -3:0.5 4:0.5 -4:0.5

5:1.5 -5:0.5 5:0.5 -4:0.5 4:0.5 -4:0.5 4:2 r:0.5 6:0.5 -6:0.5 -7:0.5

7:1.5 -7:0.5 -7:0.5 -6:0.5 6:0.5 5:0.5 6:0.5 5:0.5 4 r:0.5 6:0.5 -6:0.5 -7:0.5

7:1.5 -7:0.5 -7:0.5 -6:0.5 6:0.5 5:0.5 -4:2 r:0.5 6:0.5 6:0.5 6:0.5

8:1.5 -8:0.5 -8:0.5 7:0.5 -6:0.5 7:0.5 6:0.5 5:0.5 4 r:0.5 -3:0.5 4:0.5 -4:0.5

5:0.5 -6:0.5 6:0.5 5:0.5 -4:0.5 4:0.5 -3'':0.5 -3:0.5 4:2.5
`,
  },
  {
    sampleId: 'shall-we-gather',
    title: 'Shall We Gather at the River?',
    artist: 'Robert Lowry (1864) · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 88, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 2, tags: ['thánh ca', 'đồng quê'],
    body: `5 5 5:0.75 -4:0.25 5:0.75 -5:0.25 6:2 5:2

-5 -5 -5:0.75 6:0.25 -5:0.75 5:0.25 -4:2 6:2

5 5 5:0.75 -4:0.25 5:0.75 -5:0.25 6:2 5 5:0.5 -5:0.5

-4 -4:0.5 5:0.5 -5 5:0.5 -4:0.5 4:4 -6 -6 7:0.75 -7:0.25 7:0.75 -6:0.25

6:2 5:1.5 5:0.5 -5:0.75 5:0.25 -5:0.75 5:0.25 -5:0.75 5:0.25 -5:0.5 -4:0.5

5:2 6:2 -6:0.75 -6:0.25 -6:0.75 -6:0.25 7:0.75 -7:0.25 7:0.75 -6:0.25

6:2 5 5 -4 -4:0.75 5:0.25 -5 5:0.5 -4:0.5

4:4
`,
  },
  {
    sampleId: 'skye-boat-song',
    title: 'The Skye Boat Song',
    artist: 'Dân ca Scotland · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'F', bpm: 80, timeSig: '6/8', pickupBeats: 0,
    style: 'waltz', difficulty: 1, tags: ['dân ca Scotland', 'trữ tình'],
    body: `4:0.75 -4:0.25 4:0.5 -5 -5:0.25 -5:0.25 6:0.75 -6:0.25 6:0.5 7:1.5

-6:0.75 6:0.25 -6:0.5 -4 -4:0.5 4:1.5 r:1.5 4:0.75 -4:0.25 4:0.5 -5 -5:0.5

6:0.75 -6:0.25 6:0.5 7:1.5 -6:0.75 6:0.25 -6:0.5 -4 -4:0.5

-5:3 -6:0.5 -5:0.5 -6:0.5 -6:1.5 6:0.5 -4:0.5 6:0.5 6:1.5

-5:0.5 -4:0.5 -5:0.5 -5 -5:0.5 -4:3 -6:0.5 -5:0.5 -6:0.5 -6:1.5

6:0.5 -4:0.5 6:0.5 6:1.5 -5:0.5 -4:0.5 -5:0.5 -5 -5:0.5

-4:1.5 4:1.5
`,
  },
  {
    sampleId: 'michael-row',
    title: 'Michael, Row the Boat Ashore',
    artist: 'Dân ca Mỹ · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 96, timeSig: '4/4', pickupBeats: 2,
    style: 'ballad', difficulty: 1, tags: ['dân ca Mỹ', 'cơ bản'],
    body: `4 5 6:1.5 5:0.5 6 -6 6:2 5 6

-6:4 6:2 5 6 6:1.5 5:0.5 -5 5

-4:2 4 -4 5:2 -4:2 4:2
`,
  },
  {
    sampleId: 'old-joe-clark',
    title: 'Old Joe Clark',
    artist: 'Nhạc fiddle đồng quê Mỹ · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 2, songKey: 'G', bpm: 100, timeSig: '2/4', pickupBeats: 0,
    style: 'train', difficulty: 3, tags: ['đồng quê', 'fiddle', 'nhanh'],
    notes: 'Điệu fiddle bluegrass, giọng Mixolydian. Tập chậm trước rồi tăng tốc. Có 2 nốt Fa thăng là overblow (5o) — mới tập thì thổi tạm -5 (Fa).',
    body: `-8:0.5 8:0.5 -9:0.5 8:0.5 -8:0.5 7:0.5 -7:0.5 -8:0.25 -8:0.25

-8:0.5 8:0.5 -9:0.5 8:0.5 -8 -8 -8:0.5 8:0.5 -9:0.5 8:0.5

-8:0.5 7:0.5 -7 6:0.5 6:0.25 6:0.25 -6:0.25 6:0.25 5o:0.5

6 6 -8:0.5 8:0.5 -9:0.5 8:0.5 -8:0.5 7:0.5 -7:0.5 -8:0.25 -8:0.25

-8:0.5 8:0.5 -9:0.5 8:0.5 -8 -8 -8:0.5 8:0.5 -9:0.5 8:0.5

-8:0.5 7:0.5 -7 6:0.5 6:0.25 6:0.25 -6:0.25 6:0.25 5o:0.5

6 6 6 6 -8:0.5 7:0.5 -7 6 6

-6 -6 6 6 -8:0.5 7:0.5 -7 6:0.5 -7:0.5 -6:0.5 -5:0.5

6 6 6 6 -8:0.5 7:0.5 -7 6 6

-6 -6 6 6 -8:0.5 7:0.5 -7 6:0.5 -7:0.5 -6:0.5 -5:0.5

6 6
`,
  },
  {
    sampleId: 'auld-lang-syne',
    title: 'Auld Lang Syne',
    artist: 'Dân ca Scotland · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 2, songKey: 'G', bpm: 84, timeSig: '4/4', pickupBeats: 1,
    style: 'ballad', difficulty: 1, tags: ['dân ca Scotland', 'năm mới'],
    body: `-4 6:1.5 6:0.5 6 -7 -6:1.5 6:0.5 -6 -7

6:1.5 6:0.5 -7 -8 8:3 8 -8:1.5 -7:0.5 -7 6

-6:1.5 6:0.5 -6 -7 6:1.5 5:0.5 5 -4

6:3 8 -8:1.5 -7:0.5 -7 6 -6:1.5 6:0.5 -6 8

-8:1.5 -7:0.5 -7 -8 8:3 8 -8:1.5 -7:0.5 -7 6

-6:1.5 6:0.5 -6 -7 6:1.5 5:0.5 5 -4

6:3
`,
  },
  {
    sampleId: 'scarborough-fair',
    title: 'Scarborough Fair',
    artist: 'Dân ca Anh · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 3, songKey: 'Dm', bpm: 90, timeSig: '3/4', pickupBeats: 0,
    style: 'waltz', difficulty: 1, tags: ['dân ca Anh', 'trữ tình'],
    notes: 'Giai điệu dân gian truyền thống (giọng Dorian), không phải bản phối của Simon & Garfunkel.',
    body: `-4:2 -4 -6:0.5 -6:1.5 -6 5:1.5 -5:0.5 5

-4:3 r -6 7 -8:2 7 -6 -7 6

-6:2 -8 -8:2 -8 7:2 -6 -6 6 -5

5:3 -4:2 -6 6:2 -5 5 -4 4

-4:3
`,
  },
  {
    sampleId: 'greensleeves',
    title: 'Greensleeves',
    artist: 'Dân ca Anh (thế kỷ 16) · theo bản nhạc trên Wikipedia',
    harpKey: 'C', position: 3, songKey: 'Dm', bpm: 80, timeSig: '6/8', pickupBeats: 0.5,
    style: 'waltz', difficulty: 3, tags: ['dân ca Anh', 'cổ'],
    notes: 'Giọng thứ nên có nốt cần bend — xem số có dấu \' trên tab.',
    body: `-4:0.5 -5 6:0.5 -6:0.75 6o:0.25 -6:0.5 6 5:0.5 4:0.75 -4:0.25 5:0.5

-5 -4:0.5 -4:0.75 -4':0.25 -4:0.5 5 -4':0.5 -3'' -4:0.5

-5 6:0.5 -6:0.75 6o:0.25 -6:0.5 6 5:0.5 4:0.75 -4:0.25 5:0.5

-5:0.75 5:0.25 -4:0.5 -4':0.75 -3:0.25 -4':0.5 -4 -4:0.5 -4:1.5

7:1.5 7:0.75 -7:0.25 -6:0.5 6 5:0.5 4:0.75 -4:0.25 5:0.5

-5 -4:0.5 -4:0.75 -4':0.25 -4:0.5 5 -4':0.5 -3'':1.5

7:1.5 7:0.75 -7:0.25 -6:0.5 6 5:0.5 4:0.75 -4:0.25 5:0.5

-5 -4:0.5 -4':0.75 -3:0.25 -4':0.5 -4:1.5 -4:1.5
`,
  },
];
