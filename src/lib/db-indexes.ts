import type { Db } from 'mongodb';
import { getDb } from '@/lib/mongodb';

// ดัชนีของ collection ที่ย้ายมาจาก namphrae-map — ต้นทางเป็น mongoose ซึ่งสร้างดัชนีให้เอง
// driver ดิบไม่สร้าง ถ้าลืมจะไม่มีอะไรพังทันที แต่ทะเบียนจะรับเคสเลขลำดับซ้ำได้เงียบ ๆ
// ค่าทั้งหมดอ่านมาจากดัชนีจริงบน db_namphrae ไม่ได้ออกแบบใหม่
export type IndexDef = { key: Record<string, 1 | -1 | '2dsphere'>; unique?: true };

export const MIGRATED_INDEXES: Record<string, IndexDef[]> = {
  incidents: [
    { key: { location: '2dsphere' } },
    { key: { disasterType: 1, year: 1 } },
  ],
  diseaseCases: [{ key: { disease: 1, yearBE: 1, seq: 1 }, unique: true }],
  diseaseYearStats: [{ key: { yearBE: 1 }, unique: true }],
  chikunMooYears: [{ key: { yearBE: 1, moo: 1 }, unique: true }],
};

/** สร้างดัชนีให้ครบ — createIndex ซ้ำได้ ไม่ทำอะไรถ้ามีอยู่แล้ว */
export async function ensureMigratedIndexes(db?: Db): Promise<void> {
  const target = db ?? (await getDb());
  for (const [name, defs] of Object.entries(MIGRATED_INDEXES)) {
    for (const def of defs) {
      await target.collection(name).createIndex(def.key, def.unique ? { unique: true } : {});
    }
  }
}
