// Dịch nội dung dài (bài học, lick, ghi chú bài mẫu) — xem src/lib/i18nData.ts.
//   node scripts/i18n-data.mjs missing        → liệt kê câu tiếng Việt trong src/data chưa có bản dịch
//   node scripts/i18n-data.mjs build <file>   → ghép file JSON [{ "vi": "...", "en": "..." }] vào src/data/en/dataEn.ts
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { pathToFileURL } from 'node:url';

export function textHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/;
const DATA = 'src/data';
const OUT = 'src/data/en/dataEn.ts';

/** mọi câu cần dịch trong bài học, lick, bài mẫu (chỉ tên / tác giả / ghi chú và tên đoạn "# ..." trong tab) */
export function collect() {
  const seen = new Map();
  const add = (k, f) => { k = k.trim(); if (k && VN.test(k) && !seen.has(k)) seen.set(k, f); };
  for (const f of fs.readdirSync(DATA).filter((f) => /\.ts$/.test(f) && !/test/.test(f) && /essons|icks|amples/.test(f))) {
    const sf = ts.createSourceFile(f, fs.readFileSync(path.join(DATA, f), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const isSample = /amples/.test(f);
    (function walk(n) {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        const p = n.parent;
        if (ts.isImportDeclaration(p)) return;
        const prop = ts.isPropertyAssignment(p) && p.initializer === n ? p.name.getText() : null;
        if (prop === 'body' || (prop === 'notes' && /icks/.test(f))) {
          for (const line of n.text.split('\n')) { const m = /^#\s*(.+)$/.exec(line.trim()); if (m) add(m[1], f); }
          return;
        }
        if (isSample) { if (['title', 'artist', 'notes'].includes(prop)) add(n.text, f); return; }
        if (prop === 'id' || prop === 'to') return;
        add(n.text, f);
        return;
      }
      ts.forEachChild(n, walk);
    })(sf);
  }
  return [...seen.entries()].map(([vi, file]) => ({ vi, file }));
}

function loadOut() {
  if (!fs.existsSync(OUT)) return {};
  const m = /= (\{[\s\S]*\});/.exec(fs.readFileSync(OUT, 'utf8'));
  return m ? JSON.parse(m[1]) : {};
}

const [cmd, file] = process.argv.slice(2);
const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (!isCli) {
  // được import (test): không chạy lệnh
} else if (cmd === 'missing') {
  const have = loadOut();
  const miss = collect().filter((e) => !(textHash(e.vi) in have));
  for (const e of miss) console.log(`${e.file}\t${e.vi.replace(/\n/g, '\n')}`);
  console.error(`${miss.length} câu chưa dịch`);
} else if (cmd === 'build') {
  const map = loadOut();
  for (const { vi, en } of JSON.parse(fs.readFileSync(file, 'utf8'))) map[textHash(vi.trim())] = en;
  const body = JSON.stringify(map, null, 0).replace(/","/g, '",\n"');
  fs.writeFileSync(OUT, `/** Sinh bằng scripts/i18n-data.mjs — đừng sửa tay. Khoá là mã băm câu tiếng Việt, xem src/lib/i18nData.ts */\nexport const EN_DATA: Record<string, string> = ${body};\n`);
  console.log(`${Object.keys(map).length} câu trong ${OUT}`);
} else {
  console.log('dùng: node scripts/i18n-data.mjs missing | build <file.json>');
}
