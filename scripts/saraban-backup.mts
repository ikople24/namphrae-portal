// scripts/saraban-backup.mts
// สำรองไฟล์แนบสารบรรณทั้ง bucket ลงโฟลเดอร์ในเครื่อง + รายงานไฟล์กำพร้า (สเปกข้อ 12 ข้อ 3)
// รัน: npm run backup:saraban -- <โฟลเดอร์ปลายทาง>
// env: BUCKET_* ของ bucket ที่จะสำรอง · MONGODB_URI ถ้าต้องการรายงานไฟล์กำพร้าของ production
// ไม่ลบอะไรเลย: ไฟล์ที่มีอยู่แล้วขนาดเท่าเดิมข้าม (รันซ้ำได้) · ไฟล์กำพร้าแค่รายงาน

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { getObjectBytes, isStorageConfigured, listKeys } from '@/lib/saraban-storage';
import { attachedKeys } from '@/lib/saraban-store';

const dest = process.argv[2];
if (!dest) {
  console.error('ใช้: npm run backup:saraban -- <โฟลเดอร์ปลายทาง>');
  process.exit(1);
}
if (!isStorageConfigured()) {
  console.error('ไม่มี BUCKET_* ใน env');
  process.exit(1);
}

const objects = await listKeys();
let copied = 0;
let skipped = 0;
for (const { key, bytes } of objects) {
  const target = path.join(dest, key);
  const existing = await fs.stat(target).catch(() => null);
  if (existing?.size === bytes) {
    skipped += 1;
    continue;
  }
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, await getObjectBytes(key));
  copied += 1;
}
console.log(`สำรอง ${objects.length} ไฟล์ → ${dest} (คัดลอก ${copied} · มีอยู่แล้ว ${skipped})`);

const attached = await attachedKeys(objects.map((o) => o.key));
const orphans = objects.filter((o) => !attached.has(o.key));
console.log(`ไฟล์กำพร้า (ไม่ผูกกับหนังสือเรื่องใด) ${orphans.length} ไฟล์`);
for (const o of orphans) console.log(`  ${o.key} (${o.bytes} bytes)`);
