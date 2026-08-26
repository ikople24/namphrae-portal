// src/lib/layer-store.ts
import { promises as fs } from 'fs';
import path from 'path';
import type { Filter } from 'mongodb';
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

// ทะเบียนคลังไฟล์ภูมิสารสนเทศ — geometry ไม่แตะที่นี่เลย ตัวไฟล์อยู่บน Cloudinary
// สองสำเนาต่อเวอร์ชัน (เต็มแบบ authenticated กับสาธารณะที่กรองฟิลด์แล้วบน CDN)
// ที่นี่เก็บแต่ metadata จึงไม่มีวันชนเพดาน 16MB ต่อ document
//
// ไฟล์นี้ไม่รู้จักคำว่า "แผนที่" หรือ "ป่าไม้" — ผู้เรียกส่งชื่อ collection เข้ามาเอง
// เพื่อให้สองโดเมนแยกที่เก็บกันได้โดยไม่ต้องคัดลอกตรรกะ ถ้าคัดลอก วันที่แก้บั๊กที่นี่
// อีกโดเมนจะไม่ได้รับการแก้นั้นและไม่มีใครรู้จนกว่าจะมีคนบ่น

// ── ฟังก์ชันบริสุทธิ์ ────────────────────────────────────────────────────────
// (ย้ายมาจาก map-store.ts ทั้งบล็อกโดยไม่แก้เนื้อ — map-store.ts re-export ต่อ
// เพื่อให้ผู้เรียกเดิมทั้งหมดและ map-store.test.ts ทำงานเหมือนเดิม)

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

// ── โรงงาน store ─────────────────────────────────────────────────────────────

export type LayerStoreConfig = {
  /** ใช้ในข้อความ error ตอนปฏิเสธแบ็กเอนด์ไฟล์บน production */
  label: string;
  layersCollection: string;
  versionsCollection: string;
  layersFile: string;
  versionsFile: string;
};

export type LayerStore<L extends MapLayer> = {
  listLayers: () => Promise<L[]>;
  getLayer: (id: string) => Promise<L | null>;
  upsertLayer: (layer: L) => Promise<L>;
  patchLayer: (id: string, patch: Partial<L>) => Promise<L | null>;
  deleteLayer: (id: string) => Promise<void>;
  listVersions: (layerId: string) => Promise<MapLayerVersion[]>;
  getVersion: (id: string) => Promise<MapLayerVersion | null>;
  getPublishedVersion: (layerId: string) => Promise<MapLayerVersion | null>;
  insertVersion: (version: MapLayerVersion) => Promise<MapLayerVersion>;
  patchVersion: (
    id: string,
    patch: Partial<MapLayerVersion>
  ) => Promise<MapLayerVersion | null>;
  deleteVersions: (layerId: string) => Promise<void>;
};

export function createLayerStore<L extends MapLayer>(
  cfg: LayerStoreConfig
): LayerStore<L> {
  const usingMongo = (): boolean => isMongoConfigured();

  // แบ็กเอนด์ไฟล์มีไว้ให้รันในเครื่องโดยไม่ต้องมี Mongo — แต่ปฏิเสธตอน production
  // เพราะ filesystem ของ hosting ส่วนใหญ่ (เช่น Railway) เขียนได้จริงแต่ไม่คงอยู่ข้าม
  // deploy ทะเบียนที่หายไปไม่ได้ทำให้แค่ข้อมูลหาย แต่ทำให้ไฟล์ทุกเวอร์ชันบน Cloudinary
  // กลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึงและไม่มีใครรู้ว่าอันไหนคือของจริง
  function assertFileBackendAllowed(): void {
    if (process.env.NODE_ENV === 'production' && !isMongoConfigured()) {
      throw new Error(
        `ไม่ได้ตั้งค่า MONGODB_URI — ปฏิเสธการบันทึก${cfg.label}ลงไฟล์ในเครื่องตอน ` +
          'production เพราะ filesystem ของ hosting ส่วนใหญ่ (เช่น Railway) เขียนได้จริง ' +
          'แต่ไม่คงอยู่ข้าม deploy ทะเบียนจะหายเงียบ ๆ แล้วไฟล์ทุกเวอร์ชันบน Cloudinary ' +
          'จะกลายเป็นขยะกำพร้าที่ไม่มีอะไรอ้างถึง ตั้ง MONGODB_URI ก่อนใช้งานจริง'
      );
    }
  }

  async function fileRead<T>(file: string): Promise<T[]> {
    assertFileBackendAllowed();
    try {
      return JSON.parse(await fs.readFile(file, 'utf8')) as T[];
    } catch (err) {
      // ENOENT คือยังไม่เคยมีข้อมูล ต้องแยกจาก error อื่นทุกแบบ เช่นไฟล์ถูกตัดกลางคัน
      // เพราะโปรเซสถูก kill ระหว่างเขียน — ถ้ากลืนเป็น [] เหมือนกัน การเขียนครั้งถัดไป
      // จะทับทะเบียนเดิมทั้งก้อนโดยไม่มีสัญญาณเตือน
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
  }

  async function fileWrite<T>(file: string, rows: T[]): Promise<void> {
    assertFileBackendAllowed();
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, JSON.stringify(rows, null, 2) + '\n', 'utf8');
  }

  // สถานะของ index อยู่ในคลอเชอร์ ไม่ใช่ระดับโมดูล — สอง store ต้องนับความพยายาม
  // ของตัวเองแยกกัน ไม่งั้นโดเมนที่สร้าง index สำเร็จจะทำให้อีกโดเมนไม่เคยลองเลย
  let indexesEnsured = false;
  let indexAttempts = 0;
  const MAX_INDEX_ATTEMPTS = 3;

  async function ensureIndexes(): Promise<void> {
    if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
    indexAttempts += 1;
    indexesEnsured = true;
    try {
      const db = await getDb();
      await db
        .collection(cfg.layersCollection)
        .createIndexes([{ key: { id: 1 }, unique: true }]);
      await db.collection(cfg.versionsCollection).createIndexes([
        { key: { id: 1 }, unique: true },
        { key: { layerId: 1, versionNo: -1 } },
        { key: { layerId: 1, status: 1 } },
      ]);
    } catch (err) {
      indexesEnsured = false; // ให้ลองใหม่ครั้งหน้า (จนกว่าจะครบเพดาน)
      console.warn(
        `${cfg.layersCollection}: createIndexes failed ` +
          `(attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
        err
      );
    }
  }

  return {
    async listLayers() {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<L>(cfg.layersCollection)
          .find({}, { projection: { _id: 0 } })
          .sort({ order: 1, id: 1 })
          .toArray() as Promise<L[]>;
      }
      return (await fileRead<L>(cfg.layersFile)).sort(
        (a, b) => a.order - b.order || a.id.localeCompare(b.id)
      );
    },

    async getLayer(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        // filter ที่มีแต่ id ใช้ได้กับทุก L เพราะ L extends MapLayer แต่ TS พิสูจน์ไม่ได้
        // ตอน L ยังเป็นตัวแปรชนิด (keyof WithId<L> ยังไม่คลี่) — cast เฉพาะตัว filter
        return db
          .collection<L>(cfg.layersCollection)
          .findOne({ id } as Filter<L>, { projection: { _id: 0 } }) as Promise<L | null>;
      }
      return (await fileRead<L>(cfg.layersFile)).find((l) => l.id === id) ?? null;
    },

    async upsertLayer(layer) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db
          .collection<L>(cfg.layersCollection)
          .updateOne({ id: layer.id } as Filter<L>, { $set: { ...layer } }, { upsert: true });
        return layer;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      const i = rows.findIndex((l) => l.id === layer.id);
      if (i === -1) rows.push(layer);
      else rows[i] = layer;
      await fileWrite(cfg.layersFile, rows);
      return layer;
    },

    async patchLayer(id, patch) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<L>(cfg.layersCollection)
          .findOneAndUpdate(
            { id } as Filter<L>,
            { $set: patch },
            { returnDocument: 'after', projection: { _id: 0 } }
          ) as Promise<L | null>;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      const i = rows.findIndex((l) => l.id === id);
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...patch };
      await fileWrite(cfg.layersFile, rows);
      return rows[i];
    },

    // ลบเฉพาะทะเบียน — ไฟล์บน Cloudinary เป็นหน้าที่ของผู้เรียก เพราะ store ไม่รู้จัก
    // Cloudinary และไม่ควรรู้ ผู้เรียกต้องอ่าน listVersions() เก็บ asset ไว้ก่อนลบ
    async deleteLayer(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db.collection(cfg.layersCollection).deleteOne({ id });
        return;
      }
      const rows = await fileRead<L>(cfg.layersFile);
      await fileWrite(cfg.layersFile, rows.filter((l) => l.id !== id));
    },

    async listVersions(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .find({ layerId }, { projection: { _id: 0 } })
          .sort({ versionNo: -1 })
          .toArray();
      }
      return (await fileRead<MapLayerVersion>(cfg.versionsFile))
        .filter((v) => v.layerId === layerId)
        .sort((a, b) => b.versionNo - a.versionNo);
    },

    async getVersion(id) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOne({ id }, { projection: { _id: 0 } });
      }
      return (
        (await fileRead<MapLayerVersion>(cfg.versionsFile)).find((v) => v.id === id) ?? null
      );
    },

    async getPublishedVersion(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOne({ layerId, status: 'published' }, { projection: { _id: 0 } });
      }
      return (
        (await fileRead<MapLayerVersion>(cfg.versionsFile)).find(
          (v) => v.layerId === layerId && v.status === 'published'
        ) ?? null
      );
    },

    async insertVersion(version) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        // spread เพื่อไม่ให้ driver แปะ _id ลงบน object ที่เรากำลังจะคืนกลับไป
        await db.collection<MapLayerVersion>(cfg.versionsCollection).insertOne({ ...version });
      } else {
        const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
        rows.push(version);
        await fileWrite(cfg.versionsFile, rows);
      }
      return version;
    },

    async patchVersion(id, patch) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        return db
          .collection<MapLayerVersion>(cfg.versionsCollection)
          .findOneAndUpdate(
            { id },
            { $set: patch },
            { returnDocument: 'after', projection: { _id: 0 } }
          );
      }
      const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
      const i = rows.findIndex((v) => v.id === id);
      if (i === -1) return null;
      rows[i] = { ...rows[i], ...patch };
      await fileWrite(cfg.versionsFile, rows);
      return rows[i];
    },

    async deleteVersions(layerId) {
      if (usingMongo()) {
        await ensureIndexes();
        const db = await getDb();
        await db.collection(cfg.versionsCollection).deleteMany({ layerId });
        return;
      }
      const rows = await fileRead<MapLayerVersion>(cfg.versionsFile);
      await fileWrite(cfg.versionsFile, rows.filter((v) => v.layerId !== layerId));
    },
  };
}
