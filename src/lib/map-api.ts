import { needsConversion, shapefileZipToGeoJson } from '@/lib/map-shapefile-client';
import type { MapCheck, MapLayer, MapLayerVersion, SourceFormat } from '@/types/map';
import type { LayerPatchInput } from '@/lib/schema';

// ตัวห่อบาง ๆ รอบ /api/admin/map สำหรับหน้าหลังบ้าน — แยกจาก admin-api.ts เพราะ
// ไฟล์นั้นดูแลโดเมนลิงก์/ปฏิทิน/ผู้ใช้อยู่แล้วและยาวพอตัว

/**
 * ไฟล์ถูกปฏิเสธที่ด่านตรวจ — พก MapCheck ระดับ error กลับมาด้วยเพื่อให้การ์ด
 * แสดงได้ว่า "ผิดตรงไหนและต้องแก้อะไรใน QGIS" ไม่ใช่แค่ "อัปไม่สำเร็จ"
 */
export class UploadRejectedError extends Error {
  constructor(
    message: string,
    readonly checks: MapCheck[]
  ) {
    super(message);
    this.name = 'UploadRejectedError';
  }
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `คำขอล้มเหลว: ${res.status}`;
    let checks: MapCheck[] = [];
    try {
      const body = await res.json();
      if (Array.isArray(body?.checks)) checks = body.checks as MapCheck[];
      // ข้อความไทยจากเซิร์ฟเวอร์อธิบายว่าต้องแก้อะไร ให้ผู้ใช้เห็นตรง ๆ ดีกว่า
      // รหัส error ที่ไม่มีใครอ่านออก
      if (body?.message) message = body.message;
      else if (checks.length > 0) message = 'ไฟล์นี้ยังใช้ไม่ได้';
      else if (body?.error) message = `${message} (${body.error})`;
    } catch {
      // ไม่มี body ที่เป็น JSON — ใช้ข้อความตามสถานะ
    }
    if (checks.length > 0) throw new UploadRejectedError(message, checks);
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export type AdminLayerRow = {
  layer: MapLayer;
  published: MapLayerVersion | null;
  draft: MapLayerVersion | null;
  versionCount: number;
};

export const mapFetcher = <T = unknown>(url: string): Promise<T> =>
  fetch(url).then((r) => jsonOrThrow<T>(r));

export type UploadStage = 'converting' | 'uploading' | 'checking';

/**
 * ลากไฟล์วาง → ได้ร่างหนึ่งเวอร์ชัน
 *
 * .zip ถูกแปลงเป็น GeoJSON ที่เบราว์เซอร์ก่อน (ดู map-shapefile-client.ts) ส่วน
 * ตัวไฟล์วิ่งตรงเข้า Cloudinary ไม่ผ่าน API route ของเรา เพราะ Pages Router
 * จำกัด body ที่ 1MB แต่ไฟล์แปลงที่ดินหนัก ~7 MB
 */
export async function uploadLayerFile(
  layerId: string,
  file: File,
  onStage?: (stage: UploadStage) => void
): Promise<MapLayerVersion> {
  let blob: Blob = file;
  let sourceFormat: SourceFormat = file.name.toLowerCase().endsWith('.js')
    ? 'qgis2web-js'
    : 'geojson';

  if (needsConversion(file)) {
    onStage?.('converting');
    const fc = await shapefileZipToGeoJson(file);
    blob = new Blob([JSON.stringify(fc)], { type: 'application/json' });
    // บันทึกที่มาว่าเป็น shapefile ไว้ในประวัติ แม้สิ่งที่อัปขึ้นจริงเป็น GeoJSON
    sourceFormat = 'shapefile-zip';
  }

  onStage?.('uploading');
  const sig = await jsonOrThrow<{
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
    type: string;
  }>(await fetch('/api/admin/map/upload-signature', { method: 'POST' }));

  const form = new FormData();
  form.append('file', blob);
  form.append('api_key', sig.apiKey);
  form.append('timestamp', String(sig.timestamp));
  form.append('signature', sig.signature);
  form.append('folder', sig.folder);
  form.append('type', sig.type);

  const uploadRes = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/raw/upload`,
    { method: 'POST', body: form }
  );
  if (!uploadRes.ok) {
    throw new Error(`อัปไฟล์ขึ้นที่เก็บไม่สำเร็จ (${uploadRes.status})`);
  }
  const uploaded = (await uploadRes.json()) as { public_id: string; bytes: number };

  onStage?.('checking');
  const { version } = await jsonOrThrow<{ version: MapLayerVersion }>(
    await fetch(`/api/admin/map/layers/${encodeURIComponent(layerId)}/versions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        publicId: uploaded.public_id,
        fileName: file.name,
        bytes: uploaded.bytes,
        sourceFormat,
      }),
    })
  );
  return version;
}

export async function publishVersion(versionId: string): Promise<MapLayerVersion> {
  const { version } = await jsonOrThrow<{ version: MapLayerVersion }>(
    await fetch(`/api/admin/map/versions/${encodeURIComponent(versionId)}/publish`, {
      method: 'POST',
    })
  );
  return version;
}

export async function discardVersion(versionId: string): Promise<void> {
  await jsonOrThrow(
    await fetch(`/api/admin/map/versions/${encodeURIComponent(versionId)}`, {
      method: 'DELETE',
    })
  );
}

export async function patchMapLayer(
  layerId: string,
  patch: LayerPatchInput
): Promise<{ layer: MapLayer; republishNeeded: boolean }> {
  return jsonOrThrow(
    await fetch(`/api/admin/map/layers/${encodeURIComponent(layerId)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(patch),
    })
  );
}

export function issuesCsvUrl(versionId: string, code: string): string {
  return `/api/admin/map/versions/${encodeURIComponent(versionId)}/issues?code=${encodeURIComponent(code)}`;
}

export function downloadUrl(versionId: string): string {
  return `/api/admin/map/versions/${encodeURIComponent(versionId)}/download`;
}
