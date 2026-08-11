import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import {
  destroyRawAsset,
  fetchRawAsset,
  isCloudinaryConfigured,
  MAP_FOLDER_PUBLIC,
  uploadRawText,
} from '@/lib/cloudinary';
import { parseMapFile } from '@/lib/map-parse';
import { toPublicFeatureCollection } from '@/lib/map-public';
import {
  assetsToPrune,
  buildPublishPatch,
  getLayer,
  getPublishedVersion,
  getVersion,
  listVersions,
  patchLayer,
  patchVersion,
} from '@/lib/map-store';
import { LAYER_VERSIONS_KEPT, type MapPublicAsset } from '@/types/map';

// เผยแพร่: กรองฟิลด์ตาม publicFields → อัปไฟล์สาธารณะ → สลับสถานะ
//
// ลำดับนี้จงใจให้ล้มเหลวไปทางที่ปลอดภัย — อัปไฟล์สาธารณะให้เสร็จก่อนค่อยสลับ
// สถานะใน DB ถ้าพังกลางทาง ผลคือมีไฟล์กำพร้าบน Cloudinary (ขยะที่ไม่มีใคร
// อ้างถึง) แต่เลเยอร์ยังชี้ไปเวอร์ชันเดิมที่ใช้งานได้ ตรงข้ามกับการสลับสถานะก่อน
// ซึ่งจะทำให้เลเยอร์ชี้ไปไฟล์ที่ยังไม่มีอยู่จริง
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'map');
  if (!admin) return;

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isCloudinaryConfigured()) {
    return res.status(501).json({ error: 'cloudinary_not_configured' });
  }

  const version = await getVersion(String(req.query.vid));
  if (!version) return res.status(404).json({ error: 'version_not_found' });
  if (version.status === 'discarded') {
    return res.status(409).json({
      error: 'discarded',
      message: 'เวอร์ชันนี้ถูกทิ้งไปแล้ว เผยแพร่ไม่ได้',
    });
  }

  const layer = await getLayer(version.layerId);
  if (!layer) return res.status(404).json({ error: 'layer_not_found' });

  const currentPublished = await getPublishedVersion(layer.id);
  if (currentPublished?.id === version.id) {
    return res.status(409).json({
      error: 'already_published',
      message: 'เวอร์ชันนี้เผยแพร่อยู่แล้ว',
    });
  }

  let publicAsset: MapPublicAsset;
  if (version.publicAsset) {
    // ย้อนเวอร์ชัน — ไฟล์สาธารณะยังอยู่ ไม่ต้องประมวลผลใหม่
    publicAsset = version.publicAsset;
  } else {
    if (!version.fullAsset) {
      return res.status(409).json({
        error: 'full_asset_gone',
        message: 'ไฟล์เต็มของเวอร์ชันนี้ถูกลบตามนโยบายเก็บย้อนหลังแล้ว เผยแพร่ใหม่ไม่ได้',
      });
    }
    try {
      const text = await fetchRawAsset(version.fullAsset.publicId);
      const parsed = parseMapFile(text, 'full.geojson');
      if (!parsed.ok) {
        return res.status(422).json({ error: 'parse_failed', message: parsed.message });
      }
      const filtered = toPublicFeatureCollection(parsed.fc, layer.publicFields);
      const uploaded = await uploadRawText(JSON.stringify(filtered), {
        folder: MAP_FOLDER_PUBLIC,
        // ชื่อคงที่ต่อเวอร์ชันและลงท้าย .geojson เพื่อให้ QGIS/เบราว์เซอร์เดา
        // ชนิดไฟล์ถูกตอนเปิด URL ที่ redirect ไปถึง
        publicId: `${layer.id}-v${version.versionNo}.geojson`,
        type: 'upload',
      });
      publicAsset = uploaded;
    } catch (err) {
      console.error('map publish: building public asset failed', err);
      return res.status(502).json({
        error: 'publish_failed',
        message: 'สร้างไฟล์สาธารณะไม่สำเร็จ ยังไม่มีอะไรเปลี่ยน ลองใหม่อีกครั้ง',
      });
    }
  }

  const now = new Date().toISOString();
  const actor = admin.email ?? admin.userId;
  const patch = buildPublishPatch({ version, currentPublished, publicAsset, actor, now });

  await patchVersion(patch.publish.id, patch.publish.set);
  if (patch.supersede) await patchVersion(patch.supersede.id, patch.supersede.set);
  await patchLayer(layer.id, patch.layer);

  // ตัดไฟล์เต็มที่เกินนโยบายทิ้ง — ทำหลังสลับสถานะสำเร็จเท่านั้น และความล้มเหลว
  // ตรงนี้ไม่ทำให้การเผยแพร่ล้ม เพราะมันเป็นแค่การเก็บกวาดพื้นที่
  const after = await listVersions(layer.id);
  for (const asset of assetsToPrune(after, LAYER_VERSIONS_KEPT)) {
    try {
      await destroyRawAsset(asset.publicId, 'authenticated');
      const stale = after.find((v) => v.fullAsset?.publicId === asset.publicId);
      if (stale) await patchVersion(stale.id, { fullAsset: null });
    } catch (err) {
      console.warn('map publish: pruning old full asset failed', asset.publicId, err);
    }
  }

  return res.status(200).json({ version: await getVersion(version.id) });
}
