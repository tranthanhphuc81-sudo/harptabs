/**
 * Karaoke: gom các nốt của tab thành dòng lời / âm tiết có thời gian (đơn vị phách),
 * để màn hình lời tô chữ chạy theo tiếng và đếm ngược vào câu.
 * Mọi hàm ở đây là hàm thuần — thời điểm đang phát lấy từ Player.currentBeat() (đã trừ độ trễ loa).
 */
import type { FlatEvent } from './tabText';

export interface KSyl {
  /** chữ; '' = nốt không lời (dòng nhạc dạo, nốt trước chữ đầu dòng) */
  text: string;
  /** có gạch nối sang âm tiết sau ("Hap-py") */
  hyphen: boolean;
  start: number;
  end: number;
  /** các nốt (chỉ số trong flat) của âm tiết: nốt đầu + các nốt luyến (_) kéo dài chữ */
  fi: number[];
}

export interface KLine {
  start: number;
  end: number;
  syls: KSyl[];
  /** dòng không có lời (dạo nhạc, gian tấu) */
  instrumental: boolean;
}

/** Gom nốt thành dòng (theo dòng tab) và âm tiết. Nốt không lời nối liền sau một chữ = luyến, kéo dài chữ đó; dấu nghỉ ngắt chữ. */
export function buildKaraoke(flat: FlatEvent[]): KLine[] {
  const groups: number[][] = [];
  let lastKey = '';
  flat.forEach((ev, i) => {
    const key = `${ev.sectionIndex}.${ev.lineIndex}`;
    if (key !== lastKey) { groups.push([]); lastKey = key; }
    groups[groups.length - 1].push(i);
  });
  const lines: KLine[] = [];
  for (const idx of groups) {
    const notes = idx.filter((i) => flat[i].token !== null);
    if (!notes.length) continue; // dòng toàn dấu nghỉ
    const instrumental = !idx.some((i) => flat[i].lyric);
    const syls: KSyl[] = [];
    let cur: KSyl | null = null;
    for (const i of idx) {
      const ev = flat[i];
      const end = ev.start + ev.beats;
      if (ev.token === null) { cur = null; continue; }
      if (ev.lyric || instrumental || !cur) {
        cur = { text: ev.lyric ?? '', hyphen: !!ev.hyphen, start: ev.start, end, fi: [i] };
        syls.push(cur);
      } else {
        cur.end = end;
        cur.fi.push(i);
      }
    }
    lines.push({ start: syls[0].start, end: syls[syls.length - 1].end, syls, instrumental });
  }
  return lines;
}

/** chỉ số phần tử cuối cùng có start <= beat (-1 nếu chưa tới phần tử đầu) */
function lastStarted<T extends { start: number }>(xs: T[], beat: number): number {
  let lo = 0, hi = xs.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (xs[mid].start <= beat + 1e-9) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

export interface KPos {
  /** dòng đang hiện to trên màn hình */
  line: number;
  /** âm tiết đang hát trong dòng đó (-1: chưa tới chữ đầu dòng) */
  syl: number;
  /** đã hát được bao nhiêu phần âm tiết đang hát (0..1) */
  p: number;
}

/**
 * Vị trí trên màn hình lời ở phách `beat`.
 * Dòng đang hát giữ trên màn hình tới khi hát xong; hát xong thì chuyển ngay sang dòng kế (để kịp đọc trước).
 */
export function locate(lines: KLine[], beat: number): KPos {
  if (!lines.length) return { line: -1, syl: -1, p: 0 };
  const li = lastStarted(lines, beat);
  if (li < 0) return { line: 0, syl: -1, p: 0 };
  if (beat >= lines[li].end - 1e-9 && li + 1 < lines.length) return { line: li + 1, syl: -1, p: 0 };
  const line = lines[li];
  const si = lastStarted(line.syls, beat);
  if (si < 0) return { line: li, syl: -1, p: 0 };
  const s = line.syls[si];
  const p = Math.min(1, Math.max(0, (beat - s.start) / Math.max(1e-6, s.end - s.start)));
  return { line: li, syl: si, p };
}

/**
 * Đếm ngược vào câu (số phách còn lại, 1..4) khi trước câu có khoảng lặng từ 2 phách trở lên
 * (đầu bài, sau đoạn dạo / gian tấu). null = không cần đếm.
 */
export function countdownAt(lines: KLine[], beat: number): number | null {
  const next = lines.findIndex((l) => l.start > beat + 1e-9);
  if (next < 0) return null;
  const line = lines[next];
  if (line.instrumental) return null;
  const prevEnd = next > 0 ? lines[next - 1].end : 0;
  if (beat < prevEnd - 1e-9 || line.start - prevEnd < 2) return null;
  const left = line.start - beat;
  return left <= 4 ? Math.max(1, Math.ceil(left - 1e-9)) : null;
}

/** số lỗ kèn của âm tiết, lấy từ bản tab (bản gốc hoặc bản xếp lại cho kèn khác — cùng chỉ số nốt) */
export function holesFor(syl: KSyl, flat: FlatEvent[]): (string | null)[] {
  return syl.fi.map((i) => flat[i]?.token ?? null);
}
