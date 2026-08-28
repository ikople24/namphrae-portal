// src/lib/layer-domains.ts
import {
  FOREST_FOLDER_FULL,
  FOREST_FOLDER_PUBLIC,
  MAP_FOLDER_FULL,
  MAP_FOLDER_PUBLIC,
} from '@/lib/cloudinary';
import * as forestStore from '@/lib/forest-store';
import type { LayerStore } from '@/lib/layer-store';
import * as mapStore from '@/lib/map-store';
import type { FeatureKey } from '@/lib/user-access';
import type { MapLayer } from '@/types/map';

// ของสี่อย่างที่ต่างกันระหว่างโดเมนแผนที่กับโดเมนป่าไม้ — ทุกอย่างที่เหลือใน
// เส้นทางของ API ใช้ร่วมกันได้หมด ตั้งแต่ด่านตรวจไปจนถึงการกรองฟิลด์ตอนเผยแพร่
//
// ตัว store ประกาศเป็น LayerStore<MapLayer> ไม่ใช่ LayerStore<ForestLayer> เพราะ
// ตัวจัดการคำขออ่านเฉพาะฟิลด์ที่ MapLayer มี ส่วน defaultOn/publishPhotos ของ
// ForestLayer เดินทางผ่านไปกับเอกสารโดยไม่มีใครในชั้นนี้ต้องรู้จักมัน
export type LayerDomain = {
  /** สิทธิ์ที่ต้องมีถึงจะเรียก route ฝั่งหลังบ้านของโดเมนนี้ได้ */
  feature: FeatureKey;
  store: LayerStore<MapLayer>;
  /** โฟลเดอร์ไฟล์เต็ม (authenticated) — ต้องไม่ซ้ำกับโดเมนอื่น */
  folderFull: string;
  /** โฟลเดอร์ไฟล์สาธารณะที่กรองฟิลด์แล้ว (upload) */
  folderPublic: string;
  /**
   * path ฐานของ API สาธารณะ — ใช้ประกอบ geojsonUrl ที่ส่งออกไปให้ระบบอื่น
   *
   * ต้องเป็นค่าคงที่ ไม่ใช่คำนวณจาก feature เพราะสองอย่างนี้ไม่ได้ผูกกันเสมอไป
   * และ URL ที่ส่งออกไปแล้วมีคนเอาไปฝังต่อ เปลี่ยนทีหลังไม่ได้
   */
  publicApiBase: string;
};

export const MAP_DOMAIN: LayerDomain = {
  feature: 'map',
  store: mapStore,
  folderFull: MAP_FOLDER_FULL,
  folderPublic: MAP_FOLDER_PUBLIC,
  publicApiBase: '/api/map',
};

export const FOREST_DOMAIN: LayerDomain = {
  feature: 'forest',
  store: forestStore,
  folderFull: FOREST_FOLDER_FULL,
  folderPublic: FOREST_FOLDER_PUBLIC,
  publicApiBase: '/api/forest',
};
