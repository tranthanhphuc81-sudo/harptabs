// Chép bộ đọc chữ (Tesseract) + dữ liệu tiếng Việt vào public/ocr để app tự phục vụ, chạy được offline
// (không tải từ CDN). Chạy sau npm install / trước dev, build.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'ocr');
const files = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  // chỉ cần bản LSTM (đọc bằng mạng nơ-ron); máy tự chọn bản hợp với trình duyệt
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['@tesseract.js-data/vie/4.0.0_best_int/vie.traineddata.gz', 'vie.traineddata.gz'],
];

mkdirSync(out, { recursive: true });
for (const [from, to] of files) {
  const src = join(nm, from), dst = join(out, to);
  if (!existsSync(src)) {
    console.warn(`[copy-ocr] thiếu ${from} — chạy npm install`);
    continue;
  }
  if (existsSync(dst) && statSync(dst).size === statSync(src).size) continue;
  copyFileSync(src, dst);
}
