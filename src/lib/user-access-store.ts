// SERVER ONLY — Mongo access ของชั้นสิทธิ์ Portal (namphrae_portal.userAccess)
// อยู่ใน db ของ Portal เอง ไม่แตะ db_namphrae.users ที่แชร์กับอีกสองแอป
import type { Collection } from 'mongodb';
import { getDb } from '@/lib/mongodb';
import { DEFAULT_FEATURES, type FeatureKey } from '@/lib/user-access';

export type UserAccessDoc = {
  clerkId: string;
  features: FeatureKey[];
  isManager: boolean;
  updatedAt: Date;
  updatedBy: string;
};

async function accessCollection(): Promise<Collection<UserAccessDoc>> {
  const db = await getDb();
  return db.collection<UserAccessDoc>('userAccess');
}

let indexesEnsured = false;
let indexAttempts = 0;
// เหตุผลเดียวกับ signups-store.ts: transient failure ควรได้ retry แต่พังถาวร
// (ไม่มีสิทธิ์ createIndex, ชื่อ index ชน) ไม่ควร retry ไม่จบ
const MAX_INDEX_ATTEMPTS = 3;

async function ensureIndexes(): Promise<void> {
  if (indexesEnsured || indexAttempts >= MAX_INDEX_ATTEMPTS) return;
  indexAttempts += 1;
  indexesEnsured = true;
  try {
    const col = await accessCollection();
    await col.createIndexes([{ key: { clerkId: 1 }, unique: true }]);
  } catch (err) {
    indexesEnsured = false;
    console.warn(
      `userAccess: createIndexes failed (attempt ${indexAttempts}/${MAX_INDEX_ATTEMPTS})`,
      err
    );
  }
}

export async function getAccessDoc(
  clerkId: string
): Promise<{ features?: unknown; isManager?: unknown } | null> {
  const col = await accessCollection();
  return col.findOne({ clerkId }, { projection: { features: 1, isManager: 1 } });
}

export async function getAccessMap(
  clerkIds: string[]
): Promise<Map<string, { features?: unknown; isManager?: unknown }>> {
  if (clerkIds.length === 0) return new Map();
  const col = await accessCollection();
  const docs = await col
    .find(
      { clerkId: { $in: clerkIds } },
      { projection: { clerkId: 1, features: 1, isManager: 1 } }
    )
    .toArray();
  return new Map(docs.map((d) => [d.clerkId, d]));
}

export async function upsertAccess(
  clerkId: string,
  patch: { features?: FeatureKey[]; isManager?: boolean },
  updatedBy: string
): Promise<void> {
  await ensureIndexes();
  const col = await accessCollection();
  const set: Record<string, unknown> = { updatedAt: new Date(), updatedBy };
  if (patch.features !== undefined) set.features = [...new Set(patch.features)];
  if (patch.isManager !== undefined) set.isManager = patch.isManager;
  // upsert ครั้งแรกที่ส่งมาแค่บาง field: field ที่เหลือต้องได้ค่า default
  // ไม่ใช่หายไปเฉย ๆ (doc ที่มี features แต่ไม่มี isManager อ่านแล้วกำกวม)
  const onInsert: Record<string, unknown> = {};
  if (patch.features === undefined) onInsert.features = [...DEFAULT_FEATURES];
  if (patch.isManager === undefined) onInsert.isManager = false;
  const update: Record<string, unknown> = { $set: set };
  if (Object.keys(onInsert).length > 0) update.$setOnInsert = onInsert;
  await col.updateOne({ clerkId }, update, { upsert: true });
}
