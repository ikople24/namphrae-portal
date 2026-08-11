import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { listLayers, listVersions } from '@/lib/map-store';
import type { MapLayer, MapLayerVersion } from '@/types/map';

export type AdminLayerRow = {
  layer: MapLayer;
  published: MapLayerVersion | null;
  draft: MapLayerVersion | null;
  versionCount: number;
};

// ทุกเลเยอร์พร้อมเวอร์ชันที่เผยแพร่อยู่และร่างที่ค้าง — หน้า /admin/map ใช้ก้อนนี้
// ก้อนเดียววาดการ์ดได้ครบ ไม่ต้องยิงต่อเลเยอร์
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'map');
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const layers = await listLayers();
  const rows: AdminLayerRow[] = await Promise.all(
    layers.map(async (layer) => {
      const versions = await listVersions(layer.id);
      return {
        layer,
        published: versions.find((v) => v.status === 'published') ?? null,
        // ร่างล่าสุดเท่านั้น — listVersions เรียงใหม่สุดขึ้นก่อนอยู่แล้ว
        draft: versions.find((v) => v.status === 'draft') ?? null,
        versionCount: versions.filter((v) => v.status !== 'discarded').length,
      };
    })
  );

  return res.status(200).json({ layers: rows });
}
