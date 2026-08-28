// src/lib/layer-routes.ts
import crypto from 'node:crypto';
import type { NextApiHandler } from 'next';
import { requireFeature } from '@/lib/auth-server';
import {
  destroyRawAsset,
  fetchRawAsset,
  isCloudinaryConfigured,
  signedRawUrl,
  signRawUpload,
  uploadRawText,
} from '@/lib/cloudinary';
import type { LayerDomain } from '@/lib/layer-domains';
import {
  assetsToPrune,
  buildNewVersion,
  buildPublishPatch,
  nextVersionNo,
} from '@/lib/layer-store';
import { ingestMapFile } from '@/lib/map-ingest';
import { collectIssueRows, toCsv } from '@/lib/map-issues';
import { parseMapFile } from '@/lib/map-parse';
import { publicAssetIsStale, toPublicFeatureCollection } from '@/lib/map-public';
import { layerPatchSchema, versionRegisterSchema } from '@/lib/schema';
import {
  CHECK_CODES,
  type CheckCode,
  type FeatureCollection,
  LAYER_VERSIONS_KEPT,
  type MapLayer,
  type MapLayerVersion,
  type MapPublicAsset,
} from '@/types/map';

// ตัวจัดการคำขอของคลังไฟล์ภูมิสารสนเทศ — โดเมนแผนที่กับโดเมนป่าไม้ใช้ชุดเดียวกัน
//
// เหตุผลที่ไม่คัดลอก route ไปวางอีกชุด: วันที่แก้บั๊กในด่านตรวจหรือในลำดับการเผยแพร่
// อีกโดเมนจะไม่ได้รับการแก้นั้นและไม่มีใครรู้จนกว่าจะมีคนบ่น — เหตุผลเดียวกับที่
// layer-store.ts มีอยู่
//
// **ทุกตัวที่ขึ้นต้นด้วย makeAdmin* เรียก requireFeature(domain.feature) เป็นบรรทัดแรก
// เสมอ** ข้อกำหนดนี้ถูกตรึงด้วย layer-routes.test.ts และเป็นสิ่งที่ทำให้ไฟล์ route
// บาง ๆ ผ่าน api-guard-coverage.test.ts ได้ทั้งที่ไม่มีสตริง requireFeature อยู่ในไฟล์

const TTL_SECONDS = 600;

export type AdminLayerRow = {
  layer: MapLayer;
  published: MapLayerVersion | null;
  draft: MapLayerVersion | null;
  versionCount: number;
};

/**
 * ทุกเลเยอร์พร้อมเวอร์ชันที่เผยแพร่อยู่และร่างที่ค้าง — การ์ดหน้าหลังบ้านใช้ก้อนนี้
 * ก้อนเดียววาดการ์ดได้ครบ ไม่ต้องยิงต่อเลเยอร์
 */
export function makeAdminLayersHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const layers = await domain.store.listLayers();
    const rows: AdminLayerRow[] = await Promise.all(
      layers.map(async (layer) => {
        const versions = await domain.store.listVersions(layer.id);
        return {
          layer,
          published: versions.find((v) => v.status === 'published') ?? null,
          // ร่างล่าสุดเท่านั้น — listVersions เรียงใหม่สุดขึ้นก่อนอยู่แล้ว
          draft: versions.find((v) => v.status === 'draft') ?? null,
          versionCount: versions.filter((v) => v.status !== 'discarded').length,
        };
      })
    );

    return res.status(200).json({ layers: rows });
  };
}

// ตั้งค่าเลเยอร์ — keyFields / keyComposition / visibility / publicFields
//
// การเปลี่ยน publicFields ไม่ไปแตะไฟล์สาธารณะที่เผยแพร่ไปแล้ว เพราะการกรองเกิด
// ตอนเผยแพร่ ไม่ใช่ตอนเสิร์ฟ ต้องกดเผยแพร่ใหม่ถึงจะมีผล — response จึงบอกกลับไป
// ด้วยว่ามีเวอร์ชันที่เผยแพร่อยู่ค้างด้วยนโยบายเก่าหรือไม่ ไม่งั้นเจ้าหน้าที่จะปิด
// ฟิลด์ PII แล้วเข้าใจว่ามันหายจากอินเทอร์เน็ตทันที ซึ่งไม่จริง
export function makeAdminLayerHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    const id = String(req.query.id);

    if (req.method === 'GET') {
      const layer = await domain.store.getLayer(id);
      if (!layer) return res.status(404).json({ error: 'layer_not_found' });
      return res.status(200).json({ layer, versions: await domain.store.listVersions(id) });
    }

    if (req.method !== 'PATCH') {
      res.setHeader('Allow', 'GET, PATCH');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const parsed = layerPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues });
    }

    const before = await domain.store.getLayer(id);
    if (!before) return res.status(404).json({ error: 'layer_not_found' });

    const layer = await domain.store.patchLayer(id, {
      ...parsed.data,
      updatedAt: new Date().toISOString(),
      updatedBy: admin.email ?? admin.userId,
    });

    const publicFieldsChanged =
      parsed.data.publicFields !== undefined &&
      JSON.stringify([...parsed.data.publicFields].sort()) !==
        JSON.stringify([...before.publicFields].sort());

    return res.status(200).json({
      layer,
      // true = ไฟล์ที่เสิร์ฟอยู่ยังใช้นโยบายเดิม ต้องกดเผยแพร่ใหม่
      republishNeeded: publicFieldsChanged && before.currentVersionNo !== null,
    });
  };
}

// GeoJSON **ฉบับเต็ม** ของเลเยอร์ที่เผยแพร่อยู่ — สำหรับหน้าแผนที่ฝั่งเจ้าหน้าที่
//
// ต่างจาก /api/map/layers/[id]/geojson (สาธารณะ) ตรงที่คืนทุกฟิลด์รวมข้อมูลส่วน
// บุคคล จึงต้องผ่าน requireAdmin เสมอ
//
// เป็น 302 ไป signed URL ด้วยเหตุผลเดียวกับฝั่งสาธารณะ (เพดาน response 4MB ของ
// Pages Router) แต่ URL มีอายุ 10 นาทีแทน 5 เพราะหน้าแผนที่อาจเปิดค้างไว้แล้วเพิ่ง
// กดเปิดเลเยอร์ทีหลัง — สั้นกว่านี้จะเจอ 403 กลางคันโดยไม่มีอะไรอธิบาย
export function makeAdminLayerGeojsonHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(501).json({ error: 'cloudinary_not_configured' });
    }

    const layer = await domain.store.getLayer(String(req.query.id));
    if (!layer) return res.status(404).json({ error: 'layer_not_found' });

    const published = await domain.store.getPublishedVersion(layer.id);
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
  };
}

// ลงทะเบียนไฟล์ที่เบราว์เซอร์อัปขึ้น Cloudinary ไปแล้ว: ดึงมาแกะ ตรวจ เทียบส่วนต่าง
// แล้วบันทึกเป็นร่าง
//
// ไฟล์ที่ไม่ผ่านด่าน error จะถูกลบออกจาก Cloudinary ทันทีและไม่เกิดร่าง — ไม่งั้น
// ไฟล์ที่ใช้ไม่ได้จะกองสะสมอยู่โดยไม่มีอะไรอ้างถึงและไม่มีใครรู้ว่ามันคืออะไร
export function makeAdminVersionsHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(501).json({ error: 'cloudinary_not_configured' });
    }

    const layerId = String(req.query.id);
    const layer = await domain.store.getLayer(layerId);
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

    const published = await domain.store.getPublishedVersion(layerId);
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

    const versions = await domain.store.listVersions(layerId);
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

    await domain.store.insertVersion(version);
    return res.status(201).json({ version });
  };
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

// ทิ้งร่าง — ทิ้งได้เฉพาะร่างเท่านั้น
//
// เอกสารไม่ถูกลบ แค่เปลี่ยนสถานะเป็น discarded: ประวัติว่าใครอัปอะไรเมื่อไรและ
// ผลตรวจเป็นอย่างไรคือร่องรอยของงานราชการ ห้ามหายไปพร้อมไฟล์ ส่วนตัวไฟล์เต็ม
// ถูกลบทิ้งจริงเพราะร่างที่ถูกทิ้งไม่มีทางถูกเผยแพร่ได้อีก
export function makeAdminVersionHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'DELETE') {
      res.setHeader('Allow', 'DELETE');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const version = await domain.store.getVersion(String(req.query.vid));
    if (!version) return res.status(404).json({ error: 'version_not_found' });

    if (version.status !== 'draft') {
      return res.status(409).json({
        error: 'not_a_draft',
        message:
          'ทิ้งได้เฉพาะร่างที่ยังไม่เผยแพร่ — เวอร์ชันที่เคยเผยแพร่แล้วต้องเก็บไว้เป็นประวัติและเพื่อให้ย้อนกลับได้',
      });
    }

    if (version.fullAsset) {
      try {
        await destroyRawAsset(version.fullAsset.publicId, 'authenticated');
      } catch (err) {
        // ลบไฟล์ไม่สำเร็จไม่ควรกันไม่ให้ทิ้งร่าง — ไฟล์กำพร้าเก็บกวาดทีหลังได้
        console.warn('map discard: destroying full asset failed', err);
      }
    }

    await domain.store.patchVersion(version.id, { status: 'discarded', fullAsset: null });
    return res.status(200).json({ ok: true });
  };
}

// เผยแพร่: กรองฟิลด์ตาม publicFields → อัปไฟล์สาธารณะ → สลับสถานะ
//
// ลำดับนี้จงใจให้ล้มเหลวไปทางที่ปลอดภัย — อัปไฟล์สาธารณะให้เสร็จก่อนค่อยสลับ
// สถานะใน DB ถ้าพังกลางทาง ผลคือมีไฟล์กำพร้าบน Cloudinary (ขยะที่ไม่มีใคร
// อ้างถึง) แต่เลเยอร์ยังชี้ไปเวอร์ชันเดิมที่ใช้งานได้ ตรงข้ามกับการสลับสถานะก่อน
// ซึ่งจะทำให้เลเยอร์ชี้ไปไฟล์ที่ยังไม่มีอยู่จริง
export function makeAdminPublishHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(501).json({ error: 'cloudinary_not_configured' });
    }

    const version = await domain.store.getVersion(String(req.query.vid));
    if (!version) return res.status(404).json({ error: 'version_not_found' });
    if (version.status === 'discarded') {
      return res.status(409).json({
        error: 'discarded',
        message: 'เวอร์ชันนี้ถูกทิ้งไปแล้ว เผยแพร่ไม่ได้',
      });
    }

    const layer = await domain.store.getLayer(version.layerId);
    if (!layer) return res.status(404).json({ error: 'layer_not_found' });

    const currentPublished = await domain.store.getPublishedVersion(layer.id);

    // ไฟล์สาธารณะที่มีอยู่ยังตรงกับ publicFields ปัจจุบันไหม — ตัวนี้เป็นคำตอบของทั้ง
    // "กดเผยแพร่ซ้ำได้ไหม" และ "ใช้ไฟล์เดิมต่อได้ไหม" เพราะทั้งสองคำถามคือคำถาม
    // เดียวกัน: ไฟล์ที่วางอยู่ยังถูกต้องตามนโยบายวันนี้หรือเปล่า
    const stale = publicAssetIsStale(version.publicAsset, layer.publicFields);

    // เผยแพร่ซ้ำตัวเดิมได้เมื่อนโยบายฟิลด์เปลี่ยนไปแล้วเท่านั้น — ถ้ายังตรงอยู่ก็ไม่มี
    // อะไรให้ทำจริง ๆ
    //
    // เดิมบล็อกนี้ปฏิเสธทุกกรณีโดยไม่ดูนโยบาย ผลคือปิดฟิลด์แล้วกดเผยแพร่ใหม่ไม่ได้เลย
    // ทั้งที่หน้าตั้งค่าขึ้นเตือนเองว่าต้องกด (republishNeeded) — ระบบบอกให้ทำสิ่งที่
    // ตัวมันเองไม่ยอมให้ทำ
    if (currentPublished?.id === version.id && !stale) {
      return res.status(409).json({
        error: 'already_published',
        message: 'เวอร์ชันนี้เผยแพร่อยู่แล้ว และรายการฟิลด์สาธารณะไม่ได้เปลี่ยน',
      });
    }

    let publicAsset: MapPublicAsset;
    if (version.publicAsset && !stale) {
      // ย้อนเวอร์ชัน — ไฟล์สาธารณะยังอยู่และกรองด้วยนโยบายชุดเดียวกับวันนี้
      //
      // ต้องเช็ค stale ด้วย ไม่ใช่แค่ว่ามีไฟล์อยู่: ถ้าเวอร์ชันนี้เคยเผยแพร่ตอนที่เปิด
      // ฟิลด์ PII ไว้ แล้วมีคนปิดฟิลด์นั้นไป การย้อนกลับมาจะเอาไฟล์เก่าที่มี PII ขึ้น
      // CDN อีกครั้งโดยไม่มีใครเห็น
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
          folder: domain.folderPublic,
          // ชื่อคงที่ต่อเวอร์ชันและลงท้าย .geojson เพื่อให้ QGIS/เบราว์เซอร์เดา
          // ชนิดไฟล์ถูกตอนเปิด URL ที่ redirect ไปถึง
          publicId: `${layer.id}-v${version.versionNo}.geojson`,
          type: 'upload',
        });
        // บันทึกนโยบายที่ใช้กรองไว้กับตัวไฟล์ ไม่ใช่แค่ผลลัพธ์การอัป — เป็นสิ่งเดียว
        // ที่ทำให้ครั้งหน้ารู้ได้ว่าไฟล์นี้ยังตรงกับนโยบายอยู่หรือต้องกรองใหม่
        publicAsset = { ...uploaded, publicFields: [...layer.publicFields] };
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

    await domain.store.patchVersion(patch.publish.id, patch.publish.set);
    if (patch.supersede) await domain.store.patchVersion(patch.supersede.id, patch.supersede.set);
    await domain.store.patchLayer(layer.id, patch.layer);

    // ตัดไฟล์เต็มที่เกินนโยบายทิ้ง — ทำหลังสลับสถานะสำเร็จเท่านั้น และความล้มเหลว
    // ตรงนี้ไม่ทำให้การเผยแพร่ล้ม เพราะมันเป็นแค่การเก็บกวาดพื้นที่
    const after = await domain.store.listVersions(layer.id);
    for (const asset of assetsToPrune(after, LAYER_VERSIONS_KEPT)) {
      try {
        await destroyRawAsset(asset.publicId, 'authenticated');
        const stale = after.find((v) => v.fullAsset?.publicId === asset.publicId);
        if (stale) await domain.store.patchVersion(stale.id, { fullAsset: null });
      } catch (err) {
        console.warn('map publish: pruning old full asset failed', asset.publicId, err);
      }
    }

    return res.status(200).json({ version: await domain.store.getVersion(version.id) });
  };
}

// CSV ของแถวที่เข้าข่ายคำเตือนหนึ่งข้อ — เอาไปเปิดใน QGIS/Excel แล้วไล่แก้ที่
// ต้นทางได้ทันที นี่คือสิ่งที่ทำให้คำเตือนเป็นงานที่ทำต่อได้ ไม่ใช่ตัวเลขที่ทุกคน
// เรียนรู้ที่จะกดข้าม
//
// อ่านจากไฟล์เต็มซึ่งมีข้อมูลส่วนบุคคล จึงต้องผ่าน requireAdmin เสมอ
export function makeAdminIssuesHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
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

    const version = await domain.store.getVersion(String(req.query.vid));
    if (!version) return res.status(404).json({ error: 'version_not_found' });
    if (!version.fullAsset) {
      return res.status(410).json({ error: 'full_asset_gone' });
    }

    const layer = await domain.store.getLayer(version.layerId);
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
  };
}

// อายุของ signed URL ฝั่งดาวน์โหลดไฟล์เต็ม — คนละค่ากับ TTL_SECONDS ด้านบนซึ่ง
// เป็นของหน้าแผนที่ฝั่งเจ้าหน้าที่
const DOWNLOAD_TTL_SECONDS = 300;

// ไฟล์เต็ม (มีข้อมูลส่วนบุคคล) — 302 ไป signed URL อายุ 5 นาที
//
// ไม่ proxy เนื้อไฟล์ผ่านที่นี่เพราะ Pages Router เตือนเมื่อ response เกิน 4MB
// และไฟล์แปลงที่ดินหนัก ~7 MB การตัดสินใจเรื่องสิทธิ์เกิดที่นี่ ส่วนการส่งไบต์
// เป็นงานของ Cloudinary
export function makeAdminDownloadHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
    if (!admin) return;

    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(501).json({ error: 'cloudinary_not_configured' });
    }

    const version = await domain.store.getVersion(String(req.query.vid));
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
    return res.redirect(302, signedRawUrl(version.fullAsset.publicId, DOWNLOAD_TTL_SECONDS));
  };
}

export type PublicLayerSummary = {
  id: string;
  title: string;
  description?: string;
  geometryType: string;
  featureCount: number;
  fields: string[];
  bbox: [number, number, number, number];
  updatedAt: string;
  versionNo: number;
  geojsonUrl: string;
};

// รายชื่อเลเยอร์ที่เผยแพร่แล้ว — สาธารณะ ไม่ต้องล็อกอิน
//
// คืนเฉพาะ metadata ที่ปลอดภัยเสมอ: ไม่มี publicId ของ Cloudinary (ซึ่งบอกใบ้
// ที่อยู่ของไฟล์เต็ม) ไม่มีชื่อผู้อัป/ผู้เผยแพร่ (เป็นชื่อเจ้าหน้าที่) และไม่มีผล
// ด่านตรวจ (บอกจำนวนแถวที่ข้อมูลมีปัญหา ซึ่งเป็นเรื่องภายใน)
export function makePublicLayersHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const base = `${req.headers['x-forwarded-proto'] ?? 'https'}://${req.headers.host}`;
    const layers = await domain.store.listLayers();
    const out: PublicLayerSummary[] = [];

    for (const layer of layers) {
      if (layer.visibility !== 'public' || layer.currentVersionNo === null) continue;
      const published = (await domain.store.listVersions(layer.id)).find(
        (v) => v.status === 'published'
      );
      if (!published?.publicAsset) continue;

      out.push({
        id: layer.id,
        title: layer.title,
        description: layer.description,
        geometryType: layer.geometryType,
        featureCount: published.stats.featureCount,
        // เฉพาะฟิลด์ที่เปิดเผยจริง ไม่ใช่ทุกฟิลด์ที่มีในไฟล์ — รายชื่อฟิลด์ที่ถูกปิด
        // ก็เป็นข้อมูลที่ไม่ควรบอก (own_Hse_no บอกใบ้ว่าไฟล์เต็มมีอะไร)
        fields: layer.publicFields,
        bbox: published.stats.bbox,
        updatedAt: published.publishedAt ?? published.uploadedAt,
        versionNo: published.versionNo,
        geojsonUrl: `${base}${domain.publicApiBase}/layers/${layer.id}/geojson`,
      });
    }

    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.status(200).json({ layers: out });
  };
}

// GeoJSON สาธารณะของเลเยอร์ — 302 ไป Cloudinary CDN
//
// จงใจ redirect ไม่ใช่ proxy: Pages Router เตือนเมื่อ response body เกิน 4MB และ
// ไฟล์แปลงที่ดินหนักกว่านั้น การ redirect ทำให้ไม่มีไบต์ไหนวิ่งผ่านเซิร์ฟเวอร์เรา
// เลย รับคนพร้อมกันเท่าไรก็ได้โดยไม่กระทบพอร์ทัลส่วนอื่น
//
// ไฟล์ปลายทางถูกกรองฟิลด์ตั้งแต่ตอนเผยแพร่แล้ว ที่นี่จึงไม่ต้องกรองอะไรอีก —
// และไม่มีอะไรให้กรองพลาดด้วย
export function makePublicLayerGeojsonHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'method_not_allowed' });
    }

    const layer = await domain.store.getLayer(String(req.query.id));
    if (!layer) return res.status(404).json({ error: 'layer_not_found' });

    if (layer.visibility !== 'public') {
      return res.status(403).json({
        error: 'not_public',
        message: 'เลเยอร์นี้เปิดให้เฉพาะเจ้าหน้าที่',
      });
    }

    const published = await domain.store.getPublishedVersion(layer.id);
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
  };
}

// ลายเซ็นให้เบราว์เซอร์อัปไฟล์ GeoJSON ตรงเข้า Cloudinary
//
// ไฟล์ไม่วิ่งผ่าน API route นี้ (Pages Router จำกัด body ที่ 1MB โดยปริยาย ส่วน
// ไฟล์แปลงที่ดินหนัก ~7 MB) ที่นี่ออกแต่ลายเซ็น ตัวไฟล์วิ่งตรงจากเบราว์เซอร์
export function makeAdminUploadSignatureHandler(domain: LayerDomain): NextApiHandler {
  return async (req, res) => {
    const admin = await requireFeature(req, res, domain.feature);
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

    return res.status(200).json(signRawUpload(domain.folderFull));
  };
}
