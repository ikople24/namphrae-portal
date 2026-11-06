// คัดไฟล์ประกอบของ pdf.js ไป public/pdfjs/ — รันอัตโนมัติตอน postinstall (Railway ใช้ npm ci)
// ทำไม: pdf.js รุ่น 6 ถอดรหัสภาพสแกน (JBIG2/CCITT/JPX) ด้วย wasm และใช้ CMap/ฟอนต์มาตรฐาน/โปรไฟล์สี ICC
// จากไฟล์ภายนอก ถ้าไม่เสิร์ฟไว้ หนังสือราชการที่เป็นภาพสแกนจะขึ้นหน้าว่าง
// public/pdfjs/ เป็นไฟล์ที่สร้างขึ้น อยู่ใน .gitignore — ห้าม commit
// ไม่มี dependency · โฟลเดอร์ไหนไม่มีให้เตือนแล้วไปต่อ (ไม่ทำให้ npm install ล้ม)

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = join(root, 'node_modules', 'pdfjs-dist');
const out = join(root, 'public', 'pdfjs');
const DIRS = ['wasm', 'cmaps', 'standard_fonts', 'iccs'];

if (!existsSync(pkg)) {
  console.warn('[copy-pdfjs-assets] ไม่พบ node_modules/pdfjs-dist — ข้าม');
  process.exit(0);
}

mkdirSync(out, { recursive: true });
for (const dir of DIRS) {
  // ใช้ของ legacy ก่อน (ให้ตรงกับ build ที่ import) ถ้าไม่มีใช้ของชั้นบนสุด
  const src = [join(pkg, 'legacy', dir), join(pkg, dir)].find((p) => existsSync(p));
  const dest = join(out, dir);
  if (!src) {
    console.warn(`[copy-pdfjs-assets] ไม่พบโฟลเดอร์ ${dir} ใน pdfjs-dist — ข้าม`);
    continue;
  }
  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true });
  console.log(`[copy-pdfjs-assets] ${src.slice(root.length + 1)} → public/pdfjs/${dir}`);
}
