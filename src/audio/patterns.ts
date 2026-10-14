/**
 * Beat mẫu. Mỗi track là chuỗi ký tự trên lưới (beats × subdiv):
 *   x = đánh, X = đánh mạnh, . = nghỉ
 * Track có thể dài 2 ô nhịp (ô thứ hai là biến tấu), lặp lại theo chu kỳ.
 * Bộ gõ La-tinh dùng ký hiệu riêng:
 *   bongo / conga: f = ngón nhẹ, t = gót tay (trầm, tắt), s = vỗ (slap), h = mở cao, o = mở trầm
 *   guiro: X = cạo dài, x = cạo ngắn
 *   clave: x/X = gõ hai thanh gỗ
 *   cowbell: x/X = chuông bò (cencerro)
 *   clap: x/X = vỗ tay
 *   bassLine: đường bass riêng thay cho bass theo trống — r = gốc, o = gốc quãng tám trên, f = quãng 5
 *   comp: x/X = gõ hợp âm đệm (theo hợp âm đang dùng, công tắc "Đệm hợp âm")
 */
export type BeatStyle =
  | 'none' | 'metronome' | 'rock' | 'ballad' | 'shuffle' | 'slowrock'
  | 'train' | 'bolero' | 'rumba' | 'chacha' | 'tango' | 'bossa' | 'disco' | 'waltz';

export interface BeatPattern {
  label: string;
  hint: string;
  beats: number;
  subdiv: number;
  kick?: string;
  snare?: string;
  hat?: string;
  openHat?: string;
  rim?: string;
  shaker?: string;
  bongo?: string;
  conga?: string;
  guiro?: string;
  clave?: string;
  cowbell?: string;
  comp?: string;
  clap?: string;
  bassLine?: string;
}

export const PATTERNS: Record<Exclude<BeatStyle, 'none' | 'metronome'>, BeatPattern> = {
  rock: {
    label: 'Rock / Pop', hint: 'Nhịp 4/4 phổ thông', beats: 4, subdiv: 2,
    kick: 'X...xx..', snare: '..X...X.', hat: 'xxxxxxxx',
    // guitar dằn ở 2, 4, xen tiếng đẩy nửa phách
    comp: 'x.Xxx.Xx' + 'x.Xxx.XX',
  },
  ballad: {
    label: 'Ballad', hint: 'Chậm, nhẹ nhàng', beats: 4, subdiv: 2,
    kick: 'X....x..', snare: '..x...x.', shaker: 'xxxxxxxx',
    // gõ nhẹ đều từng phách giữ nền hợp âm; ô hai thêm 4& dẫn câu
    comp: 'x.x.x.x.' + 'x.x.x.xx',
  },
  shuffle: {
    label: 'Blues shuffle', hint: 'Nhịp chỏi chuẩn blues', beats: 4, subdiv: 3,
    kick: 'X.....x.....', snare: '...X.....X..', hat: 'x.xx.xx.xx.x',
    // nhịp lắc "dài – ngắn", nhấn 2 và 4
    comp: 'x.xX.xx.xX.x',
  },
  slowrock: {
    label: 'Slow rock', hint: 'Chùm ba, hợp nhạc trữ tình', beats: 4, subdiv: 3,
    kick: 'X.....x.x...', snare: '...X.....X..', hat: 'xxxxxxxxxxxx',
    // piano chùm ba "ta-ta-ta" suốt ô nhịp, nhấn đầu phách
    comp: 'XxxXxxXxxXxx',
  },
  train: {
    label: 'Train (tàu hoả)', hint: 'Nhịp đồng quê kinh điển cho harp', beats: 4, subdiv: 4,
    kick: 'X.......x.......', snare: 'xxXxxxXxxxXxxxXx',
    // đồng quê "bùm – chíc chíc": hợp âm ở 2, 2&, 4, 4&
    comp: '....X.x.....X.x.',
  },
  bolero: {
    // bass "bùm… bùm bùm" (1, 2&, 3), bongo martillo, conga nền, güiro + maracas
    label: 'Bolero', hint: 'Bolero Việt', beats: 4, subdiv: 4,
    kick:   'X.....x.X.......' + 'X.....x.X.....x.',
    rim:    '....x.......x...' + '....x.......x.x.',
    bongo:  'f.t.f.s.f.t.f.o.' + 'f.t.f.s.f.t.s.oo',
    conga:  '......o.t...o.o.' + '......o.t...oo..',
    guiro:  'X.......X.x.....' + 'X.......X.x.x...',
    shaker: 'X.x.x.x.X.x.x.x.',
    // guitar "bùm – chát chát": hợp âm ở 2, 2& và 4, 4&
    comp:   '....x.x.....x.x.' + '....x.x.....x...',
  },
  rumba: {
    // rumba chậm: clave rumba 3-2, conga tumbao (úp–vỗ–mở mở), bass đảo phách ở 2& và 4&
    label: 'Rumba', hint: 'Chậm, lả lơi, hợp nhạc trữ tình', beats: 4, subdiv: 4,
    kick:   'X.....x.X.....x.' + 'X.....x.X..x..x.',
    clave:  'X..x...x..x.x...' + 'X..x...x..x.x...',
    conga:  't.t.s.t.t.t.o.o.' + 't.t.s.t.t.t.o.oo',
    rim:    '............x...' + '..........x.x...',
    shaker: 'X.x.x.x.X.x.x.x.',
    hat:    '..x...x...x...x.',
    // gõ hợp âm lệch nhịp ở 2, 3&, 4 (ô hai thêm 4e dẫn câu)
    comp:   '....x.....x.x...' + '....x.....x.xx..',
  },
  chacha: {
    // chuông cowbell đều 4 phách, güiro dài–ngắn–ngắn, conga mở ở 4 và 4&, gõ vành nhấn "cha-cha" ở 4, 4&
    label: 'Cha cha', hint: 'Cha-cha-cha ở phách 4', beats: 4, subdiv: 4,
    kick:    'X.......X.......' + 'X.......X.....x.',
    cowbell: 'X...x...X...x...',
    guiro:   'X...x.x.X...x.x.',
    conga:   't.t.s.t.t.t.o.o.' + 't.t.s.t.t.t.o.oo',
    rim:     '............x.x.' + '........x...x.x.',
    shaker:  '..x...x...x...x.',
    // gõ hợp âm ở 2, 3, 4 và 4& ("cha-cha"); ô hai thêm 1& lệch nhịp
    comp:    '....x...x...x.x.' + '..x.x...x...x.x.',
  },
  tango: {
    // bass habanera "bùm — bum bùm bùm" rồi marcato; snare dằn 2, 4 và dồn (arrastre) vào phách 1
    label: 'Tango', hint: 'Dằn từng phách, dồn trống vào đầu ô', beats: 4, subdiv: 4,
    kick:  'X..xX.x.X...X...' + 'X..xX.x.X..xX.x.',
    snare: '....X.......X.xx' + '....X.......Xxxx',
    hat:   'x...x...x...x...',
    // marcato đều 4 phách (nhấn 1, 3); ô hai thêm síncopa ở 3a, 4&
    comp:  'X...x...X...x...' + 'X...x...X..x..x.',
  },
  bossa: {
    // bass "bùm… bum – bùm… bum" (1, 2&, 3, 4&), cross-stick theo clave bossa, guitar batida lệch nhịp
    label: 'Bossa nova', hint: 'Nhẹ nhàng, lệch nhịp kiểu Brazil', beats: 4, subdiv: 4,
    kick: 'X.....x.X.....x.' + 'X.....x.X.....x.',
    rim:  'x..x..x...x..x..' + 'x..x..x...x..x..',
    hat:  'x.x.x.x.x.x.x.x.',
    comp: 'x..x..x...x..x..' + '..x..x..x...x..x',
  },
  disco: {
    // trống bass dậm đều 4 phách, hi-hat mở "xì" nửa sau phách, clap 2 & 4, bass nhảy quãng tám
    label: 'Disco', hint: 'Dậm đều 4 phách, bass nhảy quãng tám', beats: 4, subdiv: 4,
    kick:     'X...X...X...X...',
    snare:    '....x.......x...',
    clap:     '....X.......X...',
    hat:      'x...x...x...x...',
    openHat:  '..X...X...X...X.',
    shaker:   '.xx..xx..xx..xx.',
    bassLine: 'r.o.r.o.r.o.r.o.' + 'r.o.r.o.r.o.f.o.',
    comp:     '..x...x...x...x.' + '..x...x...x.x.x.',
  },
  waltz: {
    // "um" = bass phách 1 (gốc / quãng 5 xen kẽ từng ô), "pa pa" = hợp âm đệm phách 2, 3
    label: 'Valse 3/4', hint: 'Um-pa-pa', beats: 3, subdiv: 2,
    kick:   'X.....' + 'X.....',
    comp:   '..x.x.' + '..x.x.',
    hat:    '..x.x.' + '..x.xx',
    shaker: 'x.x.x.',
  },
};

/**
 * "Gõ bo": lớp bongo đệm thêm cho kiểu nhịp chưa có sẵn bongo, chọn theo số phách × độ chia.
 * Nhịp 4/4 dùng martillo (ngón–gót–ngón–vỗ… mở trầm cuối ô), ô thứ hai dồn nhẹ.
 */
const BO_PATTERNS: Record<string, string> = {
  '4/4': 'f.t.f.s.f.t.f.o.' + 'f.t.f.s.f.t.s.oo',
  '4/2': 'ftfsftfo' + 'ftfsftso',
  '4/3': 'f.tf.sf.tf.o' + 'f.tf.sf.ts.o',
  '3/2': 'f.s.s.' + 'f.s.so',
};

export function boPattern(p: BeatPattern): string | undefined {
  return p.bongo ?? BO_PATTERNS[`${p.beats}/${p.subdiv}`];
}

export const BO_PATTERN_LIST = BO_PATTERNS;

export const STYLE_OPTIONS: { value: BeatStyle; label: string }[] = [
  { value: 'none', label: 'Không beat' },
  { value: 'metronome', label: 'Máy đếm nhịp' },
  ...Object.entries(PATTERNS).map(([value, p]) => ({ value: value as BeatStyle, label: p.label })),
];

/** Pattern dùng thực tế, tự lùi về đếm nhịp nếu số phách/ô nhịp không khớp */
export function resolvePattern(style: BeatStyle, beatsPerBar: number): BeatPattern | null {
  if (style === 'none' || style === 'metronome') return null;
  const p = PATTERNS[style];
  if (p.beats === beatsPerBar) return p;
  if (beatsPerBar === 3) return PATTERNS.waltz;
  if (beatsPerBar === 4) return PATTERNS.rock;
  return null;
}
