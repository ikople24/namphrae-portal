import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import { getCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';

// Returns a signature for a direct browser -> Cloudinary upload. The browser
// uploads the file itself (see admin-api.uploadMedia), so large videos never
// pass through this function.
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!isCloudinaryConfigured()) {
    return res.status(501).json({
      error: 'cloudinary_not_configured',
      message:
        'ยังไม่ได้ตั้งค่า Cloudinary — วาง URL รูปโดยตรงได้ หรือกรอกคีย์ใน .env',
    });
  }

  const kind = req.body?.kind === 'video' ? 'video' : 'image';
  const folder = 'namphrae-portal';
  // Cloudinary requires seconds; passed in via a signed timestamp.
  const timestamp = Math.round(Date.now() / 1000);

  const cloudinary = getCloudinary();
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder },
    process.env.CLOUDINARY_API_SECRET as string
  );

  return res.status(200).json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    folder,
    resourceType: kind,
  });
}
