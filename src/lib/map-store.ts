import { promises as fs } from 'fs';
import path from 'path';
import { getDb, isMongoConfigured } from '@/lib/mongodb';
import type {
  MapAsset,
  MapCheck,
  MapDiff,
  MapLayer,
  MapLayerVersion,
  MapPublicAsset,
  MapStats,
  SourceFormat,
} from '@/types/map';

// ทะเบียนคลังไฟล์แผนที่ — geometry ไม่แตะที่นี่เลย ตัวไฟล์อยู่บน Cloudinary
// สองสำเนาต่อเวอร์ชัน (เต็มแบบ authenticated กับสาธารณะที่กรองฟิลด์แล้วบน CDN)
// ที่นี่เก็บแต่ metadata จึงไม่มีวันชนเพดาน 16MB ต่อ document
//
// แบ็กเอนด์เหมือน jobs-store: Mongo เมื่อมี MONGODB_URI ไม่งั้นใช้ไฟล์ในเครื่อง
// และปฏิเสธแบ็กเอนด์ไฟล์เองตอน production ด้วยเหตุผลเดียวกัน แต่ที่นี่ร้ายแรงกว่า
// งานปฏิทินหนึ่งขั้น: ทะเบียนที่หายไปตอน deploy ไม่ได้ทำให้แค่ข้อมูลหาย แต่ทำให้
// ไฟล์ทุกเวอร์ชันบน Cloudinary กลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึงและไม่มีใคร
// รู้ว่าอันไหนคือของจริง — เก็บเงียบ ๆ ไม่ได้ ต้องไล่เดาจากชื่อ public id เอง

const LAYERS = 'mapLayers';
const VERSIONS = 'mapLayerVersions';
const DATA_DIR = path.join(process.cwd(), 'data');
const LAYERS_FILE = path.join(DATA_DIR, 'map-layers.json');
const VERSIONS_FILE = path.join(DATA_DIR, 'map-layer-versions.json');

function usingMongo(): boolean {
  return isMongoConfigured();
}

// ── ฟังก์ชันบริสุทธิ์ ────────────────────────────────────────────────────────
// แยกออกมาให้เทสต์เรียกตรง ๆ ได้โดยไม่ต้องแตะ Mongo หรือไฟล์ ด้วยเหตุผลเดียว
// กับ buildNewJob/buildStatusPatch ใน jobs-store.ts — และรับ `now`/`id` เป็น
// พารามิเตอร์แทนที่จะเรียก Date.now()/randomUUID เองข้างใน เพื่อให้เทสต์ตรึงค่า
// ที่เขียนลงเอกสารได้จริง ไม่ใช่ได้แค่ตรวจว่า "มีฟิลด์นั้นอยู่"

/**
 * นับต่อจากเลขสูงสุดที่เคยมี ไม่ใช่จากจำนวนเอกสาร — เวอร์ชันที่ถูกทิ้ง
 * (discarded) ยังอยู่ในประวัติ ถ้านับจาก length เลขจะย้อนกลับไปชนของเดิม
 */
export function nextVersionNo(versions: MapLayerVersion[]): number {
  return versions.reduce((max, v) => Math.max(max, v.versionNo), 0) + 1;
}

export function buildNewVersion(args: {
  id: string;
  layerId: string;
  versionNo: number;
  source: { format: SourceFormat; fileName: string; bytes: number; sha256: string };
  fullAsset: MapAsset;
  stats: MapStats;
  checks: MapCheck[];
  diff: MapDiff | null;
  uploadedBy: string;
  now: string;
  note?: string;
}): MapLayerVersion {
  return {
    id: args.id,
    layerId: args.layerId,
    versionNo: args.versionNo,
    status: 'draft', // เวอร์ชันใหม่เป็นร่างเสมอ ไม่ว่าใครอัป
    source: args.source,
    fullAsset: args.fullAsset,
    publicAsset: null, // เกิดตอนกดเผยแพร่เท่านั้น
    stats: args.stats,
    checks: args.checks,
    diff: args.diff,
    uploadedAt: args.now,
    uploadedBy: args.uploadedBy,
    note: args.note ?? '',
  };
}

/**
 * ฟิลด์ที่การเผยแพร่เขียนทับ — ประกาศไว้เป็นรายการเดียวเพื่อให้เทสต์ตรึงได้ว่า
 * การเผยแพร่ "ไม่แตะอย่างอื่น" โดยเฉพาะ stats/checks/diff ซึ่งเป็นบันทึกของ
 * ตอนอัปโหลด ไม่ใช่ของตอนเผยแพร่ ถ้าเผลอเขียนทับ ประวัติจะโกหกว่าไฟล์ผ่าน
 * ด่านตรวจด้วยผลชุดอื่น
 */
export const VERSION_EDITABLE_BY_PUBLISH = [
  'status',
  'publicAsset',
  'publishedAt',
  'publishedBy',
] as const satisfies readonly (keyof MapLayerVersion)[];

export function buildPublishPatch(args: {
  version: MapLayerVersion;
  currentPublished: MapLayerVersion | null;
  publicAsset: MapPublicAsset;
  actor: string;
  now: string;
}): {
  publish: { id: string; set: Partial<MapLayerVersion> };
  supersede: { id: string; set: Partial<MapLayerVersion> } | null;
  layer: { currentVersionNo: number; updatedAt: string; updatedBy: string };
} {
  const { version, currentPublished, publicAsset, actor, now } = args;
  return {
    publish: {
      id: version.id,
      set: {
        status: 'published',
        publicAsset,
        // ย้อนเวอร์ชันก็ถือเป็นการเผยแพร่ครั้งใหม่ ประทับผู้กดทับของเดิมเสมอ —
        // คำถามที่คนอ่านประวัติถามคือ "ใครทำให้ไฟล์นี้เป็นตัวจริงตอนนี้"
        publishedAt: now,
        publishedBy: actor,
      },
    },
    // เผยแพร่ทับตัวเองต้องไม่สร้าง supersede ที่ชี้กลับมาที่ตัวเอง ไม่งั้นลำดับการ
    // เขียนสองครั้งจะทำให้เวอร์ชันที่เพิ่งเผยแพร่กลายเป็น superseded ทันที
    supersede:
      currentPublished && currentPublished.id !== version.id
        ? { id: currentPublished.id, set: { status: 'superseded' } }
        : null,
    layer: { currentVersionNo: version.versionNo, updatedAt: now, updatedBy: actor },
  };
}

/**
 * ไฟล์เต็มที่ควรถูกลบออกจาก Cloudinary หลังเผยแพร่สำเร็จ
 *
 * เก็บ `kept` เวอร์ชันล่าสุด **บวกเวอร์ชันที่เผยแพร่อยู่เสมอไม่ว่ามันจะเก่าแค่ไหน**
 * — กรณีหลังเกิดได้จริงเมื่อย้อนกลับไปใช้เวอร์ชันเก่ามากแล้วอัปเวอร์ชันใหม่ต่ออีก
 * หลายรอบ ถ้าลบไฟล์เต็มของเวอร์ชันที่ใช้งานอยู่ เจ้าหน้าที่จะดาวน์โหลดไฟล์ที่ระบบ
 * กำลังเสิร์ฟอยู่ไม่ได้
 *
 * ไม่แตะ publicAsset เลย — มันคือสิ่งเดียวที่ทำให้ย้อนเวอร์ชันได้ทันทีโดยไม่ต้อง
 * ประมวลผลไฟล์ใหม่ และมันเล็กกว่าเพราะฟิลด์ PII ถูกตัดออกไปแล้ว
 */
export function assetsToPrune(
  versions: MapLayerVersion[],
  kept: number
): MapAsset[] {
  const keep = new Set(
    [...versions]
      .sort((a, b) => b.versionNo - a.versionNo)
      .slice(0, kept)
      .map((v) => v.id)
  );
  for (const v of versions) if (v.status === 'published') keep.add(v.id);

  return versions
    .filter((v) => !keep.has(v.id) && v.fullAsset !== null)
    .map((v) => v.fullAsset!);
}

// ── แบ็กเอนด์ไฟล์ ────────────────────────────────────────────────────────────

function assertFileBackendAllowed(): void {
  if (process.env.NODE_ENV === 'production' && !isMongoConfigured()) {
    throw new Error(
      'ไม่ได้ตั้งค่า MONGODB_URI — ปฏิเสธการบันทึกทะเบียนไฟล์แผนที่ลงไฟล์ในเครื่อง ' +
        'ตอน production เพราะ filesystem ของ hosting ส่วนใหญ่ (เช่น Railway) เขียนได้ ' +
        'จริงแต่ไม่คงอยู่ข้าม deploy ทะเบียนจะหายเงียบ ๆ แล้วไฟล์ทุกเวอร์ชันบน ' +
        'Cloudinary จะกลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึง ตั้ง MONGODB_URI ก่อนใช้งานจริง'
    );
  }
}

async function fileRead<T>(file: string): Promise<T[]> {
  assertFileBackendAllowed();
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as T[];
  } catch (err) {
    // ENOENT คือยังไม่เคยมีข้อมูล ต้องแยกจาก error อื่นทุกแบบ เช่นไฟล์ถูกตัด
    // กลางคันเพราะโปรเซสถูก kill ระหว่างเขียน — ถ้ากลืนเป็น [] เหมือนกัน การเขียน
    // ครั้งถัดไปจะทับทะเบียนเดิมทั้งก้อนโดยไม่มีสัญญาณเตือน
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw err;
  }
}

async function fileWrite<T>(file: string, rows: T[]): Promise<void> {
  assertFileBackendAllowed();
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
}

// ── แบ็กเอนด์ Mongo ──────────────────────────────────────────────────────────

let indexesEnsured = false;
let indexAttempts = 0;
const MAX_INDEX_ATTEMPTS = 3;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
  indexAttempts += 1;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await db.collection(LAYERS).createIndexes([{ key: { id: 1 }, unique: true }]);
    await db.collection(VERSIONS).createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { layerId: 1, versionNo: -1 } },
      { key: { layerId: 1, status: 1 } },
    ]);
  } catch (err) {
    indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า (จนกว่าจะครบเพดาน)
    console.warn(
      `mapLayers: createIndexes failed (attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
      err
    );
  }
}

// ── API ของ store ────────────────────────────────────────────────────────────

export async function listLayers(): Promise<MapLayer[]> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayer>(LAYERS)
      .find({}, { projection: { _id: 0 } })
      .sort({ order: 1, id: 1 })
      .toArray();
  }
  return (await fileRead<MapLayer>(LAYERS_FILE)).sort(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id)
  );
}

export async function getLayer(id: string): Promise<MapLayer | null> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db.collection<MapLayer>(LAYERS).findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead<MapLayer>(LAYERS_FILE)).find((l) => l.id === id) ?? null;
}

export async function upsertLayer(layer: MapLayer): Promise<MapLayer> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    await db
      .collection<MapLayer>(LAYERS)
      .updateOne({ id: layer.id }, { $set: { ...layer } }, { upsert: true });
    return layer;
  }
  const rows = await fileRead<MapLayer>(LAYERS_FILE);
  const i = rows.findIndex((l) => l.id === layer.id);
  if (i === -1) rows.push(layer);
  else rows[i] = layer;
  await fileWrite(LAYERS_FILE, rows);
  return layer;
}

export async function patchLayer(
  id: string,
  patch: Partial<MapLayer>
): Promise<MapLayer | null> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayer>(LAYERS)
      .findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
  }
  const rows = await fileRead<MapLayer>(LAYERS_FILE);
  const i = rows.findIndex((l) => l.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch };
  await fileWrite(LAYERS_FILE, rows);
  return rows[i];
}

/** ประวัติของเลเยอร์ เรียงใหม่สุดขึ้นก่อน */
export async function listVersions(layerId: string): Promise<MapLayerVersion[]> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayerVersion>(VERSIONS)
      .find({ layerId }, { projection: { _id: 0 } })
      .sort({ versionNo: -1 })
      .toArray();
  }
  return (await fileRead<MapLayerVersion>(VERSIONS_FILE))
    .filter((v) => v.layerId === layerId)
    .sort((a, b) => b.versionNo - a.versionNo);
}

export async function getVersion(id: string): Promise<MapLayerVersion | null> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayerVersion>(VERSIONS)
      .findOne({ id }, { projection: { _id: 0 } });
  }
  return (await fileRead<MapLayerVersion>(VERSIONS_FILE)).find((v) => v.id === id) ?? null;
}

export async function getPublishedVersion(
  layerId: string
): Promise<MapLayerVersion | null> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayerVersion>(VERSIONS)
      .findOne({ layerId, status: 'published' }, { projection: { _id: 0 } });
  }
  return (
    (await fileRead<MapLayerVersion>(VERSIONS_FILE)).find(
      (v) => v.layerId === layerId && v.status === 'published'
    ) ?? null
  );
}

export async function insertVersion(
  version: MapLayerVersion
): Promise<MapLayerVersion> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่เรากำลังจะคืนกลับไป
    await db.collection<MapLayerVersion>(VERSIONS).insertOne({ ...version });
  } else {
    const rows = await fileRead<MapLayerVersion>(VERSIONS_FILE);
    rows.push(version);
    await fileWrite(VERSIONS_FILE, rows);
  }
  return version;
}

export async function patchVersion(
  id: string,
  patch: Partial<MapLayerVersion>
): Promise<MapLayerVersion | null> {
  if (usingMongo()) {
    await ensureIndexes();
    const db = await getDb();
    return db
      .collection<MapLayerVersion>(VERSIONS)
      .findOneAndUpdate(
        { id },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } }
      );
  }
  const rows = await fileRead<MapLayerVersion>(VERSIONS_FILE);
  const i = rows.findIndex((v) => v.id === id);
  if (i === -1) return null;
  rows[i] = { ...rows[i], ...patch };
  await fileWrite(VERSIONS_FILE, rows);
  return rows[i];
}
