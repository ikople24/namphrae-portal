import { v2 as cloudinary } from 'cloudinary';

// Cloudinary is configured lazily and only used by admin upload routes. When the
// env vars are missing, the upload endpoint returns a friendly error instead of
// crashing, so the rest of the app still runs.

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
  return cloudinary;
}

export const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;

// Signature for a direct (browser -> Cloudinary) signed upload.
export type UploadSignature = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  resourceType: 'image' | 'video';
};

// ── คลังไฟล์แผนที่ ──────────────────────────────────────────────────────────
// ไฟล์ GeoJSON ขึ้นเป็น resource_type 'raw' และแยกเป็นสองชนิดต่อเวอร์ชัน:
//
//   type 'authenticated' → ไฟล์เต็ม (มี PII) เข้าถึงได้เฉพาะผ่าน signed URL ที่
//                          เซิร์ฟเวอร์ออกให้เจ้าหน้าที่ที่ล็อกอินแล้ว
//   type 'upload'        → ไฟล์สาธารณะที่กรองฟิลด์ออกแล้ว เสิร์ฟตรงจาก CDN
//
// ไฟล์เต็มต้องเป็น authenticated ไม่ใช่ upload ที่ตั้งชื่อเดายาก — การกันข้อมูล
// ด้วยความลับของ URL ไม่ใช่การกันข้อมูล

export const MAP_FOLDER_FULL = 'namphrae-portal/map/full';
export const MAP_FOLDER_PUBLIC = 'namphrae-portal/map/public';

/** ลายเซ็นให้เบราว์เซอร์อัปไฟล์ตรงเข้า Cloudinary — ข้ามเพดาน body 1MB ของ API route */
export function signRawUpload(): {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
  type: 'authenticated';
} {
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    timestamp,
    folder: MAP_FOLDER_FULL,
    type: 'authenticated',
  };
  const signature = getCloudinary().utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET as string
  );
  return {
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY as string,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME as string,
    folder: MAP_FOLDER_FULL,
    type: 'authenticated',
  };
}

/** ดึงเนื้อไฟล์ raw กลับมาที่เซิร์ฟเวอร์เพื่อแกะ/ตรวจ/กรอง */
export async function fetchRawAsset(publicId: string): Promise<string> {
  const url = signedRawUrl(publicId, 300);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ดึงไฟล์จาก Cloudinary ไม่สำเร็จ: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/** อัปเนื้อไฟล์จากเซิร์ฟเวอร์ (ใช้ตอนสร้างไฟล์สาธารณะที่กรองแล้ว) */
export async function uploadRawText(
  content: string,
  args: { folder: string; publicId: string; type: 'upload' | 'authenticated' }
): Promise<{ publicId: string; url: string; bytes: number }> {
  const cloudinary = getCloudinary();
  const dataUri = `data:application/json;base64,${Buffer.from(content, 'utf8').toString('base64')}`;
  const res = await cloudinary.uploader.upload(dataUri, {
    resource_type: 'raw',
    folder: args.folder,
    public_id: args.publicId,
    type: args.type,
    overwrite: true,
    invalidate: true,
  });
  return {
    publicId: res.public_id,
    url: res.secure_url,
    bytes: res.bytes ?? Buffer.byteLength(content, 'utf8'),
  };
}

/**
 * URL ชั่วคราวของไฟล์เต็ม — หมดอายุใน `ttlSeconds` วินาที
 *
 * ต้องส่ง type 'authenticated' ให้ตรงกับตอนอัป ไม่งั้น Cloudinary จะเซ็น URL ของ
 * resource คนละตัวแล้วได้ 404 ที่ดูเหมือนไฟล์หาย ทั้งที่ไฟล์อยู่ครบ
 */
export function signedRawUrl(publicId: string, ttlSeconds = 300): string {
  return getCloudinary().url(publicId, {
    resource_type: 'raw',
    type: 'authenticated',
    sign_url: true,
    expires_at: Math.round(Date.now() / 1000) + ttlSeconds,
  });
}

/** ลบไฟล์ทิ้ง — ใช้ตอนทิ้งร่างและตอนตัดไฟล์เก่าตามนโยบายเก็บย้อนหลัง */
export async function destroyRawAsset(
  publicId: string,
  type: 'upload' | 'authenticated'
): Promise<void> {
  await getCloudinary().uploader.destroy(publicId, {
    resource_type: 'raw',
    type,
    invalidate: true,
  });
}
