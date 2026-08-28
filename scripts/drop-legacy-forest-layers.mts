// scripts/drop-legacy-forest-layers.mts

// ลบชั้นป่าชุมชนชุดเก่าออกจากโดเมนแผนที่ — รันครั้งเดียวหลัง import:forest สำเร็จ
//
//   npx tsx scripts/drop-legacy-forest-layers.mts
//
// community-forest      2 แปลง (หมู่ 10, 11) → ย้ายไปโดเมนป่าไม้แล้วเป็น 4 แปลง
// community-forest-point 176 หมุด            → หมุดรังวัดที่ใช้ลากขอบเขตเสร็จแล้ว
//                                              ขอบเขตอยู่ในชั้นป่าชุมชนเรียบร้อย
//
// ลบไฟล์บน Cloudinary ตามไปด้วย ไม่งั้นไฟล์กำพร้าจะกองอยู่โดยไม่มีอะไรอ้างถึงและ
// ไม่มีใครรู้ว่ามันคืออะไร — หลักเดียวกับที่ versions.ts ลบไฟล์ทิ้งทันทีเมื่อไม่ผ่านด่าน
//
// รันซ้ำได้: ชั้นที่ถูกลบไปแล้วจะรายงานว่าไม่มีแล้วข้ามไป

import './load-env';
import { destroyRawAsset } from '../src/lib/cloudinary';
import {
  deleteLayer,
  deleteVersions,
  getLayer,
  listVersions,
} from '../src/lib/map-store';
import { closeDb } from '../src/lib/mongodb';

const LEGACY = ['community-forest', 'community-forest-point'];

async function main(): Promise<void> {
  for (const id of LEGACY) {
    const layer = await getLayer(id);
    if (!layer) {
      process.stdout.write(`– ${id}: ไม่มีอยู่แล้ว ข้าม\n`);
      continue;
    }

    const versions = await listVersions(id);
    process.stdout.write(`── ${id} (${layer.title}) — ${versions.length} เวอร์ชัน\n`);

    for (const v of versions) {
      // ชนิดของ asset ต่างกันคนละตัว — ไฟล์เต็มเป็น authenticated ส่วนไฟล์สาธารณะ
      // เป็น upload ส่งชนิดผิดแล้ว Cloudinary จะตอบว่าสำเร็จทั้งที่ไม่มีอะไรถูกลบ
      const targets: { publicId: string; type: 'upload' | 'authenticated' }[] = [];
      if (v.fullAsset) targets.push({ publicId: v.fullAsset.publicId, type: 'authenticated' });
      if (v.publicAsset) targets.push({ publicId: v.publicAsset.publicId, type: 'upload' });

      for (const t of targets) {
        // กันซ้ำรอยเดิม: เคยมีครั้งหนึ่งที่ publicId ของโดเมนป่าไม้ชนกับของแผนที่
        // จนไฟล์ของแผนที่ที่เผยแพร่อยู่ถูกเขียนทับ สคริปต์นี้ลบไฟล์แบบถาวร จึงต้อง
        // ไม่ยอมแตะอะไรที่ไม่ได้อยู่ใต้โฟลเดอร์ของแผนที่ ต่อให้ทะเบียนจะชี้มาก็ตาม
        if (!t.publicId.startsWith('namphrae-portal/map/')) {
          throw new Error(
            `ปฏิเสธการลบไฟล์นอกโฟลเดอร์แผนที่: ${t.publicId} — ทะเบียนของ ${id} ` +
              'ชี้ไปที่ไฟล์ของโดเมนอื่น ต้องมีคนตรวจด้วยตาก่อน'
          );
        }
        try {
          await destroyRawAsset(t.publicId, t.type);
          process.stdout.write(`   ลบไฟล์ ${t.publicId} (${t.type})\n`);
        } catch (err) {
          // ไฟล์ที่หายไปแล้วไม่ใช่เหตุให้หยุด — เป้าหมายคือไม่เหลือไฟล์กำพร้า
          process.stdout.write(`   ! ลบ ${t.publicId} ไม่สำเร็จ: ${String(err)}\n`);
        }
      }
    }

    await deleteVersions(id);
    await deleteLayer(id);
    process.stdout.write(`   ✓ ลบทะเบียนแล้ว\n`);
  }

  process.stdout.write('\nเสร็จแล้ว — /map จะไม่มีชั้นป่าชุมชนอีกต่อไป\n');
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
