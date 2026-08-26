// src/lib/map-store.ts
import path from 'path';
import { createLayerStore } from '@/lib/layer-store';
import type { MapLayer } from '@/types/map';

// ทะเบียนคลังไฟล์แผนที่ — ตรรกะทั้งหมดอยู่ใน layer-store.ts ซึ่งโดเมนป่าไม้ใช้ร่วม
// ไฟล์นี้เหลือแค่ผูกชื่อ collection กับที่เก็บไฟล์สำรอง แล้ว re-export ให้ผู้เรียกเดิม
// (route 10 ไฟล์ สคริปต์นำเข้า และ map-store.test.ts) ทำงานต่อได้โดยไม่ต้องแก้อะไร
//
// การ re-export ฟังก์ชันบริสุทธิ์ข้างล่างมีไว้รองรับผู้เรียกเดิมเท่านั้น ไม่ใช่แบบอย่าง
// ของ binding ตัวถัดไป — โค้ดใหม่ให้ import ฟังก์ชันพวกนั้นจาก @/lib/layer-store ตรง ๆ
// เพราะมันไม่ได้เป็นของโดเมนไหนเป็นพิเศษ

export {
  assetsToPrune,
  buildNewVersion,
  buildPublishPatch,
  nextVersionNo,
  VERSION_EDITABLE_BY_PUBLISH,
} from '@/lib/layer-store';

const DATA_DIR = path.join(process.cwd(), 'data');

const store = createLayerStore<MapLayer>({
  label: 'ทะเบียนไฟล์แผนที่',
  layersCollection: 'mapLayers',
  versionsCollection: 'mapLayerVersions',
  layersFile: path.join(DATA_DIR, 'map-layers.json'),
  versionsFile: path.join(DATA_DIR, 'map-layer-versions.json'),
});

export const {
  deleteLayer,
  deleteVersions,
  getLayer,
  getPublishedVersion,
  getVersion,
  insertVersion,
  listLayers,
  listVersions,
  patchLayer,
  patchVersion,
  upsertLayer,
} = store;
