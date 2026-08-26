// src/lib/map-store.ts
import path from 'path';
import { createLayerStore } from '@/lib/layer-store';
import type { MapLayer } from '@/types/map';

// ทะเบียนคลังไฟล์แผนที่ — ตรรกะทั้งหมดอยู่ใน layer-store.ts ซึ่งโดเมนป่าไม้ใช้ร่วม
// ไฟล์นี้เหลือแค่ผูกชื่อ collection กับที่เก็บไฟล์สำรอง แล้ว re-export ให้ผู้เรียกเดิม
// (route 11 ไฟล์ สคริปต์นำเข้า และ map-store.test.ts) ทำงานต่อได้โดยไม่ต้องแก้อะไร

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
