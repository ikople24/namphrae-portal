import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin } from '@/lib/auth-server';
import {
  destroyRawAsset,
  fetchRawAsset,
  isCloudinaryConfigured,
} from '@/lib/cloudinary';
import { ingestMapFile } from '@/lib/map-ingest';
import { parseMapFile } from '@/lib/map-parse';
import {
  buildNewVersion,
  getLayer,
  getPublishedVersion,
  insertVersion,
  listVersions,
  nextVersionNo,
} from '@/lib/map-store';
import { versionRegisterSchema } from '@/lib/schema';
import type { FeatureCollection, MapLayerVersion } from '@/types/map';

// ลงทะเบียนไฟล์ที่เบราว์เซอร์อัปขึ้น Cloudinary ไปแล้ว: ดึงมาแกะ ตรวจ เทียบส่วนต่าง
// แล้วบันทึกเป็นร่าง
//
// ไฟล์ที่ไม่ผ่านด่าน error จะถูกลบออกจาก Cloudinary ทันทีและไม่เกิดร่าง — ไม่งั้น
// ไฟล์ที่ใช้ไม่ได้จะกองสะสมอยู่โดยไม่มีอะไรอ้างถึงและไม่มีใครรู้ว่ามันคืออะไร
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(501).json({ error: 'cloudinary_not_configured' });
  }

  const layerId = String(req.query.id);
  const layer = await getLayer(layerId);
  if (!layer) return res.status(404).json({ error: 'layer_not_found' });

  const parsedBody = versionRegisterSchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res
      .status(400)
      .json({ error: 'invalid_body', detail: parsedBody.error.issues });
  }
  const input = parsedBody.data;

  let text: string;
  try {
    text = await fetchRawAsset(input.publicId);
  } catch (err) {
    console.error('map versions: fetch uploaded asset failed', err);
    return res.status(502).json({
      error: 'fetch_failed',
      message: 'ดึงไฟล์ที่เพิ่งอัปกลับมาไม่ได้ ลองอัปใหม่อีกครั้ง',
    });
  }

  const published = await getPublishedVersion(layerId);
  const previous = published ? await withFeatureCollection(published) : null;

  const result = ingestMapFile({
    text,
    // ตั้งชื่อไฟล์ที่ส่งให้ parser ตามรูปแบบที่อัปขึ้นจริง ไม่ใช่ชื่อไฟล์ต้นทางที่
    // ผู้ใช้เลือก — .zip ถูกแปลงเป็น GeoJSON ที่เบราว์เซอร์ไปแล้ว ถ้าส่งชื่อ .zip
    // ต่อไป parser จะพยายามอ่านมันเป็น qgis2web แล้วปฏิเสธทั้งที่เนื้อไฟล์ถูกต้อง
    fileName: input.sourceFormat === 'qgis2web-js' ? 'upload.js' : 'upload.geojson',
    layer,
    previous,
  });

  if (!result.ok) {
    await discard(input.publicId);
    return res.status(422).json({ error: 'parse_failed', message: result.message });
  }
  if (result.blocked) {
    await discard(input.publicId);
    return res.status(422).json({ error: 'checks_failed', checks: result.checks });
  }

  const versions = await listVersions(layerId);
  const version = buildNewVersion({
    id: crypto.randomUUID(),
    layerId,
    versionNo: nextVersionNo(versions),
    source: {
      format: input.sourceFormat,
      fileName: input.fileName,
      bytes: input.bytes,
      sha256: result.sha256,
    },
    fullAsset: { publicId: input.publicId, bytes: input.bytes },
    stats: result.stats,
    checks: result.checks,
    diff: result.diff,
    uploadedBy: admin.email ?? admin.userId,
    now: new Date().toISOString(),
    note: input.note,
  });

  await insertVersion(version);
  return res.status(201).json({ version });
}

async function withFeatureCollection(
  version: MapLayerVersion
): Promise<{ version: MapLayerVersion; fc: FeatureCollection } | null> {
  if (!version.fullAsset) return null; // ไฟล์เต็มถูกตัดตามนโยบายแล้ว เทียบไม่ได้
  try {
    const text = await fetchRawAsset(version.fullAsset.publicId);
    const parsed = parseMapFile(text, 'previous.geojson');
    return parsed.ok ? { version, fc: parsed.fc } : null;
  } catch (err) {
    // เทียบส่วนต่างไม่ได้ไม่ควรทำให้อัปโหลดล้มทั้งรอบ — ร่างยังเกิดได้ แค่ไม่มี
    // ตัวเลข +/- ให้ดู ซึ่งดีกว่าปฏิเสธไฟล์ที่ถูกต้องเพราะของเก่ามีปัญหา
    console.warn('map versions: previous version unreadable, skipping diff', err);
    return null;
  }
}

async function discard(publicId: string): Promise<void> {
  try {
    await destroyRawAsset(publicId, 'authenticated');
  } catch (err) {
    console.warn('map versions: cleanup of rejected upload failed', err);
  }
}
