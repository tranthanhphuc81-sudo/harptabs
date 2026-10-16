/**
 * Đọc bản nhạc PDF: vẽ từng trang thành ảnh để đưa vào máy quét khuông nhạc (offline).
 * Thư viện pdf.js (~1,5 MB) chỉ tải khi mở file PDF lần đầu; bản "legacy" chạy được cả WebView Android cũ.
 */

/** File là PDF (theo kiểu file hoặc đuôi tên) */
export const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

/** Độ rộng ảnh mỗi trang (px): đủ nét cho máy quét đọc nốt mà không chậm */
export const PAGE_WIDTH = 1600;

/** Tỉ lệ vẽ trang rộng `width` điểm thành ảnh rộng ~PAGE_WIDTH px (trang nhỏ không phóng quá 4 lần) */
export function renderScale(width: number): number {
  return Math.min(4, Math.max(0.5, PAGE_WIDTH / Math.max(1, width)));
}

let lib: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;
function loadPdfJs() {
  lib ??= Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'),
  ]).then(([pdfjs, worker]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    return pdfjs;
  }).catch((e) => { lib = null; throw e; });
  return lib;
}

/**
 * Vẽ tối đa `maxPages` trang đầu của file PDF thành ảnh PNG (nền trắng).
 * Ảnh đặt tên theo file gốc: "giac-mo-trua-trang-1.png"…; `total` = số trang của file.
 */
export async function pdfToImages(file: File, maxPages: number): Promise<{ images: File[]; total: number }> {
  const pdfjs = await loadPdfJs();
  let doc;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  } catch (e) {
    const name = (e as Error)?.name;
    throw new Error(name === 'PasswordException' ? 'File PDF có mật khẩu, chưa mở được.' : 'Không mở được file PDF này.');
  }
  const base = file.name.replace(/\.pdf$/i, '');
  const images: File[] = [];
  try {
    const n = Math.min(doc.numPages, Math.max(0, maxPages));
    for (let i = 1; i <= n; i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: renderScale(page.getViewport({ scale: 1 }).width) });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, canvas, viewport }).promise;
      page.cleanup();
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
      if (blob) images.push(new File([blob], `${base}-trang-${i}.png`, { type: 'image/png' }));
      canvas.width = canvas.height = 0; // trả bộ nhớ sớm (điện thoại)
    }
    return { images, total: doc.numPages };
  } finally {
    void doc.destroy();
  }
}
