// src/lib/layer-routes.ts
import type { NextApiHandler } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { isCloudinaryConfigured, signedRawUrl } from '@/lib/cloudinary';
import type { LayerDomain } from '@/lib/layer-domains';
import { layerPatchSchema } from '@/lib/schema';
import type { MapLayer, MapLayerVersion } from '@/types/map';

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

/** ทุกเลเยอร์พร้อมเวอร์ชันที่เผยแพร่อยู่และร่างที่ค้าง — การ์ดหน้าหลังบ้านใช้ก้อนเดียวนี้ */
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
