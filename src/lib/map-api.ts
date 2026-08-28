// src/lib/map-api.ts
import { createLayerApi } from '@/lib/layer-api';

// ตัวเรียก API ของคลังไฟล์แผนที่ — ตรรกะทั้งหมดอยู่ใน layer-api.ts ซึ่งโดเมนป่าไม้ใช้ร่วม
export { UploadRejectedError } from '@/lib/layer-api';
export type { AdminLayerRow, LayerApi, UploadStage } from '@/lib/layer-api';

export const MAP_API = createLayerApi({
  apiBase: '/api/admin/map',
  pageBase: '/admin/map',
});
