/**
 * Bài mẫu bổ sung — dân ca, đồng quê Mỹ, thiếu nhi, ru con, Giáng sinh.
 * Chỉ giai điệu và lời đã thuộc phạm vi công cộng. Tất cả cho kèn C, chỉ dùng nốt tự nhiên (không bend).
 */
import type { SampleSong } from './samples';

export const MORE_SAMPLES: SampleSong[] = [
  {
    sampleId: 'oh-susanna',
    title: 'Oh! Susanna',
    artist: 'Stephen Foster (1848)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '4/4', pickupBeats: 1,
    style: 'train', difficulty: 2, tags: ['đồng quê', 'dân ca Mỹ'],
    notes: 'Bài đồng quê kinh điển. Nốt móc chấm (6:0.75 -6:0.25) tạo nhịp "nhún" — thổi ngắn gọn nốt sau.',
    body: `# Lời 1
4:0.5 -4:0.5 5:0.5 6:0.5 6:0.75 -6:0.25 6:0.5 5:0.5 4:0.75 -4:0.25 5:0.5 5:0.5 -4:0.5 4:0.5 -4
I come from Al-a-bam-a with a ban-jo on my knee _
4:0.5 -4:0.5 5:0.5 6:0.5 6:0.75 -6:0.25 6:0.5 5:0.5 4:0.75 -4:0.25 5:0.5 5:0.5 -4:0.5 -4:0.5 4
I'm go-ing to Lou-i-si-an-a, my true love for to see.

# Điệp khúc
-5 -5 -6:1.5 -6:0.5 6:0.5 6:0.5 5:0.5 4:0.5 -4
Oh! Su-san-na, do not cry for me;
4:0.5 -4:0.5 5:0.5 6:0.5 6:0.75 -6:0.25 6:0.5 5:0.5 4:0.75 -4:0.25 5:0.5 5:0.5 -4:0.5 -4:0.5 4:3
For I come from Al-a-bam-a with a ban-jo on my knee.
`,
  },
  {
    sampleId: 'camptown-races',
    title: 'Camptown Races',
    artist: 'Stephen Foster (1850)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 120, timeSig: '4/4', pickupBeats: 0,
    style: 'train', difficulty: 1, tags: ['đồng quê', 'dân ca Mỹ', 'vui'],
    notes: '"Doo-dah" là hai nốt 5 → -4: giữ lỗ, chỉ đổi chiều thổi / hút.',
    body: `6:0.5 6:0.5 5:0.5 6:0.5 -6:0.5 6:0.5 5 5:0.5 -4:1.5 5:0.5 -4:1.5
Camp-town la-dies sing this song, Doo-dah! Doo-dah!
6:0.5 6:0.5 5:0.5 6:0.5 -6:0.5 6:0.5 5 -4 5:0.5 -4:0.5 4:2
Camp-town race-track's five miles long, Oh, doo-dah day!
`,
  },
  {
    sampleId: 'clementine',
    title: 'Oh My Darling, Clementine',
    artist: 'Dân ca Mỹ (1884)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['đồng quê', 'dân ca Mỹ'],
    notes: 'Có xuống lỗ 3 thổi (Sol thấp) và lỗ 3 hút (Si thấp) — giữ môi hẹp để không lẫn lỗ 2.',
    body: `4:0.5 4:0.5 4 3 5:0.5 5:0.5 5 4 4:0.5 5:0.5 6:1.5 6:0.5 -5 5 -4
Oh my dar-ling, oh my dar-ling, oh my dar-ling, Clem-en-tine,
-4:0.5 5:0.5 -5:1.5 -5:0.5 5 -4 5 4:0.5 4:0.5 5:1.5 -4:0.5 3 -3 -4 4:4
You are lost and gone for-ev-er, dread-ful sor-ry, Clem-en-tine.
`,
  },
  {
    sampleId: 'my-bonnie',
    title: 'My Bonnie Lies Over the Ocean',
    artist: 'Dân ca Scotland',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['dân ca', 'trữ tình'],
    notes: 'Chơi ở quãng cao (lỗ 5–8). Lỗ 7 thổi là Đô, lỗ 8 hút là Rê — nhớ đảo chiều từ lỗ 7.',
    body: `6 8:1.5 -8:0.5 7 -8 7 -6 6 5:4
My Bon-nie lies o-ver the o-cean,
6 8:1.5 -8:0.5 7 7 -7 7 -8:5
My Bon-nie lies o-ver the sea,
6 8:1.5 -8:0.5 7 -8 7 -6 6 5:4
My Bon-nie lies o-ver the o-cean,
6 -6:1.5 -8:0.5 7 -7 -6 -7 7:3
Oh, bring back my Bon-nie to me.
`,
  },
  {
    sampleId: 'yankee-doodle',
    title: 'Yankee Doodle',
    artist: 'Dân ca Mỹ',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '4/4', pickupBeats: 0,
    style: 'train', difficulty: 2, tags: ['dân ca Mỹ', 'vui'],
    notes: 'Quãng cao: lỗ 6–9. Lỗ 9 hút (-9) là Fa.',
    body: `7:0.5 7:0.5 -8:0.5 8:0.5 7:0.5 8:0.5 -8:0.5 6:0.5 7:0.5 7:0.5 -8:0.5 8:0.5 7 -7
Yan-kee Doo-dle went to town a-rid-ing on a po-ny,
7:0.5 7:0.5 -8:0.5 8:0.5 -9:0.5 8:0.5 -8:0.5 7:0.5 -7:0.5 6:0.5 -6:0.5 -7:0.5 7 7
Stuck a fea-ther in his cap and called it ma-ca-ro-ni.
`,
  },
  {
    sampleId: 'old-macdonald',
    title: 'Old MacDonald Had a Farm',
    artist: 'Dân ca',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '4/4', pickupBeats: 0,
    style: 'train', difficulty: 1, tags: ['thiếu nhi', 'đồng quê'],
    body: `7 7 7 6 -6 -6 6:2 8 8 -8 -8 7:3
Old Mac-Don-ald had a farm, E-I-E-I-O.
6 7 7 7 6 -6 -6 6:2 8 8 -8 -8 7:4
And on his farm he had a cow, E-I-E-I-O.
6:0.5 6:0.5 7 7 7 6:0.5 6:0.5 7 7 7
With a moo-moo here and a moo-moo there,
7:0.5 7:0.5 7 7:0.5 7:0.5 7 7:0.5 7:0.5 7:0.5 7:0.5 7 7
Here a moo, there a moo, ev-ery-where a moo-moo,
7 7 7 6 -6 -6 6:2 8 8 -8 -8 7:4
Old Mac-Don-ald had a farm, E-I-E-I-O!
`,
  },
  {
    sampleId: 'mary-lamb',
    title: 'Mary Had a Little Lamb',
    artist: 'Dân ca Mỹ (1830)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'cơ bản'],
    notes: 'Chỉ dùng lỗ 4–6: bài đầu tay rất hợp để tập đơn âm.',
    body: `5 -4 4 -4 5 5 5:2 -4 -4 -4:2 5 6 6:2
Ma-ry had a lit-tle lamb, lit-tle lamb, lit-tle lamb,
5 -4 4 -4 5 5 5 5 -4 -4 5 -4 4:4
Ma-ry had a lit-tle lamb, its fleece was white as snow.
`,
  },
  {
    sampleId: 'row-your-boat',
    title: 'Row, Row, Row Your Boat',
    artist: 'Dân ca (1852)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '6/8', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'cơ bản'],
    notes: 'Câu "mer-ri-ly" đi từ lỗ 7 xuống lỗ 4, mỗi lỗ 3 nốt — tập đổi lỗ gọn.',
    body: `4:1.5 4:1.5 4 -4:0.5 5:1.5 5 -4:0.5 5 -5:0.5 6:3
Row, row, row your boat, gent-ly down the stream.
7:0.5 7:0.5 7:0.5 6:0.5 6:0.5 6:0.5 5:0.5 5:0.5 5:0.5 4:0.5 4:0.5 4:0.5 6 -5:0.5 5 -4:0.5 4:3
Mer-ri-ly, mer-ri-ly, mer-ri-ly, mer-ri-ly, life is but a dream.
`,
  },
  {
    sampleId: 'london-bridge',
    title: 'London Bridge Is Falling Down',
    artist: 'Dân ca Anh',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'cơ bản'],
    body: `6:1.5 -6:0.5 6 -5 5 -5 6:2 -4 5 -5:2 5 -5 6:2
Lon-don Bridge is fall-ing down, fall-ing down, fall-ing down,
6:1.5 -6:0.5 6 -5 5 -5 6:2 -4:2 6:2 5 4:3
Lon-don Bridge is fall-ing down, my fair la-dy.
`,
  },
  {
    sampleId: 'this-old-man',
    title: 'This Old Man',
    artist: 'Dân ca Anh',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'vui'],
    body: `6 5 6:2 6 5 6:2
This old man, he played one,
-6 6 -5 5 -4 5 -5:2
He played knick-knack on my thumb;
5:0.5 -5:0.5 6 4:0.5 4:0.5 4:0.5 4:0.5 4:0.5 -4:0.5 5:0.5 -5:0.5 6:2
With a knick-knack, pad-dy-whack, give a dog a bone,
6 -4 -4 -5 5 -4 4:2
This old man came roll-ing home.
`,
  },
  {
    sampleId: 'brahms-lullaby',
    title: 'Brahms\' Lullaby (Wiegenlied)',
    artist: 'Johannes Brahms (1868)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 80, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['ru con', 'cổ điển'],
    notes: 'Thổi thật nhẹ, kéo dài hơi — bài hợp tập giữ tiếng tròn, không rung.',
    body: `5:0.5 5:0.5 6:2 5:0.5 5:0.5 6:2 5:0.5 6:0.5 7 -7:1.5 -6:0.5 -6 6
-4:0.5 5:0.5 -5 -4 -4:0.5 5:0.5 -5:2 -4:0.5 -5:0.5 -7:0.5 -6:0.5 6 -7 7:3
`,
  },
  {
    sampleId: 'silent-night',
    title: 'Silent Night (Stille Nacht)',
    artist: 'Franz Gruber (1818) · lời J. Mohr, J. F. Young',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 70, timeSig: '3/4', pickupBeats: 0,
    style: 'waltz', difficulty: 2, tags: ['giáng sinh', 'thánh ca'],
    notes: 'Quãng cao lỗ 5–9. "_" là nốt luyến: cùng một chữ, đổi nốt liền hơi.',
    body: `6:1.5 -6:0.5 6 5:3 6:1.5 -6:0.5 6 5:3
Si-lent night, _ ho-ly night, _
-8:2 -8 -7:3 7:2 7 6:3
All is calm, all is bright.
-6:2 -6 7:1.5 -7:0.5 -6 6:1.5 -6:0.5 6 5:3
Round yon vir-gin, mo-ther and child _
-6:2 -6 7:1.5 -7:0.5 -6 6:1.5 -6:0.5 6 5:3
Ho-ly in-fant so ten-der and mild,
-8:2 -8 -9:1.5 -8:0.5 -7 7:3 8:3
Sleep in hea-ven-ly peace, _
7 6 5 6:1.5 -5:0.5 -4 4:3
Sleep in hea-ven-ly _ peace.
`,
  },
  {
    sampleId: 'we-wish-you',
    title: 'We Wish You a Merry Christmas',
    artist: 'Dân ca Anh',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 120, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['giáng sinh', 'vui'],
    body: `6 7 7:0.5 -8:0.5 7:0.5 -7:0.5 -6 -6
We wish you a mer-ry Christ-mas,
-6 -8 -8:0.5 8:0.5 -8:0.5 7:0.5 -7 6
we wish you a mer-ry Christ-mas,
6 8 8:0.5 -9:0.5 8:0.5 -8:0.5 7 -6
we wish you a mer-ry Christ-mas
6:0.5 6:0.5 -6 -8 -7 7:3
and a hap-py new year!
`,
  },
  {
    sampleId: 'deck-the-halls',
    title: 'Deck the Halls',
    artist: 'Dân ca xứ Wales',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 110, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 2, tags: ['giáng sinh', 'vui'],
    notes: 'Bỏ câu "Don we now our gay apparel" vì cần nốt Fa thăng (khó trên kèn C).',
    body: `6:1.5 -5:0.5 5 -4 4 -4 5 4 -4:0.5 5:0.5 -5:0.5 -4:0.5 5:1.5 -4:0.5 4 -3 4:2
Deck the halls with boughs of hol-ly, Fa la la la la, la la la la.
6:1.5 -5:0.5 5 -4 4 -4 5 4 -4:0.5 5:0.5 -5:0.5 -4:0.5 5:1.5 -4:0.5 4 -3 4:2
'Tis the sea-son to be jol-ly, Fa la la la la, la la la la.
6:1.5 -5:0.5 5 -4 4 -4 5 4 -6:0.5 -6:0.5 -6:0.5 -6:0.5 6:1.5 -5:0.5 5 -4 4:2
Troll the an-cient Yule-tide car-ol, Fa la la la la, la la la la.
`,
  },
];
