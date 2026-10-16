/**
 * Beat mẫu. Mỗi track là chuỗi ký tự trên lưới (beats × subdiv):
 *   x = đánh, X = đánh mạnh, g = gõ rất khẽ (ghost), . = nghỉ
 * Track có thể dài 2 ô nhịp (ô thứ hai là biến tấu), lặp lại theo chu kỳ.
 * Bộ gõ La-tinh dùng ký hiệu riêng:
 *   bongo / conga: f = ngón nhẹ, t = gót tay (trầm, tắt), s = vỗ (slap), h = mở cao, o = mở trầm
 *   guiro: X = cạo dài, x = cạo ngắn
 *   clave: x/X = gõ hai thanh gỗ
 *   cowbell: x/X = chuông bò (cencerro)
 *   clap: x/X = vỗ tay
 *   ride: x/X = chũm chọe ride
 *   surdo: x/X = trống cái trầm samba
 *   bassLine: đường bass riêng thay cho bass theo trống — r = gốc, o = gốc quãng tám trên, f = quãng 5,
 *             t = quãng 3, a = nốt dẫn nửa cung vào gốc hợp âm kế tiếp,
 *             w = bass walking tự dẫn theo hợp âm kế tiếp, n = gốc hợp âm của ô sau (đón nhịp)
 *   comp: x/X = gõ hợp âm đệm (theo hợp âm đang dùng, công tắc "Đệm hợp âm")
 */
export type BeatStyle =
  | 'none' | 'metronome' | 'rock' | 'ballad' | 'shuffle' | 'slowrock'
  | 'train' | 'bolero' | 'rumba' | 'chacha' | 'tango' | 'bossa' | 'disco' | 'jazz' | 'reggae' | 'ska' | 'country' | 'march' | 'polka' | 'samba' | 'salsa' | 'waltz';

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
  ride?: string;
  surdo?: string;
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
  jazz: {
    // ride "ding – ding-a", hi-hat chân 2 & 4, kick dậm khẽ, bass walking dẫn theo hợp âm sau, piano Charleston
    label: 'Jazz swing', hint: 'Ride "ding ding-a", bass walking', beats: 4, subdiv: 3,
    ride:     'x..X.xx..X.x',
    hat:      '...x.....x..',
    kick:     'g..g..g..g..',
    snare:    '........g...' + '.....g....gx',
    bassLine: 'w..w..w..w..',
    comp:     'X....x......' + '...x.....x..',
  },
  reggae: {
    // "one drop": kick + gõ vành chỉ ở phách 3, guitar skank chặt ở 2 & 4, bass lệch nhịp
    label: 'Reggae', hint: 'One drop: trống ở phách 3, guitar chặt 2 & 4', beats: 4, subdiv: 4,
    kick:     '........X.......',
    rim:      '........X.......',
    hat:      'x.x.x.x.x.x.x.x.',
    openHat:  '................' + '..............x.',
    comp:     '....X.......X...' + '....X.......X.x.',
    bassLine: 'r.....r.f.....t.' + 'r.....r.f..f.a..',
  },
  ska: {
    // guitar chặt hợp âm ở mọi nửa sau phách, snare 2 & 4, bass walking mỗi phách
    label: 'Ska', hint: 'Nhanh, guitar chặt mọi nửa phách, bass walking', beats: 4, subdiv: 2,
    kick:     'X...X...',
    snare:    '..X...X.',
    hat:      'xxxxxxxx',
    comp:     '.X.X.X.X',
    bassLine: 'w.w.w.w.',
  },
  country: {
    // two-beat "bùm – chát": bass gốc (1) ↔ quãng 5 (3), hợp âm ở 2 & 4, ô hai đi lên (walk-up) vào hợp âm sau
    label: 'Country', hint: 'Bùm – chát, bass gốc ↔ quãng 5', beats: 4, subdiv: 4,
    kick:     'X.......X.......',
    snare:    '....X.......X...',
    hat:      'x.x.x.x.x.x.x.x.',
    comp:     '....X.......X...' + '....X.......X.x.',
    bassLine: 'r.......f.......' + 'r.......f...t.a.',
  },
  march: {
    // oom-pah: bass gốc (1) ↔ quãng 5 (3), hợp âm "pah" 2 & 4, chũm chọe 2 & 4, snare dồn nhà binh
    label: 'March (hành khúc)', hint: 'Oom-pah, snare dồn kiểu nhà binh', beats: 4, subdiv: 4,
    kick:     'X.......X.......',
    openHat:  '....X.......X...',
    snare:    '..x.X..x..x.X...' + '..x.X..x..x.Xxxx',
    comp:     '....X.......X...',
    bassLine: 'r.......f.......',
  },
  polka: {
    // oom-pah nhanh: bass mọi phách gốc ↔ quãng 5, hợp âm "pah" nửa sau mỗi phách (tay phải accordion)
    label: 'Polka', hint: 'Oom-pah nhanh, hợp âm nửa sau mỗi phách', beats: 4, subdiv: 2,
    kick:     'X.x.X.x.',
    snare:    '.x.x.x.x',
    comp:     '.X.X.X.X',
    bassLine: 'r.f.r.f.' + 'r.f.r.ta',
  },
  samba: {
    // surdo nhẹ 1, 3 – nện 2, 4; ganzá rắc ¼ phách nhấn cuối phách; tamborim teleco-teco; bass "bùm… ba-bùm"
    label: 'Samba', hint: 'Rộn ràng Brazil: surdo, ganzá, tamborim', beats: 4, subdiv: 4,
    surdo:    'x...X...x...X...',
    kick:     'x..x....x..x....',
    shaker:   'xxxXxxxXxxxXxxxX',
    rim:      'x.x..x.x.x..x...' + 'x.x..x.x.x..x.x.',
    comp:     '..x.x..x..x.x..x',
    bassLine: 'r..rf...r..rf...',
  },
  salsa: {
    // clave son 3-2, conga tumbao, cowbell 4 phách, bass tumbao đón nhịp (5 ở 2&, gốc hợp âm ô sau ở 4), piano montuno
    label: 'Salsa', hint: 'Clave 3-2, conga tumbao, bass đón nhịp', beats: 4, subdiv: 4,
    clave:    'X.....X.....X...' + '....X...X.......',
    conga:    't.t.s.t.t.t.o.o.' + 't.t.s.t.t.t.o.oo',
    cowbell:  'X...x...X...x...',
    kick:     '......g.....x...',
    bassLine: '......f.....n...',
    comp:     '..x..x.x..x..x.x' + 'x..x.x..x..x.x..',
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
  // 2/4 dùng chung lớp bo của 4/4 (chuỗi được chia đôi ô như các track khác)
  return p.bongo ?? BO_PATTERNS[`${p.beats === 2 ? 4 : p.beats}/${p.subdiv}`];
}

export const BO_PATTERN_LIST = BO_PATTERNS;

export const STYLE_OPTIONS: { value: BeatStyle; label: string }[] = [
  { value: 'none', label: 'Không beat' },
  { value: 'metronome', label: 'Máy đếm nhịp' },
  ...Object.entries(PATTERNS).map(([value, p]) => ({ value: value as BeatStyle, label: p.label })),
];

/** Pattern dùng thực tế, tự lùi về đếm nhịp nếu số phách/ô nhịp không khớp */
const halves = new Map<BeatPattern, BeatPattern>();

export function resolvePattern(style: BeatStyle, beatsPerBar: number): BeatPattern | null {
  if (style === 'none' || style === 'metronome') return null;
  const p = PATTERNS[style];
  if (p.beats === beatsPerBar) return p;
  // nhịp 2/4: mỗi ô 4/4 thành hai ô 2/4 (chuỗi track giữ nguyên, chỉ chia đôi độ dài ô)
  if (beatsPerBar === 2 && p.beats === 4) {
    let h = halves.get(p);
    if (!h) { h = { ...p, beats: 2 }; halves.set(p, h); }
    return h;
  }
  if (beatsPerBar === 3) return PATTERNS.waltz;
  if (beatsPerBar === 4) return PATTERNS.rock;
  if (beatsPerBar === 2) return resolvePattern('rock', 2);
  return null;
}

/**
 * Đệm hát (guitar / piano tự đệm, không trống). Mỗi ký tự là một ô trên lưới beats × subdiv,
 * chuỗi dài 2 ô nhịp thì ô thứ hai là biến tấu:
 *   B = bass gốc (ngón cái), F = bass quãng 5, D = quạt xuống, d = quạt xuống khẽ,
 *   U = quạt lên (dây cao), X = gõ bo (chặn dây + vỗ thùng đàn; guitar quạt / piano: hợp âm dằn), . = nghỉ
 */
export interface StrumPattern { beats: number; subdiv: number; strum: string }

const STRUM_PATTERNS: Record<Exclude<BeatStyle, 'none' | 'metronome'>, StrumPattern> = {
  rock: { beats: 4, subdiv: 2, strum: 'BDXUDUXU' },
  ballad: { beats: 4, subdiv: 2, strum: 'B.XUFUXU' },
  shuffle: { beats: 4, subdiv: 3, strum: 'B.UX.UF.UX.U' },
  slowrock: { beats: 4, subdiv: 3, strum: 'BUUXUUFUUXUU' },
  train: { beats: 4, subdiv: 4, strum: 'B...X.U.F...X.U.' },
  bolero: { beats: 4, subdiv: 4, strum: 'B...X.B.F...X.U.' },
  rumba: { beats: 4, subdiv: 4, strum: 'B..U..X.F..U..X.' },
  chacha: { beats: 4, subdiv: 4, strum: 'B...X...F...X.X.' },
  tango: { beats: 4, subdiv: 4, strum: 'B...X...F...X.d.' },
  bossa: { beats: 4, subdiv: 4, strum: 'B..d..d.F..d.d..' },
  disco: { beats: 4, subdiv: 4, strum: 'B.U.X.U.F.U.X.U.' },
  jazz: { beats: 4, subdiv: 3, strum: 'B..X..F..X..' },
  reggae: { beats: 4, subdiv: 4, strum: 'B...X...F...X...' },
  ska: { beats: 4, subdiv: 2, strum: 'BXFXBXFX' },
  country: { beats: 4, subdiv: 4, strum: 'B...X.U.F...X.U.' },
  march: { beats: 4, subdiv: 4, strum: 'B...D...F...D...' },
  polka: { beats: 4, subdiv: 2, strum: 'BXFXBXFX' },
  samba: { beats: 4, subdiv: 4, strum: 'B..U.UX.F..U.UX.' },
  salsa: { beats: 4, subdiv: 4, strum: 'B..U..X.F.U...X.' },
  waltz: { beats: 3, subdiv: 2, strum: 'B.XUXU' + 'F.XUXU' },
};

/** Điệu đệm hát cho kiểu nhịp + số phách (không beat / đếm nhịp: ballad hoặc valse) */
export function strumPattern(style: BeatStyle, beatsPerBar: number): StrumPattern {
  const base = style === 'none' || style === 'metronome' ? null : STRUM_PATTERNS[style];
  if (base && base.beats === beatsPerBar) return base;
  // 2/4: chuỗi 4/4 chia đôi thành hai ô
  if (beatsPerBar === 2) return { ...(base && base.beats === 4 ? base : STRUM_PATTERNS.ballad), beats: 2 };
  if (beatsPerBar === 3) return STRUM_PATTERNS.waltz;
  if (beatsPerBar === 4) return STRUM_PATTERNS.ballad;
  // nhịp lạ (5/4, 6/4…): bass đầu ô, gõ bo + quạt lên các phách sau
  const n = Math.max(1, beatsPerBar);
  return { beats: n, subdiv: 2, strum: 'B.' + 'XU'.repeat(n - 1) };
}

/** Lắc (maracas) thêm cho kiểu nhịp chưa có sẵn: đều từng ô, nhấn đầu phách */
export function lacPattern(p: BeatPattern): string {
  return ('X' + 'x'.repeat(Math.max(0, p.subdiv - 1))).repeat(p.beats);
}
