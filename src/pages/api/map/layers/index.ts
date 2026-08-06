import type { NextApiRequest, NextApiResponse } from 'next';
import { listLayers, listVersions } from '@/lib/map-store';

export type PublicLayerSummary = {
  id: string;
  title: string;
  description?: string;
  geometryType: string;
  featureCount: number;
  fields: string[];
  bbox: [number, number, number, number];
  updatedAt: string;
  versionNo: number;
  geojsonUrl: string;
};

// รายชื่อเลเยอร์ที่เผยแพร่แล้ว — สาธารณะ ไม่ต้องล็อกอิน
//
// คืนเฉพาะ metadata ที่ปลอดภัยเสมอ: ไม่มี publicId ของ Cloudinary (ซึ่งบอกใบ้
// ที่อยู่ของไฟล์เต็ม) ไม่มีชื่อผู้อัป/ผู้เผยแพร่ (เป็นชื่อเจ้าหน้าที่) และไม่มีผล
// ด่านตรวจ (บอกจำนวนแถวที่ข้อมูลมีปัญหา ซึ่งเป็นเรื่องภายใน)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const base = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
  const layers = await listLayers();
  const out: PublicLayerSummary[] = [];

  for (const layer of layers) {
    if (layer.visibility !== 'public' || layer.currentVersionNo === null) continue;
    const published = (await listVersions(layer.id)).find(
      (v) => v.status === 'published'
    );
    if (!published?.publicAsset) continue;

    out.push({
      id: layer.id,
      title: layer.title,
      description: layer.description,
      geometryType: layer.geometryType,
      featureCount: published.stats.featureCount,
      // เฉพาะฟิลด์ที่เปิดเผยจริง ไม่ใช่ทุกฟิลด์ที่มีในไฟล์ — รายชื่อฟิลด์ที่ถูกปิด
      // ก็เป็นข้อมูลที่ไม่ควรบอก (own_Hse_no บอกใบ้ว่าไฟล์เต็มมีอะไร)
      fields: layer.publicFields,
      bbox: published.stats.bbox,
      updatedAt: published.publishedAt ?? published.uploadedAt,
      versionNo: published.versionNo,
      geojsonUrl: `${base}/api/map/layers/${layer.id}/geojson`,
    });
  }

  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.status(200).json({ layers: out });
}
