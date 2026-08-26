// src/lib/forest-store.ts
import path from 'path';
import { createLayerStore } from '@/lib/layer-store';
import type { ForestLayer } from '@/types/forest';

// ทะเบียนคลังไฟล์ป่าไม้ — collection แยกจากแผนที่ ตรรกะเดียวกันทั้งหมด
// (ดูเหตุผลของการแยกที่ docs/superpowers/specs/2026-08-26-forest-data-page-design.md ข้อ 4)

const DATA_DIR = path.join(process.cwd(), 'data');

const store = createLayerStore<ForestLayer>({
  label: 'ทะเบียนไฟล์ป่าไม้',
  layersCollection: 'forestLayers',
  versionsCollection: 'forestLayerVersions',
  layersFile: path.join(DATA_DIR, 'forest-layers.json'),
  versionsFile: path.join(DATA_DIR, 'forest-layer-versions.json'),
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
