import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { isCloudinaryConfigured, signedRawUrl } from '@/lib/cloudinary';
import { getVersion } from '@/lib/map-store';

const TTL_SECONDS = 300;

// ไฟล์เต็ม (มีข้อมูลส่วนบุคคล) — 302 ไป signed URL อายุ 5 นาที
//
// ไม่ proxy เนื้อไฟล์ผ่านที่นี่เพราะ Pages Router เตือนเมื่อ response เกิน 4MB
// และไฟล์แปลงที่ดินหนัก ~7 MB การตัดสินใจเรื่องสิทธิ์เกิดที่นี่ ส่วนการส่งไบต์
// เป็นงานของ Cloudinary
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

  const version = await getVersion(String(req.query.vid));
  if (!version) return res.status(404).json({ error: 'version_not_found' });

  if (!version.fullAsset) {
    return res.status(410).json({
      error: 'full_asset_gone',
      message:
        'ไฟล์เต็มของเวอร์ชันนี้ถูกลบตามนโยบายเก็บย้อนหลังแล้ว (ประวัติยังอยู่ครบ)',
    });
  }

  // ห้าม cache: URL ที่เซ็นแล้วหมดอายุใน 5 นาที ถ้า CDN/เบราว์เซอร์เก็บ redirect
  // นี้ไว้ ครั้งถัดไปผู้ใช้จะถูกส่งไป URL ที่ตายแล้ว
  res.setHeader('Cache-Control', 'no-store');
  return res.redirect(302, signedRawUrl(version.fullAsset.publicId, TTL_SECONDS));
}
