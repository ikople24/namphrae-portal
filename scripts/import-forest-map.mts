// scripts/import-forest-map.mts

// นำเข้าชั้นข้อมูลป่าไม้ 7 ชั้นจากแผนที่ป่าไม้ครั้งแรก
//
//   npm run import:forest
//
// สี่ข้อที่ตั้งใจ (สามข้อแรกเหมือน import-map-layers.ts):
//   1. ปล่อยทุกเวอร์ชันไว้เป็น "ร่าง" ไม่เผยแพร่อัตโนมัติ — publicFields ที่ registry
//      ตั้งให้เป็นแค่ข้อเสนอ การเปิดข้อมูลสู่สาธารณะไม่ควรเป็นผลข้างเคียงของการรันสคริปต์
//   2. รันซ้ำได้ — sha256 ตรงกับเวอร์ชันที่มีอยู่แล้วก็ข้าม
//   3. เดินผ่าน ingestMapFile ตัวเดียวกับ API route ไม่ให้สคริปต์กลายเป็นทางลัดที่ข้าม
//      ด่านตรวจไปโดยไม่มีใครรู้
//   4. ตรวจยันสามด่านก่อนเขียนลงฐาน ไม่ผ่าน = หยุดทั้งงาน ไม่นำเข้าครึ่ง ๆ กลาง ๆ
//
// สคริปต์ไม่ปัดพิกัดเองและไม่คำนวณพื้นที่เอง — ingestMapFile ทำให้ตาม
// coordinatePrecision/computeArea ของเลเยอร์ เพื่อให้ไฟล์ที่เจ้าหน้าที่ลากวางเองใน
// อนาคตได้ผลเท่ากันเป๊ะ

// ต้องเป็น import แรกสุด — ดูเหตุผลใน scripts/load-env.ts
import './load-env';
import crypto from 'node:crypto';
// path แบบ relative ไม่ใช่ alias @/ — tsx ไม่ resolve paths ใน tsconfig ให้
import {
  FOREST_FOLDER_FULL,
  isCloudinaryConfigured,
  uploadRawText,
} from '../src/lib/cloudinary';
import {
  mooFromName,
  prepCommunityForest,
  prepKortorchor,
  prepPermanent,
  prepReserve,
  prepStream,
  registryRai,
  splitWeir,
} from '../src/lib/forest-prep';
import { FOREST_SEEDS } from '../src/lib/forest-registry';
// ฟังก์ชันบริสุทธิ์อยู่ที่ layer-store ไม่ใช่ที่ binding ของโดเมน — forest-store
// export เฉพาะสิบเอ็ดเมธอดที่คุยกับฐาน ส่วน map-store re-export ให้ด้วยเพราะรองรับ
// ผู้เรียกเดิม ซึ่งเป็นข้อยกเว้น ไม่ใช่แบบอย่าง
import { buildNewVersion, nextVersionNo } from '../src/lib/layer-store';
import {
  getLayer,
  insertVersion,
  listVersions,
  upsertLayer,
} from '../src/lib/forest-store';
import { ingestMapFile } from '../src/lib/map-ingest';
import { parseMapFile } from '../src/lib/map-parse';
import { closeDb } from '../src/lib/mongodb';
import type { ForestLayer } from '../src/types/forest';
import type { FeatureCollection } from '../src/types/map';

const BASE = process.env.FOREST_MAP_BASE ?? 'https://forest-map.namphraesmartcity.ai';
const ACTOR = 'import-forest-map';

/** คลาดเคลื่อนสูงสุดที่ยอมให้ระหว่างพื้นที่ที่คำนวณกับทะเบียนในไฟล์ */
const AREA_TOLERANCE = 0.001; // 0.1%

/** เวลาสูงสุดต่อไฟล์ — ไฟล์ใหญ่สุด (ป่าสงวน) หนักราว 6 MB บนเน็ตทั่วไปเสร็จในไม่กี่วินาที */
const FETCH_TIMEOUT_MS = 30_000;

async function fetchCollection(source: string): Promise<FeatureCollection> {
  const url = `${BASE}/data/${source}`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    // fetch ที่ถูก DNS/TLS/timeout ปฏิเสธจะได้ TypeError เปล่า ๆ ไม่มี URL ติดมาด้วย
    // แล้วเพราะทุกไฟล์ดึงพร้อมกันด้วย Promise.all คนอ่าน error จะไม่รู้เลยว่าไฟล์ไหนพัง
    throw new Error(`ดึง ${url} ไม่สำเร็จ: ${(err as Error).message}`, { cause: err });
  }
  if (!res.ok) throw new Error(`ดึง ${url} ไม่สำเร็จ: HTTP ${res.status}`);
  const text = await res.text();
  // ไฟล์เป็น qgis2web (var json_x = {...}) ซึ่ง parseMapFile รองรับอยู่แล้ว
  const parsed = parseMapFile(text, source);
  if (!parsed.ok) throw new Error(`แกะ ${source} ไม่ออก: ${parsed.message}`);
  return parsed.fc;
}

type Built = {
  /** ทุกชั้นที่ล้างฟิลด์แล้ว คีย์ด้วย layerId */
  collections: Record<string, FeatureCollection>;
  /** เนื้อที่ตามทะเบียนของป่าชุมชนแต่ละแปลง คีย์ด้วย moo ไม่ใช่ตำแหน่ง — กัน
   * ไม่ให้การเรียงลำดับของ prep function ในอนาคตทำให้เทียบผิดแถวแบบเงียบ ๆ */
  communityRegistry: Map<number, number | null>;
};

async function buildAll(): Promise<Built> {
  const [community, weirRaw, kortorchor, stream, reserve, permanent] = await Promise.all([
    fetchCollection('_7.js'),
    fetchCollection('_8.js'),
    fetchCollection('_4.js'),
    fetchCollection('_5.js'),
    fetchCollection('_2.js'),
    fetchCollection('_3.js'),
  ]);

  // splitWeir เองเป็นคนตรวจ fid ทุกแถว (โยน error ถ้า fid ไม่ใช่จำนวนเต็มบวก หรือ
  // แถวทะเบียนฝายไม่มีชื่อ) จึงไม่ต้องนับ fid ซ้ำเองที่นี่อีกชั้น — การนับซ้ำแบบเดิม
  // ใช้ Number(fid) ตรง ๆ ซึ่ง Number(null) เป็น 0 แล้วผ่านเงื่อนไข <= 41 ได้ เป็น
  // บั๊กตระกูลเดียวกับที่เจอใน registryRai และแก้ไปแล้วที่นั่น splitWeir เข้มงวดกว่า
  const { weir, survey: surveyFc } = splitWeir(weirRaw);

  const collections: Record<string, FeatureCollection> = {
    'community-forest': prepCommunityForest(community),
    'forest-weir': weir,
    'forest-weir-survey': surveyFc,
    'forest-kortorchor': prepKortorchor(kortorchor),
    'forest-stream': prepStream(stream),
    'forest-reserve': prepReserve(reserve),
    'forest-permanent': prepPermanent(permanent),
  };

  // ด่านที่ 1 ต้องอยู่ก่อนเขียนอะไรลงฐานทั้งหมด ไม่ใช่ทีละชั้นในลูปเขียน — ไม่งั้น
  // ชั้นแรก ๆ เขียนสำเร็จไปแล้วก่อนชั้นหลังจะพัง กลายเป็นนำเข้าครึ่ง ๆ กลาง ๆ ซึ่งขัดกับ
  // ข้อ 4 ที่ไฟล์นี้ประกาศไว้เองตอนต้นไฟล์
  const mismatches = FOREST_SEEDS.filter(
    (seed) => collections[seed.layer.id].features.length !== seed.expect
  ).map(
    (seed) =>
      `${seed.layer.id}: ได้ ${collections[seed.layer.id].features.length} รายการ แต่คาด ${seed.expect}`
  );
  if (mismatches.length > 0) {
    throw new Error(
      `ไฟล์ต้นทางเปลี่ยนไปแล้ว ต้องมีคนดูด้วยตาก่อนนำเข้าต่อ:\n  ${mismatches.join('\n  ')}`
    );
  }

  // ด่านที่ 3 เก็บค่าไว้ตรงนี้เพราะ prepCommunityForest ตัดฟิลด์ทะเบียนทิ้งไปแล้ว
  // แล้วค่อยเทียบหลัง ingest ใน importSeed() — mooFromName โยน error เองถ้าอ่านชื่อ
  // แปลงไม่ออก จึงมั่นใจได้ว่าทุกคีย์ที่ใส่ใน Map นี้ไม่ซ้ำกัน (4 แปลง = 4 หมู่ต่างกัน)
  const communityRegistry = new Map<number, number | null>(
    community.features.map((f) => [mooFromName(f.properties?.name), registryRai(f)])
  );

  return { collections, communityRegistry };
}

/** เทียบพื้นที่ที่ computeArea คำนวณกับทะเบียนในไฟล์ — คลาดเกิน 0.1% = หยุด */
function assertCommunityArea(fc: FeatureCollection, registry: Map<number, number | null>): void {
  fc.features.forEach((f) => {
    const moo = Number(f.properties?.moo);
    const expected = registry.get(moo);
    const got = Number(f.properties?.area_rai);
    // expected === 0 ต้องกันเหมือน null — ถ้าปล่อยผ่านไปหาร off = |got-0|/0 = Infinity
    // เสมอ (หรือ NaN ถ้า got เป็น 0 ด้วย ซึ่ง NaN > 0.001 เป็น false แล้วผ่านไปเงียบ ๆ)
    // ทั้งสองทางให้ข้อความที่ชี้ผิดสาเหตุ — ป่าไม้ไม่มีแปลงไหนพื้นที่ 0 ไร่จริง ๆ
    if (expected === undefined || expected === null || expected === 0 || !Number.isFinite(got)) {
      throw new Error(`ป่าชุมชนหมู่ ${moo}: เทียบพื้นที่ไม่ได้ (ทะเบียน=${expected})`);
    }
    const off = Math.abs(got - expected) / expected;
    if (off > AREA_TOLERANCE) {
      throw new Error(
        `ป่าชุมชนหมู่ ${moo}: คำนวณได้ ${got} ไร่ แต่ทะเบียนเขียน ` +
          `${expected.toFixed(2)} ไร่ (ต่างกัน ${(off * 100).toFixed(3)}%) — ` +
          'เกินเกณฑ์ 0.1% แปลว่าการแปลงพิกัดเพี้ยน ไม่ใช่ขอบเขตเปลี่ยน'
      );
    }
    process.stdout.write(
      `     หมู่ ${moo}: คำนวณ ${got} ไร่ · ทะเบียน ${expected.toFixed(2)} ไร่ ` +
        `(ต่าง ${(off * 100).toFixed(3)}%)\n`
    );
  });
}

async function importSeed(
  seed: (typeof FOREST_SEEDS)[number],
  fc: FeatureCollection,
  communityRegistry: Map<number, number | null>
): Promise<void> {
  process.stdout.write(`\n── ${seed.layer.title} (${seed.layer.id})\n`);

  const existing = await getLayer(seed.layer.id);
  const layer: ForestLayer = existing ?? {
    ...seed.layer,
    currentVersionNo: null,
    updatedAt: new Date().toISOString(),
    updatedBy: ACTOR,
  };
  if (!existing) await upsertLayer(layer);

  const text = JSON.stringify(fc);
  const fileName = `${seed.layer.id}.geojson`;
  const result = ingestMapFile({ text, fileName, layer, previous: null });
  if (!result.ok) throw new Error(`${seed.layer.id}: ${result.message}`);

  if (seed.layer.id === 'community-forest') assertCommunityArea(result.fc, communityRegistry);

  const versions = await listVersions(layer.id);
  if (versions.some((v) => v.source.sha256 === result.sha256)) {
    process.stdout.write('   – เนื้อข้อมูลตรงกับเวอร์ชันที่มีอยู่แล้ว ข้าม\n');
    return;
  }
  if (result.blocked) {
    for (const c of result.checks) {
      if (c.level === 'error') process.stdout.write(`   ✗ [error] ${c.message}\n`);
    }
    throw new Error(`${seed.layer.id}: ไม่ผ่านด่านตรวจ`);
  }

  const versionNo = nextVersionNo(versions);
  const uploaded = await uploadRawText(JSON.stringify(result.fc), {
    folder: FOREST_FOLDER_FULL,
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
      note: `นำเข้าครั้งแรกจาก ${BASE}/data/${seed.source}`,
    })
  );

  process.stdout.write(
    `   ✓ ร่าง v${versionNo} — ${result.stats.featureCount.toLocaleString('th-TH')} รายการ, ` +
      `${result.stats.fields.length} ฟิลด์, ${(uploaded.bytes / 1048576).toFixed(2)} MB\n`
  );
  for (const c of result.checks) {
    process.stdout.write(`     [${c.level}] ${c.code} ×${c.count}\n`);
  }
}

async function main(): Promise<void> {
  if (!isCloudinaryConfigured()) {
    throw new Error(
      'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์ป่าไม้ต้องมีที่เก็บไฟล์ กรอก ' +
        'CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET ก่อน'
    );
  }

  process.stdout.write(`ดึงข้อมูลจาก ${BASE}\n`);
  const built = await buildAll();

  for (const seed of FOREST_SEEDS) {
    await importSeed(seed, built.collections[seed.layer.id], built.communityRegistry);
  }

  process.stdout.write(
    '\nเสร็จแล้ว — ทุกเวอร์ชันอยู่ในสถานะ "ร่าง"\n' +
      'เปิด /admin/forest เพื่อตรวจรายการฟิลด์ที่จะเปิดสาธารณะ แล้วกดเผยแพร่ทีละชั้น\n' +
      'อย่าเพิ่งเปิดเนื้อที่ของชั้น คทช. จนกว่าจะถามเจ้าของข้อมูลได้ว่าเนื้อที่สองชุด' +
      'ในไฟล์ต่างกันตรงไหน\n'
  );

  // ไม่ปิดด้วย process.exit() เฉย ๆ — MongoDB driver เปิด socket ค้างไว้ในพูลการ
  // เชื่อมต่อ ซึ่งกัน event loop ไม่ให้ออกเอง (ไม่ใช่แค่ตอนสำเร็จ — ดู catch ด้านล่าง)
  await closeDb();
}

main().catch(async (err) => {
  console.error(err);
  await closeDb();
  process.exit(1);
});
