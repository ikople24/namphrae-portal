// คัดลอก collection ของ namphrae-map จาก db_namphrae → namphrae_portal
// upsert ตาม _id เดิม จึงรันซ้ำได้ไม่จำกัดและได้ผลเท่าเดิมเสมอ
//
// ใช้สองรอบตามแผนย้าย: รอบแรกเพื่อเริ่มเทียบสองเว็บ รอบสองก่อนปิด namphrae-map
// เพื่อเก็บข้อมูลที่เข้ามาระหว่างช่วงรันคู่
//
//   npm run copy:map -- --dry-run   ดูว่าจะเพิ่ม/อัปเดตกี่รายการ ไม่เขียนจริง
//   npm run copy:map                คัดลอกจริง
//
// submittedreports ไม่อยู่ในรายการนี้โดยเจตนา — เป็นของระบบแจ้งเรื่อง LINE
// portal อ่านข้าม db ผ่าน getReportsDb() ถ้าคัดลอกมา ข้อมูลจะแช่แข็งทันที
import './load-env';
import { MongoClient } from 'mongodb';
import { ensureMigratedIndexes } from '../src/lib/db-indexes';

const SOURCE_DB = 'db_namphrae';
const TARGET_DB = process.env.MONGODB_DB || 'namphrae_portal';

const COLLECTIONS: { from: string; to: string }[] = [
  { from: 'incidents', to: 'incidents' },
  { from: 'dengueregistrycases', to: 'diseaseCases' },
  { from: 'dengueyearstats', to: 'diseaseYearStats' },
  { from: 'chikunmooyears', to: 'chikunMooYears' },
];

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('ตั้ง MONGODB_URI ใน .env.local ก่อน');
    process.exit(1);
  }

  const client = new MongoClient(uri);
  await client.connect();

  try {
    const source = client.db(SOURCE_DB);
    const target = client.db(TARGET_DB);
    console.log(`${SOURCE_DB} → ${TARGET_DB}${dryRun ? '  (ซ้อมอย่างเดียว ไม่เขียนจริง)' : ''}\n`);

    let grandTotal = 0;
    for (const { from, to } of COLLECTIONS) {
      const docs = await source.collection(from).find({}).toArray();
      let added = 0;
      let updated = 0;

      for (const doc of docs) {
        // __v เป็นขยะจาก mongoose ไม่ต้องพามาด้วย
        const { __v, ...rest } = doc as Record<string, unknown>;
        const exists = await target.collection(to).countDocuments({ _id: doc._id }, { limit: 1 });
        if (exists) updated++;
        else added++;
        if (!dryRun) {
          await target.collection(to).replaceOne({ _id: doc._id }, rest, { upsert: true });
        }
      }

      grandTotal += docs.length;
      console.log(
        `${to.padEnd(18)} อ่าน ${String(docs.length).padStart(5)}` +
          `  เพิ่ม ${String(added).padStart(5)}  อัปเดต ${String(updated).padStart(5)}`
      );
    }

    console.log(`\nรวม ${grandTotal} รายการ`);

    if (!dryRun) {
      await ensureMigratedIndexes(target);
      console.log('สร้างดัชนีครบแล้ว');
    }
  } finally {
    // driver เปิด socket ค้างในพูลการเชื่อมต่อ ซึ่งกัน event loop ของ Node ไม่ให้ออกเอง
    // ไม่ปิด client = สคริปต์ค้างจนกว่าจะถูก kill
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
