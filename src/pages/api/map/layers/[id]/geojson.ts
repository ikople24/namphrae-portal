import type { NextApiRequest, NextApiResponse } from 'next';
import { getLayer, getPublishedVersion } from '@/lib/map-store';

// GeoJSON สาธารณะของเลเยอร์ — 302 ไป Cloudinary CDN
//
// จงใจ redirect ไม่ใช่ proxy: Pages Router เตือนเมื่อ response body เกิน 4MB และ
// ไฟล์แปลงที่ดินหนักกว่านั้น การ redirect ทำให้ไม่มีไบต์ไหนวิ่งผ่านเซิร์ฟเวอร์เรา
// เลย รับคนพร้อมกันเท่าไรก็ได้โดยไม่กระทบพอร์ทัลส่วนอื่น
//
// ไฟล์ปลายทางถูกกรองฟิลด์ตั้งแต่ตอนเผยแพร่แล้ว ที่นี่จึงไม่ต้องกรองอะไรอีก —
// และไม่มีอะไรให้กรองพลาดด้วย
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const layer = await getLayer(String(req.query.id));
  if (!layer) return res.status(404).json({ error: 'layer_not_found' });

  if (layer.visibility !== 'public') {
    return res.status(403).json({
      error: 'not_public',
      message: 'เลเยอร์นี้เปิดให้เฉพาะเจ้าหน้าที่',
    });
  }

  const published = await getPublishedVersion(layer.id);
  if (!published?.publicAsset) {
    return res.status(404).json({
      error: 'not_published',
      message: 'เลเยอร์นี้ยังไม่มีเวอร์ชันที่เผยแพร่',
    });
  }

  // CDN ของ Cloudinary จัดการ cache ของตัวไฟล์เอง ที่นี่ให้ cache สั้น ๆ พอให้
  // การเผยแพร่เวอร์ชันใหม่มีผลภายในไม่กี่นาที ไม่ใช่ค้างจน redirect ชี้ไฟล์เก่า
  res.setHeader('Cache-Control', 'public, max-age=300');
  return res.redirect(302, published.publicAsset.url);
}
