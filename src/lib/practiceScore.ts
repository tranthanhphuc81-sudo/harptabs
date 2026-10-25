/**
 * Chấm điểm khi tập "Chờ nốt": app chờ bạn thổi đúng mới chuyển nốt, đồng thời ghi lại
 * nốt nào thổi đúng ngay, nốt nào lạc sang nốt khác trước khi đúng, cao độ lệch bao nhiêu cent.
 */
import { db } from './db';

/** số khung (~mỗi khung vài chục ms) giữ đúng / sai liên tiếp mới tính, để tiếng hơi lướt qua không bị bắt */
export const STABLE_FRAMES = 4;
/** lệch tối đa vẫn tính là đúng nốt */
export const HIT_CENTS = 45;

export interface Reading { nearest: number; cents: number }

export interface NoteResult {
  /** vị trí nốt trong bài (chỉ số flat) */
  index: number;
  /** số lần thổi lạc sang nốt khác trước khi đúng */
  misses: number;
  /** lệch cao độ trung bình (tuyệt đối) lúc thổi đúng */
  cents: number;
  /** thời gian từ lúc tới lượt đến lúc thổi đúng */
  ms: number;
}

export interface PracticeSummary {
  score: number;
  done: number;
  total: number;
  /** % nốt thổi đúng ngay, không lạc */
  firstTry: number;
  /** lệch cao độ trung bình (cent) */
  avgCents: number;
  /** các nốt cần tập thêm (lạc nhiều nhất, rồi lâu nhất) */
  weak: NoteResult[];
  finished: boolean;
}

export class WaitScorer {
  results: NoteResult[] = [];
  private good = 0;
  private bad = 0;
  private badMidi: number | null = null;
  private counted = false;
  private misses = 0;
  private cents: number[] = [];
  private since = 0;

  constructor(readonly total: number) {}

  /** bắt đầu chờ nốt ở vị trí `index` (gọi cả khi người dùng chạm chọn nốt khác) */
  begin(now: number) {
    this.good = 0; this.bad = 0; this.badMidi = null; this.counted = false;
    this.misses = 0; this.cents = []; this.since = now;
  }

  /** một lần đọc micro; trả về true khi vừa thổi đúng nốt (chuyển sang nốt kế) */
  feed(r: Reading | null, target: number, index: number, now: number): boolean {
    if (r && r.nearest === target && Math.abs(r.cents) < HIT_CENTS) {
      this.bad = 0; this.badMidi = null; this.counted = false;
      this.good++;
      this.cents.push(Math.abs(r.cents));
      if (this.good < STABLE_FRAMES) return false;
      const c = this.cents.slice(-STABLE_FRAMES);
      this.results.push({ index, misses: this.misses, cents: c.reduce((a, b) => a + b, 0) / c.length, ms: now - this.since });
      this.begin(now);
      return true;
    }
    this.good = 0;
    this.cents = [];
    if (!r) { this.bad = 0; this.badMidi = null; this.counted = false; return false; }
    // giữ một nốt sai đủ lâu = một lần lạc (đổi sang nốt sai khác thì tính lần mới)
    if (r.nearest !== this.badMidi) { this.badMidi = r.nearest; this.bad = 0; this.counted = false; }
    if (r.nearest !== target && ++this.bad >= STABLE_FRAMES && !this.counted) { this.misses++; this.counted = true; }
    return false;
  }

  /** `finished`: đã thổi tới nốt cuối bài */
  summary(finished: boolean): PracticeSummary {
    const done = this.results.length;
    const clean = this.results.filter((r) => r.misses === 0).length;
    const firstTry = done ? clean / done : 0;
    const avgCents = done ? this.results.reduce((a, r) => a + r.cents, 0) / done : 0;
    // 70% thổi đúng ngay + 30% độ chuẩn cao độ (lệch 0¢ = đủ điểm, lệch 40¢ = 0)
    const pitch = Math.max(0, 1 - avgCents / 40);
    const score = done ? Math.round(100 * (0.7 * firstTry + 0.3 * pitch)) : 0;
    const weak = this.results
      .filter((r) => r.misses > 0)
      .sort((a, b) => b.misses - a.misses || b.ms - a.ms)
      .slice(0, 5);
    return { score, done, total: this.total, firstTry, avgCents, weak, finished };
  }
}

// ----- lưu điểm theo bài (bảng kv, không đưa vào file sao lưu) -----

export interface PracticeRecord { best: number; last: number; at: number; times: number }

const key = (songId: string) => `practice:${songId}`;

/** điểm cao nhất / lần gần nhất theo khoá kv bất kỳ (chờ nốt: `practice:<id>`, karaoke: `karaokeScore:<id>`) */
export async function loadBest(kvKey: string): Promise<PracticeRecord | null> {
  return ((await db.kv.get(kvKey))?.value as PracticeRecord | undefined) ?? null;
}

export async function recordBest(kvKey: string, score: number, now = Date.now()): Promise<{ rec: PracticeRecord; newBest: boolean }> {
  const old = await loadBest(kvKey);
  const rec = { best: Math.max(old?.best ?? 0, score), last: score, at: now, times: (old?.times ?? 0) + 1 };
  await db.kv.put({ key: kvKey, value: rec });
  return { rec, newBest: !old || score > old.best };
}

export async function loadPractice(songId: string): Promise<PracticeRecord | null> {
  return loadBest(key(songId));
}

/** chỉ lưu khi tập hết bài; trả về bản ghi mới và có phải điểm cao nhất mới không */
export async function recordPractice(songId: string, score: number, now = Date.now()): Promise<{ rec: PracticeRecord; newBest: boolean }> {
  return recordBest(key(songId), score, now);
}
