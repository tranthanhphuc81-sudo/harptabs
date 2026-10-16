/**
 * Lưu ảnh khuông nhạc đã quét kèm kết quả đọc (vị trí nốt, số lỗ kèn) cùng bài hát,
 * để mở lại xem / sửa tiếp trên ảnh. Ảnh lưu dạng JPEG xám trong IndexedDB, chỉ trên máy.
 */
import { db } from './db';
import type { HarpKey, HarpType } from './harp';
import { Gray, OmrNote, OmrPage, OmrStaff, toGray } from './omr';

export interface SavedScanPage {
  image: Blob;
  width: number;
  height: number;
  scale: number;
  staves: OmrStaff[];
  notes: OmrNote[];
}

export interface SongScan {
  songId: string;
  savedAt: number;
  keySig: number;
  timeSig: string;
  tempo: number;
  target: HarpKey | 'auto';
  /** loại kèn lúc lưu; không ghi = diatonic */
  harpType?: HarpType;
  allowTranspose: boolean;
  /** số lỗ kèn của từng nốt lúc lưu (id nốt → token) */
  tokens: Record<string, string | null>;
  pages: SavedScanPage[];
}

export async function grayToBlob(g: Gray): Promise<Blob> {
  const c = document.createElement('canvas');
  c.width = g.width; c.height = g.height;
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(g.width, g.height);
  for (let i = 0, j = 0; i < g.data.length; i++, j += 4) {
    img.data[j] = img.data[j + 1] = img.data[j + 2] = g.data[i];
    img.data[j + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh'))), 'image/jpeg', 0.85));
}

export async function blobToGray(b: Blob): Promise<Gray> {
  const bmp = await createImageBitmap(b);
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  return toGray(ctx.getImageData(0, 0, bmp.width, bmp.height).data, bmp.width, bmp.height);
}

export async function saveScan(
  songId: string,
  pages: OmrPage[],
  meta: Omit<SongScan, 'songId' | 'savedAt' | 'pages'>,
): Promise<void> {
  const saved: SavedScanPage[] = await Promise.all(pages.map(async (p) => ({
    image: await grayToBlob(p.image),
    width: p.image.width,
    height: p.image.height,
    scale: p.scale,
    staves: p.staves,
    notes: p.notes,
  })));
  await db.scans.put({ songId, savedAt: Date.now(), pages: saved, ...meta });
}

/** Dựng lại các trang để sửa tiếp (ảnh đã chuẩn hoá, không đọc lại) */
export async function loadScanPages(scan: SongScan): Promise<OmrPage[]> {
  return Promise.all(scan.pages.map(async (p) => ({
    image: await blobToGray(p.image),
    scale: p.scale,
    keySig: scan.keySig,
    staves: p.staves,
    notes: p.notes,
  })));
}
