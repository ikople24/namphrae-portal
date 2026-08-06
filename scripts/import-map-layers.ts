// ต้องเป็น import แรกสุด — ดูเหตุผลใน scripts/load-env.ts (โมดูลด้านล่างอ่าน
// process.env ตอนถูก evaluate ซึ่ง ESM ทำก่อนโค้ดในไฟล์นี้เริ่มทำงาน)
import './load-env';
import crypto from 'node:crypto';
// path แบบ relative ไม่ใช่ alias @/ — tsx ไม่ resolve paths ใน tsconfig ให้
// (สคริปต์อื่นในโฟลเดอร์นี้ก็ใช้แบบเดียวกัน)
import {
  isCloudinaryConfigured,
  MAP_FOLDER_FULL,
  uploadRawText,
} from '../src/lib/cloudinary';
import { ingestMapFile } from '../src/lib/map-ingest';
import {
  buildNewVersion,
  getLayer,
  insertVersion,
  listVersions,
  nextVersionNo,
  upsertLayer,
} from '../src/lib/map-store';
import type { GeometryKind, MapLayer } from '../src/types/map';

// นำเข้าเลเยอร์ทั้งสี่จาก qgis2web export ของ namphraesmartcity.ai เป็นครั้งแรก
//
//   npm run import:map
//
// สองข้อที่ตั้งใจ:
//   1. ปล่อยทุกเวอร์ชันไว้เป็น "ร่าง" ไม่เผยแพร่ให้อัตโนมัติ — publicFields ที่
//      สคริปต์ตั้งให้เป็นแค่ข้อเสนอ การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียง
//      ของการรันสคริปต์ เจ้าหน้าที่ต้องเข้าไปดูแล้วกดเผยแพร่เองครั้งเดียวต่อเลเยอร์
//   2. รันซ้ำได้ — ถ้า sha256 ของเนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม
//
// ตรรกะการแกะ/ตรวจ/เทียบเดินผ่าน ingestMapFile ตัวเดียวกับ API route เพื่อไม่ให้
// สคริปต์กลายเป็นทางลัดที่ข้ามด่านตรวจไปโดยไม่มีใครรู้

const BASE = 'https://namphraesmartcity.ai/map/data';

type Seed = {
  file: string;
  layer: Omit<MapLayer, 'updatedAt' | 'updatedBy' | 'currentVersionNo'>;
};

const SEEDS: Seed[] = [
  {
    file: 'ZoneMoobang_2.js',
    layer: {
      id: 'zone-moobang',
      title: 'โซนหมู่บ้าน',
      description: 'ขอบเขตหมู่ 1–11 ตำบลน้ำแพร่',
      geometryType: 'MultiPolygon' as GeometryKind,
      keyFields: ['zone_id'],
      keyComposition: [],
      visibility: 'public',
      // ไม่มี PII เปิดได้ทั้งหมด
      publicFields: ['zone_id', 'Area Km2', 'Area Ria'],
      order: 1,
    },
  },
  {
    file: 'Rordmoobang_5.js',
    layer: {
      id: 'road',
      title: 'ถนน',
      description: 'โครงข่ายถนนจาก OpenStreetMap ตัดตามขอบเขตหมู่',
      geometryType: 'MultiLineString' as GeometryKind,
      // full_id อย่างเดียวซ้ำ 138 แถว เพราะถนนเส้นเดียวที่พาดผ่านสองหมู่ถูกตัด
      // เป็นคนละแถวตอน clip — ต้องคู่กับ zone_id ถึงจะไม่ซ้ำ (1,475/1,475)
      keyFields: ['full_id', 'zone_id'],
      keyComposition: [],
      visibility: 'public',
      publicFields: [
        'name',
        'name_en',
        'alt_name_e',
        'ref',
        'highway',
        'surface',
        'lanes',
        'maxspeed',
        'zone_id',
      ],
      order: 2,
    },
  },
  {
    file: 'buildingnew_4.js',
    layer: {
      id: 'building',
      title: 'อาคาร',
      description: 'ผังอาคารในเขตตำบล',
      geometryType: 'MultiPolygon' as GeometryKind,
      // OBJECTID unique จริงในไฟล์ชุดนี้ แต่เป็นเลขที่ ArcGIS แจกใหม่ทุกรอบ
      // export ยืนยันความคงที่ข้าม export จาก snapshot เดียวไม่ได้ จึงไม่ตั้งเป็น
      // คีย์ไว้ก่อน (เทียบแค่จำนวนกับขอบเขต) เปลี่ยนทีหลังได้ในหน้าตั้งค่า
      keyFields: [],
      keyComposition: [],
      visibility: 'public',
      // OBJECTID/FID_1/Shape_* ไม่มีความหมายต่อคนนอก เปิดไปก็เปลืองขนาดไฟล์
      publicFields: [],
      order: 3,
    },
  },
  {
    file: 'Parcel_3.js',
    layer: {
      id: 'parcel',
      title: 'แปลงที่ดิน',
      description: 'แปลงที่ดินพร้อมรหัสแปลงและเนื้อที่',
      geometryType: 'MultiPolygon' as GeometryKind,
      keyFields: ['parcel_cod'],
      // ไฟล์นี้เป็นข้อมูลสองชุดที่ถูกรวมกัน แยกด้วยความยาว block_id:
      //   A (3,921 แถว) block_id ยาว 1 → parcel_cod = zone_id + block_id + lot
      //   B (3,808 แถว) block_id ยาว 3 → parcel_cod = block_id + lot
      keyComposition: [
        ['zone_id', 'block_id', 'lot'],
        ['block_id', 'lot'],
      ],
      visibility: 'public',
      // เปิดเฉพาะรหัสแปลง เนื้อที่ และตำแหน่งเชิงปกครองของ *ตัวแปลง*
      // ปิด own_* ทั้ง 9 (ที่อยู่ของ *เจ้าของ*), Id_Chanod, parcel_no, survey_no,
      // land_no, survey, mapsheet, land_type, scale, utm_map1-4, utm_scale
      publicFields: [
        'parcel_cod',
        'zone_id',
        'block_id',
        'lot',
        'rai',
        'ngan',
        'wa',
        'subwa',
        'province',
        'amphur',
        'tambol',
      ],
      order: 4,
    },
  },
];

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์แผนที่ต้องมีที่เก็บไฟล์ กรอก CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ก่อน'
    );
  }

  for (const seed of SEEDS) {
    const url = `${BASE}/${seed.file}`;
    process.stdout.write(`\n── ${seed.layer.title} (${seed.layer.id})\n`);
    process.stdout.write(`   ดาวน์โหลด ${url}\n`);

    const res = await fetch(url);
    if (!res.ok) {
      process.stdout.write(`   ✗ ดึงไฟล์ไม่สำเร็จ: ${res.status}\n`);
      continue;
    }
    const text = await res.text();

    const existing = await getLayer(seed.layer.id);
    const layer: MapLayer = existing ?? {
      ...seed.layer,
      currentVersionNo: null,
      updatedAt: new Date().toISOString(),
      updatedBy: 'import-map-layers',
    };
    if (!existing) await upsertLayer(layer);

    const result = ingestMapFile({ text, fileName: seed.file, layer, previous: null });
    if (!result.ok) {
      process.stdout.write(`   ✗ ${result.message}\n`);
      continue;
    }

    const versions = await listVersions(layer.id);
    if (versions.some((v) => v.source.sha256 === result.sha256)) {
      process.stdout.write('   – เนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้ว ข้าม\n');
      continue;
    }
    if (result.blocked) {
      for (const c of result.checks) process.stdout.write(`   ✗ [error] ${c.message}\n`);
      continue;
    }

    const versionNo = nextVersionNo(versions);
    const uploaded = await uploadRawText(JSON.stringify(result.fc), {
      folder: MAP_FOLDER_FULL,
      publicId: `${layer.id}-v${versionNo}-full.geojson`,
      type: 'authenticated',
    });

    await insertVersion(
      buildNewVersion({
        id: crypto.randomUUID(),
        layerId: layer.id,
        versionNo,
        source: {
          format: result.format,
          fileName: seed.file,
          bytes: Buffer.byteLength(text, 'utf8'),
          sha256: result.sha256,
        },
        fullAsset: { publicId: uploaded.publicId, bytes: uploaded.bytes },
        stats: result.stats,
        checks: result.checks,
        diff: result.diff,
        uploadedBy: 'import-map-layers',
        now: new Date().toISOString(),
        note: `นำเข้าครั้งแรกจาก ${url}`,
      })
    );

    process.stdout.write(
      `   ✓ ร่าง v${versionNo} — ${result.stats.featureCount.toLocaleString('th-TH')} รายการ, ` +
        `${result.stats.fields.length} ฟิลด์\n`
    );
    for (const c of result.checks) {
      process.stdout.write(`     [${c.level}] ${c.code} ×${c.count}\n`);
    }
  }

  process.stdout.write(
    '\nเสร็จแล้ว — ทุกเวอร์ชันอยู่ในสถานะ "ร่าง"\n' +
      'เปิด /admin/map เพื่อตรวจรายการฟิลด์ที่จะเปิดสาธารณะ แล้วกดเผยแพร่ทีละเลเยอร์\n'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
