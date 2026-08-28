// src/lib/forest-api.ts
import { createLayerApi } from '@/lib/layer-api';

// ตัวเรียก API ของคลังไฟล์ป่าไม้ — ตรรกะเดียวกับแผนที่ ต่างแค่ path ฐาน
export const FOREST_API = createLayerApi({
  apiBase: '/api/admin/forest',
  pageBase: '/admin/forest',
});
