// scripts/smoke-saraban-storage.mts
// smoke ของ Railway bucket (สเปกข้อ 12 ข้อ 1–2) — อัป · HeadObject · ลิงก์ชั่วคราว · หมดอายุ · ลบ
// รัน: npx tsx --env-file=.env.local scripts/smoke-saraban-storage.mts
// ใช้ bucket ทดสอบเท่านั้น: ปฏิเสธเองถ้า BUCKET_NAME ไม่มี '-dev' (bucket จริงไม่มี backup)

import { randomUUID } from 'node:crypto';
import { PDFDocument } from 'pdf-lib';
import { checkAttachment, CONTENT_TYPES, keyFor } from '@/lib/saraban-attachment';
import { countPdfPages } from '@/lib/saraban-pdf';
import { deleteObject, headObject, isStorageConfigured, putObject, viewUrl } from '@/lib/saraban-storage';

function fail(message: string): never {
  console.error('FAIL', message);
  process.exit(1);
}

if (!isStorageConfigured()) fail('ไม่มี BUCKET_* ใน env');
if (!process.env.BUCKET_NAME?.includes('-dev')) fail(`ไม่ใช่ bucket ทดสอบ: ${process.env.BUCKET_NAME}`);

const pdf = await PDFDocument.create();
pdf.addPage();
pdf.addPage();
const bytes = await pdf.save();
const pages = await countPdfPages(bytes);
const key = keyFor(`smoke-${randomUUID()}`, 'pdf');

try {
  await putObject(key, bytes, CONTENT_TYPES.pdf, pages);
  const head = await headObject(key);
  if (!head) fail('HeadObject ไม่เจอ object ที่เพิ่งอัป');
  const check = checkAttachment(head);
  console.log('head', head.contentType, head.pages, 'check', check.ok && `${check.file.format}/${check.file.pages}`);

  const url = await viewUrl(key, 'หนังสือทดสอบ.pdf', CONTENT_TYPES.pdf);
  const res = await fetch(url);
  console.log('view', res.status, res.headers.get('content-type'), (res.headers.get('content-disposition') ?? '').includes("filename*=UTF-8''"));

  const shortUrl = await viewUrl(key, 'x.pdf', CONTENT_TYPES.pdf, 1);
  await new Promise((r) => setTimeout(r, 3000));
  console.log('expired', (await fetch(shortUrl)).status);

  console.log('missing', await headObject(keyFor(`missing-${randomUUID()}`, 'pdf')));
} finally {
  await deleteObject(key);
  console.log('deleted', (await headObject(key)) === null);
}
