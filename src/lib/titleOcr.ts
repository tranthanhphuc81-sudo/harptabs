/**
 * Tên bài trên ảnh bản nhạc: cắt vùng tiêu đề (findTitleBox) rồi đọc chữ bằng Tesseract chạy ngay trên máy
 * (dữ liệu tiếng Việt phục vụ từ /ocr, tải lần đầu rồi giữ lại → offline). Chữ in đọc tốt; chữ viết tay /
 * nghệ thuật thì độ tin cậy thấp → không tự điền, chỉ hiện ảnh vùng tiêu đề cho người dùng gõ theo.
 */
import type { Gray, TitleBox } from './omr';

/** Dưới mức này coi như đọc sai (chữ viết tay cho ra ký tự rác, độ tin cậy ~20) */
export const MIN_CONFIDENCE = 60;

/** Dọn chữ máy đọc: bỏ dấu câu thừa hai đầu, gộp khoảng trắng; CHỮ IN HOA TOÀN BỘ → viết hoa chữ đầu */
export function cleanTitle(raw: string): string {
  let t = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  t = t.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N})]+$/u, '');
  const letters = t.replace(/[^\p{L}]/gu, '');
  if (letters.length >= 4 && letters === letters.toLocaleUpperCase('vi')) {
    t = t.toLocaleLowerCase('vi');
    t = t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);
  }
  return t;
}

/** Dòng tác giả: bỏ chữ dẫn "Nhạc và lời", "Nhạc:", "Lời:", "Sáng tác", "Thơ:" … */
export function cleanArtist(raw: string): string {
  let t = cleanTitle(raw);
  t = t.replace(/^(nhạc\s*(và|&|\+)\s*lời|nhạc|lời( việt)?|sáng tác|st|thơ|ý thơ|tác giả|music|lyrics?|composer)(?=[\s:：\-–—]|$)\s*[:：\-–—]?\s*/iu, '');
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);
}

/** Kết quả đọc có giống tên bài không: đủ chữ cái, ít ký tự lạ */
export function looksLikeTitle(t: string): boolean {
  const letters = t.replace(/[^\p{L}]/gu, '').length;
  const odd = t.replace(/[\p{L}\p{N}\s,.'’()&!?-]/gu, '').length;
  return letters >= 2 && odd <= Math.max(1, t.length * 0.1);
}

/**
 * Tên bài từ tên file ảnh (vd "nang-thuy-tinh.png" → "nang thuy tinh"); bỏ tên do máy ảnh / app tự đặt
 * (IMG_1234, Screenshot_…, ảnh tải về).
 */
export function titleFromFilename(name: string): string {
  let t = name.replace(/\.[a-z0-9]{2,5}$/i, '').normalize('NFC');
  if (/^(img|image|dsc|dcim|pxl|mvimg|screenshot|screen ?shot|photo|scan|ảnh|anh|zalo|fb|received|capture|picture|untitled|download|tải xuống|unnamed|z\d)/i.test(t)) return '';
  t = t.replace(/[_\-+.]+/g, ' ').replace(/\(\d+\)/g, ' ').replace(/\s+/g, ' ').trim();
  if (/\d{4,}/.test(t)) return '';
  const letters = t.replace(/[^\p{L}]/gu, '').length;
  if (letters < 3 || letters < t.replace(/\s/g, '').length * 0.6) return '';
  return t.charAt(0).toLocaleUpperCase('vi') + t.slice(1);
}

/** Có dấu tiếng Việt / chữ ngoài ASCII → người đặt tên file gõ đàng hoàng, tin hơn máy đọc */
export const hasDiacritics = (t: string) => /[^\x00-\x7f]/.test(t);

/** Vẽ vùng tiêu đề (ảnh xám) ra canvas */
export function cropToCanvas(g: Gray, b: TitleBox): HTMLCanvasElement {
  const w = b.x1 - b.x0, h = b.y1 - b.y0;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = g.data[(y + b.y0) * g.width + x + b.x0], i = (y * w + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

type TessWorker = import('tesseract.js').Worker;
let worker: Promise<TessWorker> | null = null;

function getWorker(): Promise<TessWorker> {
  if (!worker) {
    worker = (async () => {
      const { createWorker } = await import('tesseract.js');
      const base = new URL('ocr/', document.baseURI).href;
      // 1 = OEM.LSTM_ONLY (chỉ cần bản lõi LSTM đã chép sẵn)
      const w = await createWorker('vie', 1, { workerPath: `${base}worker.min.js`, corePath: base, langPath: base, gzip: true, workerBlobURL: false });
      // 7 = PSM.SINGLE_LINE: vùng cắt chỉ có một dòng tiêu đề
      await w.setParameters({ tessedit_pageseg_mode: '7' as never });
      return w;
    })();
    worker.catch(() => { worker = null; }); // lỗi (vd chưa có mạng lần đầu) → lần sau thử lại
  }
  return worker;
}

/** Đọc một dòng chữ (tên bài / tác giả). null nếu không tải được bộ đọc */
export async function readLine(canvas: HTMLCanvasElement): Promise<{ text: string; confidence: number } | null> {
  try {
    const w = await getWorker();
    const { data } = await w.recognize(canvas);
    return { text: data.text, confidence: data.confidence };
  } catch {
    return null;
  }
}
