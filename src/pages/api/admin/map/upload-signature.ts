import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { isCloudinaryConfigured, signRawUpload } from '@/lib/cloudinary';

// ลายเซ็นให้เบราว์เซอร์อัปไฟล์ GeoJSON ตรงเข้า Cloudinary
//
// ไฟล์ไม่วิ่งผ่าน API route นี้ (Pages Router จำกัด body ที่ 1MB โดยปริยาย ส่วน
// ไฟล์แปลงที่ดินหนัก ~7 MB) ที่นี่ออกแต่ลายเซ็น ตัวไฟล์วิ่งตรงจากเบราว์เซอร์
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'map');
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!isCloudinaryConfigured()) {
    return res.status(501).json({
      error: 'cloudinary_not_configured',
      message:
        'ยังไม่ได้ตั้งค่า Cloudinary — คลังไฟล์แผนที่ต้องใช้ที่เก็บไฟล์ กรอก CLOUDINARY_* ใน .env ก่อน',
    });
  }

  return res.status(200).json(signRawUpload());
}
