import type { HarpKey, NoteNameStyle } from './harp';
import type { BeatStyle } from '../audio/patterns';

export type SongSource = 'sample' | 'user' | 'ai-image' | 'ai-name' | 'scan' | 'import';

export interface Song {
  id: string;
  title: string;
  artist?: string;
  harpKey: HarpKey;
  /** vị trí chơi (1 = thẳng, 2 = cross harp, 3 = slant) */
  position?: 1 | 2 | 3;
  songKey?: string;
  bpm: number;
  /** ví dụ "4/4", "3/4" */
  timeSig: string;
  /** số phách của ô nhịp lấy đà (anacrusis) */
  pickupBeats: number;
  style: BeatStyle;
  difficulty: 1 | 2 | 3;
  /** nội dung tab theo định dạng văn bản (xem lib/tabText.ts) */
  body: string;
  notes?: string;
  tags: string[];
  source: SongSource;
  favorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastPracticedAt?: number;
}

export interface Settings {
  aiMode: 'proxy' | 'direct';
  proxyUrl: string;
  appToken: string;
  geminiKey: string;
  model: string;
  noteNames: NoteNameStyle;
  showNoteNames: boolean;
  tabSize: 's' | 'm' | 'l';
  theme: 'system' | 'light' | 'dark';
  defaultHarpKey: HarpKey;
}

export const DEFAULT_SETTINGS: Settings = {
  aiMode: 'proxy',
  proxyUrl: 'https://harptabs-ai.tranthanhphuc81.workers.dev',
  appToken: '',
  geminiKey: '',
  model: 'gemini-3.5-flash-lite',
  noteNames: 'letter',
  showNoteNames: false,
  tabSize: 'm',
  theme: 'system',
  defaultHarpKey: 'C',
};

export interface AiLogEntry {
  id?: number;
  at: number;
  kind: 'image' | 'name';
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  songId?: string;
}

export function beatsPerBar(timeSig: string): number {
  const n = Number(timeSig.split('/')[0]);
  return n >= 1 && n <= 12 ? n : 4;
}
