import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { fetchRawAsset, isCloudinaryConfigured } from '@/lib/cloudinary';
import { collectIssueRows, toCsv } from '@/lib/map-issues';
import { parseMapFile } from '@/lib/map-parse';
import { getLayer, getVersion } from '@/lib/map-store';
import { CHECK_CODES, type CheckCode } from '@/types/map';

// CSV ของแถวที่เข้าข่ายคำเตือนหนึ่งข้อ — เอาไปเปิดใน QGIS/Excel แล้วไล่แก้ที่
// ต้นทางได้ทันที นี่คือสิ่งที่ทำให้คำเตือนเป็นงานที่ทำต่อได้ ไม่ใช่ตัวเลขที่ทุกคน
// เรียนรู้ที่จะกดข้าม
//
// อ่านจากไฟล์เต็มซึ่งมีข้อมูลส่วนบุคคล จึงต้องผ่าน requireAdmin เสมอ
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

  const code = String(req.query.code ?? '') as CheckCode;
  if (!CHECK_CODES.includes(code)) {
    return res.status(400).json({ error: 'unknown_code' });
  }

  const version = await getVersion(String(req.query.vid));
  if (!version) return res.status(404).json({ error: 'version_not_found' });
  if (!version.fullAsset) {
    return res.status(410).json({ error: 'full_asset_gone' });
  }

  const layer = await getLayer(version.layerId);
  if (!layer) return res.status(404).json({ error: 'layer_not_found' });

  let text: string;
  try {
    text = await fetchRawAsset(version.fullAsset.publicId);
  } catch (err) {
    console.error('map issues: fetch full asset failed', err);
    return res.status(502).json({ error: 'fetch_failed' });
  }

  const parsed = parseMapFile(text, 'full.geojson');
  if (!parsed.ok) return res.status(422).json({ error: 'parse_failed' });

  const table = collectIssueRows(parsed.fc, layer, code);
  const fileName = `${layer.id}-v${version.versionNo}-${code}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(toCsv(table));
}
