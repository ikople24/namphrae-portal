import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { isCloudinaryConfigured, signedRawUrl } from '@/lib/cloudinary';
import { getLayer, getPublishedVersion } from '@/lib/map-store';

const TTL_SECONDS = 600;

// GeoJSON **ฉบับเต็ม** ของเลเยอร์ที่เผยแพร่อยู่ — สำหรับหน้าแผนที่ฝั่งเจ้าหน้าที่
//
// ต่างจาก /api/map/layers/[id]/geojson (สาธารณะ) ตรงที่คืนทุกฟิลด์รวมข้อมูลส่วน
// บุคคล จึงต้องผ่าน requireAdmin เสมอ
//
// เป็น 302 ไป signed URL ด้วยเหตุผลเดียวกับฝั่งสาธารณะ (เพดาน response 4MB ของ
// Pages Router) แต่ URL มีอายุ 10 นาทีแทน 5 เพราะหน้าแผนที่อาจเปิดค้างไว้แล้วเพิ่ง
// กดเปิดเลเยอร์ทีหลัง — สั้นกว่านี้จะเจอ 403 กลางคันโดยไม่มีอะไรอธิบาย
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'map');
  if (!admin) return;

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(501).json({ error: 'cloudinary_not_configured' });
  }

  const layer = await getLayer(String(req.query.id));
  if (!layer) return res.status(404).json({ error: 'layer_not_found' });

  const published = await getPublishedVersion(layer.id);
  if (!published) {
    return res.status(404).json({
      error: 'not_published',
      message: 'เลเยอร์นี้ยังไม่มีเวอร์ชันที่เผยแพร่',
    });
  }
  if (!published.fullAsset) {
    return res.status(410).json({
      error: 'full_asset_gone',
      message: 'ไฟล์เต็มของเวอร์ชันที่เผยแพร่อยู่ถูกลบตามนโยบายเก็บย้อนหลังแล้ว',
    });
  }

  // ห้าม cache — URL ที่เซ็นแล้วหมดอายุ ถ้าถูกเก็บไว้ครั้งถัดไปจะได้ URL ที่ตายแล้ว
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, signedRawUrl(published.fullAsset.publicId, TTL_SECONDS));
}
