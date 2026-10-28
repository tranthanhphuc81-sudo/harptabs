/**
 * Bài mẫu — chỉ dùng giai điệu và lời đã thuộc phạm vi công cộng (public domain).
 * Tất cả viết cho kèn C (diatonic); bản cho kèn C chromatic tạo ở samples4.ts.
 */
import { IS_GUITAR_APP, IS_KALIMBA_APP, IS_RECORDER_APP } from '../appConfig';
import { guitarSamples } from './guitarSamples';
import { kalimbaSamples } from './kalimbaSamples';
import { recorderSamples } from './recorderSamples';
import { beatsPerBar, type Song } from '../lib/types';
import { CHORD_TRUTH, truthOverrides } from '../audio/harmonyBench';
import { MORE_SAMPLES } from './samples2';
import { FOLK_SAMPLES } from './samples3';
import { chromaticSamples, tremoloSamples } from './samples4';

type Sample = Omit<Song, 'id' | 'createdAt' | 'updatedAt' | 'favorite' | 'source'>;
export type SampleSong = Sample & { sampleId: string };

/** Các bài mẫu có từ bản đầu tiên (máy đã cài trước khi có danh sách bài mẫu đã thêm) */
export const FIRST_SAMPLE_IDS = ['scale-c', 'twinkle', 'frere-jacques', 'ode-to-joy', 'jingle-bells', 'happy-birthday', 'amazing-grace', 'blues-scale'];

const BASE_SAMPLES: SampleSong[] = [
  {
    sampleId: 'scale-c',
    title: 'Thang âm Đô trưởng',
    artist: 'Bài luyện',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 70, timeSig: '4/4', pickupBeats: 0,
    style: 'metronome', difficulty: 1, tags: ['luyện tập', 'cơ bản'],
    notes: 'Bài đầu tiên: tập thổi đơn âm sạch từ lỗ 4 đến lỗ 7. Chú ý lỗ 6–7 đảo chiều: -7 (Si) là hút, 7 (Đô) là thổi.',
    body: `# Đi lên
4 -4 5 -5 6 -6 -7 7:2
Đô Rê Mi Fa Sol La Si Đô

# Đi xuống
7 -7 -6 6 -5 5 -4 4:2
Đô Si La Sol Fa Mi Rê Đô
`,
  },
  {
    sampleId: 'twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    artist: 'Dân ca Pháp · lời Jane Taylor (1806)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 90, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'cơ bản'],
    body: `4 4 6 6 -6 -6 6:2
Twin-kle, twin-kle, lit-tle star,
-5 -5 5 5 -4 -4 4:2
How I won-der what you are!

6 6 -5 -5 5 5 -4:2
Up a-bove the world so high,
6 6 -5 -5 5 5 -4:2
Like a dia-mond in the sky.

4 4 6 6 -6 -6 6:2
Twin-kle, twin-kle, lit-tle star,
-5 -5 5 5 -4 -4 4:2
How I won-der what you are!
`,
  },
  {
    sampleId: 'frere-jacques',
    title: 'Frère Jacques',
    artist: 'Dân ca Pháp',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['thiếu nhi', 'cơ bản'],
    notes: 'Câu "Ding, dang, dong" xuống lỗ 3 thổi — giữ môi cố định, chỉ trượt kèn.',
    body: `4 -4 5 4 4 -4 5 4
Frè-re Jac-ques, Frè-re Jac-ques,
5 -5 6:2 5 -5 6:2
Dor-mez-vous? Dor-mez-vous?
6:0.5 -6:0.5 6:0.5 -5:0.5 5 4 6:0.5 -6:0.5 6:0.5 -5:0.5 5 4
Son-nez les ma-ti-nes, son-nez les ma-ti-nes,
4 3 4:2 4 3 4:2
Ding, dang, dong. Ding, dang, dong.
`,
  },
  {
    sampleId: 'ode-to-joy',
    title: 'Ode to Joy (Freude, schöner Götterfunken)',
    artist: 'L. v. Beethoven · lời F. Schiller',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '4/4', pickupBeats: 0,
    style: 'ballad', difficulty: 1, tags: ['cổ điển', 'cơ bản'],
    body: `# Câu 1
5 5 -5 6 6 -5 5 -4 4 4 -4 5 5:1.5 -4:0.5 -4:2
Freu-de, schö-ner Göt-ter-fun-ken, Toch-ter aus E-ly-si-um,
5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
Wir be-tre-ten feu-er-trun-ken, Himm-li-sche, dein Hei-lig-tum!

# Câu 2
-4 -4 5 4 -4 5:0.5 -5:0.5 5 4 -4 5:0.5 -5:0.5 5 -4 4 -4 3:2
Dei-ne Zau-ber bin-den _ wie-der, was die _ Mo-de streng ge-teilt;
5 5 -5 6 6 -5 5 -4 4 4 -4 5 -4:1.5 4:0.5 4:2
Al-le Men-schen wer-den Brü-der, wo dein sanf-ter Flü-gel weilt.
`,
  },
  {
    sampleId: 'jingle-bells',
    title: 'Jingle Bells (điệp khúc)',
    artist: 'James Lord Pierpont (1857)',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 120, timeSig: '4/4', pickupBeats: 0,
    style: 'train', difficulty: 2, tags: ['giáng sinh', 'vui'],
    notes: 'Nhịp train hợp với bài này. Tập riêng đoạn "o-pen sleigh, hey!" nhảy từ -4 lên 6.',
    body: `5 5 5:2 5 5 5:2 5 6 4:1.5 -4:0.5 5:4
Jin-gle bells, jin-gle bells, jin-gle all the way.
-5 -5 -5:1.5 -5:0.5 -5 5 5 5:0.5 5:0.5 5 -4 -4 5 -4:2 6:2
Oh what fun it is to ride in a one-horse o-pen sleigh, hey!

5 5 5:2 5 5 5:2 5 6 4:1.5 -4:0.5 5:4
Jin-gle bells, jin-gle bells, jin-gle all the way.
-5 -5 -5:1.5 -5:0.5 -5 5 5 5:0.5 5:0.5 6 6 -5 -4 4:4
Oh what fun it is to ride in a one-horse o-pen sleigh.
`,
  },
  {
    sampleId: 'happy-birthday',
    title: 'Happy Birthday to You',
    artist: 'Mildred & Patty Hill',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 100, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['sinh nhật'],
    notes: 'Chơi ở quãng cao (lỗ 6–9) để không phải bend. Lỗ 9 thổi và -9 hút cần môi gọn hơn.',
    body: `6:0.75 6:0.25 -6 6 7 -7:2
Hap-py birth-day to you,
6:0.75 6:0.25 -6 6 -8 7:2
Hap-py birth-day to you,
6:0.75 6:0.25 9 8 7 -7 -6
Hap-py birth-day dear friend _
-9:0.75 -9:0.25 8 7 -8 7:3
Hap-py birth-day to you!
`,
  },
  {
    sampleId: 'amazing-grace',
    title: 'Amazing Grace',
    artist: 'John Newton (1779) · giai điệu New Britain',
    harpKey: 'C', position: 1, songKey: 'C', bpm: 84, timeSig: '3/4', pickupBeats: 1,
    style: 'waltz', difficulty: 2, tags: ['thánh ca', 'trữ tình'],
    notes: 'Nốt luyến (dấu _ trong lời) nghĩa là một chữ ngân qua hai nốt. Thêm vibrato ở các nốt dài.',
    body: `6 7:2 8:0.5 7:0.5 8:2 -8 7:2 -6 6:2
A-ma-zing _ grace, how sweet the sound
6 7:2 8:0.5 7:0.5 8:2 -8 9:5
That saved a _ wretch like me!

8 9:2 8:0.5 7:0.5 8:2 -8 7:2 -6 6:2
I once was _ lost, but now am found,
6 7:2 8:0.5 7:0.5 8:2 -8 7:3
Was blind, but _ now I see.
`,
  },
  {
    sampleId: 'blues-scale',
    title: 'Thang âm blues — vị trí 2',
    artist: 'Bài luyện',
    harpKey: 'C', position: 2, songKey: 'G', bpm: 76, timeSig: '4/4', pickupBeats: 0,
    style: 'shuffle', difficulty: 3, tags: ['luyện tập', 'blues', 'bend'],
    notes: 'Kèn C chơi giọng Sol (cross harp). -3\' là bend nửa cung, -4\' bend nửa cung lỗ 4. Hạ hàm, nói thầm "i-u" để kéo nốt xuống.',
    body: `# Đi lên
-2 -3' 4 -4' -4 -5 6:2
Sol Sib Đô Đô# Rê Fa Sol

# Đi xuống
6 -5 -4 -4' 4 -3' -2:2
Sol Fa Rê Đô# Đô Sib Sol

# Câu riff
-2:0.5 -3':0.5 4 -4':0.5 -4:1.5 -4 4 -3' -2:2
`,
  },
];

/** bài có hợp âm chuẩn (src/audio/harmonyBench.ts): gắn sẵn để đệm đúng thay cho hợp âm tự đoán */
const withChords = (s: SampleSong): SampleSong => {
  const truth = CHORD_TRUTH[s.sampleId];
  return truth && !s.chords ? { ...s, chords: truthOverrides(truth, beatsPerBar(s.timeSig), s.pickupBeats) } : s;
};
const DIATONIC_SAMPLES: SampleSong[] = [...BASE_SAMPLES, ...MORE_SAMPLES, ...FOLK_SAMPLES].map(withChords);
/** app sáo: bài mẫu xếp lại cho sáo alto; app harmonica: bài kèn diatonic / chromatic / tremolo */
export const SAMPLE_SONGS: SampleSong[] = IS_RECORDER_APP
  ? recorderSamples(DIATONIC_SAMPLES)
  : IS_KALIMBA_APP
  ? kalimbaSamples(DIATONIC_SAMPLES)
  : IS_GUITAR_APP
  ? guitarSamples(DIATONIC_SAMPLES)
  : [...DIATONIC_SAMPLES, ...chromaticSamples(DIATONIC_SAMPLES), ...tremoloSamples(DIATONIC_SAMPLES)];
