// ต้องเป็น import แรกสุด — ดูเหตุผลใน scripts/load-env.ts
import './load-env';
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import shp from 'shpjs';
// path แบบ relative ไม่ใช่ alias @/ — tsx ไม่ resolve paths ใน tsconfig ให้
import {
  isCloudinaryConfigured,
  MAP_FOLDER_FULL,
  uploadRawText,
} from '../src/lib/cloudinary';
import { buildForestLayers, type NamedCollection } from '../src/lib/map-forest-prep';
import { ingestMapFile } from '../src/lib/map-ingest';
import {
  buildNewVersion,
  getLayer,
  insertVersion,
  listVersions,
  nextVersionNo,
  upsertLayer,
} from '../src/lib/map-store';
import type { FeatureCollection, MapLayer } from '../src/types/map';

// นำเข้าป่าชุมชนหมู่ 10 และ 11 จากซิป shapefile ครั้งแรก
//
//   npm run import:forest
//
// สามข้อที่ตั้งใจ เหมือน import-map-layers.ts:
//   1. ปล่อยทุกเวอร์ชันไว้เป็น "ร่าง" ไม่เผยแพร่ให้อัตโนมัติ — publicFields ที่
//      สคริปต์ตั้งให้เป็นแค่ข้อเสนอ การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียง
//      ของการรันสคริปต์
//   2. รันซ้ำได้ — sha256 ตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม
//   3. เดินผ่าน ingestMapFile ตัวเดียวกับ API route ไม่ให้สคริปต์กลายเป็นทางลัด
//      ที่ข้ามด่านตรวจไปโดยไม่มีใครรู้
//
// สคริปต์ไม่คำนวณพื้นที่เอง — ingestMapFile ทำให้ตาม flag computeArea ของเลเยอร์
// เพื่อให้ไฟล์ที่เจ้าหน้าที่ลากวางเองในอนาคตได้ผลเท่ากันเป๊ะ

const ZIP = path.join(process.cwd(), 'public', 'Shapefiles ป่าชุมชน.zip');
const ACTOR = 'import-community-forest';

type Seed = {
  key: 'boundary' | 'points';
  layer: Omit<MapLayer, 'updatedAt' | 'updatedBy' | 'currentVersionNo'>;
};

const SEEDS: Seed[] = [
  {
    key: 'boundary',
    layer: {
      id: 'community-forest',
      title: 'ป่าชุมชน',
      description: 'ขอบเขตป่าชุมชนหมู่ 10 และหมู่ 11',
      geometryType: 'Polygon',
      keyFields: ['moo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'area_rai', 'area_km2'],
      computeArea: true,
      order: 5,
    },
  },
  {
    key: 'points',
    layer: {
      id: 'community-forest-point',
      title: 'หมุดพิกัดป่าชุมชน',
      description: 'หมุดพิกัดที่รังวัดขอบเขตป่าชุมชน',
      geometryType: 'Point',
      // point_n เป็น 1–59 ในหมู่ 10 และ 1–117 ในหมู่ 11 → ซ้ำข้ามหมู่ 59 ค่า
      // ต้องคู่กับ moo ถึงจะเป็นตัวตนของแต่ละหมุดได้จริง
      keyFields: ['moo', 'point_n'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'point_n'],
      order: 6,
    },
  },
];

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์แผนที่ต้องมีที่เก็บไฟล์ กรอก CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ก่อน'
    );
  }

  process.stdout.write(`อ่าน ${ZIP}\n`);
  const buf = readFileSync(ZIP);
  const raw = await shp(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const parts = (Array.isArray(raw) ? raw : [raw]) as NamedCollection[];
  process.stdout.write(`   พบ ${parts.length} ชั้นข้อมูลในซิป\n`);

  const built = buildForestLayers(parts);

  for (const seed of SEEDS) {
    const fc: FeatureCollection = built[seed.key];
    process.stdout.write(`\n── ${seed.layer.title} (${seed.layer.id})\n`);

    const existing = await getLayer(seed.layer.id);
    const layer: MapLayer = existing ?? {
      ...seed.layer,
      currentVersionNo: null,
      updatedAt: new Date().toISOString(),
      updatedBy: ACTOR,
    };
    if (!existing) await upsertLayer(layer);

    // ส่งเป็นข้อความ GeoJSON เข้า ingestMapFile เหมือนทางที่ API route เดิน
    const text = JSON.stringify(fc);
    const fileName = `${seed.layer.id}.geojson`;
    const result = ingestMapFile({ text, fileName, layer, previous: null });
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
      for (const c of result.checks) {
        if (c.level === 'error') process.stdout.write(`   ✗ [error] ${c.message}\n`);
      }
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
          fileName,
          bytes: Buffer.byteLength(text, 'utf8'),
          sha256: result.sha256,
        },
        fullAsset: { publicId: uploaded.publicId, bytes: uploaded.bytes },
        stats: result.stats,
        checks: result.checks,
        diff: result.diff,
        uploadedBy: ACTOR,
        now: new Date().toISOString(),
        note: 'นำเข้าครั้งแรกจาก public/Shapefiles ป่าชุมชน.zip',
      })
    );

    process.stdout.write(
      `   ✓ ร่าง v${versionNo} — ${result.stats.featureCount.toLocaleString('th-TH')} รายการ, ` +
        `${result.stats.fields.length} ฟิลด์\n`
    );
    for (const f of result.stats.fields) {
      if (f.name.startsWith('area_')) {
        process.stdout.write(`     ${f.name}: ${(f.values ?? []).join(', ')}\n`);
      }
    }
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
