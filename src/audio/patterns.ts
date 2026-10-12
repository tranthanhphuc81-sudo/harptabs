/**
 * Beat mẫu. Mỗi track là chuỗi ký tự trên lưới (beats × subdiv):
 *   x = đánh, X = đánh mạnh, . = nghỉ
 */
export type BeatStyle =
  | 'none' | 'metronome' | 'rock' | 'ballad' | 'shuffle' | 'slowrock'
  | 'train' | 'bolero' | 'chacha' | 'waltz';

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
}

export const PATTERNS: Record<Exclude<BeatStyle, 'none' | 'metronome'>, BeatPattern> = {
  rock: {
    label: 'Rock / Pop', hint: 'Nhịp 4/4 phổ thông', beats: 4, subdiv: 2,
    kick: 'X...xx..', snare: '..X...X.', hat: 'xxxxxxxx',
  },
  ballad: {
    label: 'Ballad', hint: 'Chậm, nhẹ nhàng', beats: 4, subdiv: 2,
    kick: 'X....x..', snare: '..x...x.', shaker: 'xxxxxxxx',
  },
  shuffle: {
    label: 'Blues shuffle', hint: 'Nhịp chỏi chuẩn blues', beats: 4, subdiv: 3,
    kick: 'X.....x.....', snare: '...X.....X..', hat: 'x.xx.xx.xx.x',
  },
  slowrock: {
    label: 'Slow rock', hint: 'Chùm ba, hợp nhạc trữ tình', beats: 4, subdiv: 3,
    kick: 'X.....x.x...', snare: '...X.....X..', hat: 'xxxxxxxxxxxx',
  },
  train: {
    label: 'Train (tàu hoả)', hint: 'Nhịp đồng quê kinh điển cho harp', beats: 4, subdiv: 4,
    kick: 'X.......x.......', snare: 'xxXxxxXxxxXxxxXx',
  },
  bolero: {
    label: 'Bolero', hint: 'Bolero Việt', beats: 4, subdiv: 4,
    kick: 'X.......x.x.....', rim: '....x.x.....x...', shaker: 'x.x.x.x.x.x.x.x.',
  },
  chacha: {
    label: 'Cha cha', hint: 'Cha-cha-cha ở phách 4', beats: 4, subdiv: 2,
    kick: 'X...x...', snare: '......xx', hat: 'x.x.x.x.', rim: '..x.....',
  },
  waltz: {
    label: 'Valse 3/4', hint: 'Um-pa-pa', beats: 3, subdiv: 2,
    kick: 'X.....', hat: '..x.x.', rim: '..x.x.',
  },
};

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
