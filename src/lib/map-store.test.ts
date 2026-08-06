import { describe, expect, it } from 'vitest';
import {
  assetsToPrune,
  buildNewVersion,
  buildPublishPatch,
  nextVersionNo,
  VERSION_EDITABLE_BY_PUBLISH,
} from '@/lib/map-store';
import type { MapLayerVersion, MapStats } from '@/types/map';

const stats: MapStats = {
  featureCount: 3,
  geometryTypes: ['MultiPolygon'],
  bbox: [98, 18, 99, 19],
  fields: [{ name: 'a', filled: 3, distinct: 2, values: ['x', 'y'] }],
};

function version(over: Partial<MapLayerVersion> = {}): MapLayerVersion {
  return {
    id: 'v-id',
    layerId: 'parcel',
    versionNo: 1,
    status: 'draft',
    source: { format: 'geojson', fileName: 'a.geojson', bytes: 10, sha256: 'abc' },
    fullAsset: { publicId: 'full/1', bytes: 10 },
    publicAsset: null,
    stats,
    checks: [],
    diff: null,
    uploadedAt: '2026-08-06T00:00:00.000Z',
    uploadedBy: 'somchai@example.com',
    ...over,
  };
}

describe('nextVersionNo', () => {
  it('เริ่มที่ 1 เมื่อยังไม่มีเวอร์ชัน', () => {
    expect(nextVersionNo([])).toBe(1);
  });

  // นับต่อจากเลขสูงสุด ไม่ใช่จาก length: เวอร์ชันที่ถูกทิ้ง (discarded) ยังอยู่ใน
  // ประวัติ ถ้านับจาก length เลขจะย้อนกลับไปชนของเดิม
  it('นับต่อจากเลขสูงสุดที่เคยมี ไม่ใช่จำนวนเอกสาร', () => {
    expect(nextVersionNo([version({ versionNo: 7, status: 'discarded' })])).toBe(8);
  });
});

describe('buildNewVersion', () => {
  const built = buildNewVersion({
    id: 'fixed-id',
    layerId: 'parcel',
    versionNo: 4,
    source: { format: 'qgis2web-js', fileName: 'Parcel_3.js', bytes: 99, sha256: 'zz' },
    fullAsset: { publicId: 'full/4', bytes: 99 },
    stats,
    checks: [],
    diff: null,
    uploadedBy: 'somchai@example.com',
    now: '2026-08-06T10:00:00.000Z',
  });

  it('เวอร์ชันใหม่เป็นร่างเสมอ ไม่ว่าใครอัป', () => {
    expect(built.status).toBe('draft');
  });

  it('ยังไม่มีไฟล์สาธารณะจนกว่าจะเผยแพร่', () => {
    expect(built.publicAsset).toBeNull();
  });

  it('ไม่มี publishedAt/publishedBy ตั้งแต่แรก', () => {
    expect(built.publishedAt).toBeUndefined();
    expect(built.publishedBy).toBeUndefined();
  });

  it('บันทึกว่าใครอัปเมื่อไร', () => {
    expect(built).toMatchObject({
      uploadedBy: 'somchai@example.com',
      uploadedAt: '2026-08-06T10:00:00.000Z',
      versionNo: 4,
    });
  });
});

describe('buildPublishPatch', () => {
  const publicAsset = { publicId: 'pub/4', url: 'https://cdn/pub4.geojson', bytes: 5 };

  it('เวอร์ชันที่กดเผยแพร่กลายเป็น published พร้อมประทับผู้กด', () => {
    const r = buildPublishPatch({
      version: version({ versionNo: 4, id: 'v4' }),
      currentPublished: null,
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T11:00:00.000Z',
    });
    expect(r.publish.id).toBe('v4');
    expect(r.publish.set).toMatchObject({
      status: 'published',
      publicAsset,
      publishedBy: 'malee@example.com',
      publishedAt: '2026-08-06T11:00:00.000Z',
    });
  });

  it('เวอร์ชันเดิมที่เผยแพร่อยู่กลายเป็น superseded', () => {
    const r = buildPublishPatch({
      version: version({ versionNo: 4, id: 'v4' }),
      currentPublished: version({ versionNo: 3, id: 'v3', status: 'published' }),
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T11:00:00.000Z',
    });
    expect(r.supersede).toEqual({ id: 'v3', set: { status: 'superseded' } });
  });

  it('เลเยอร์ชี้ไปเวอร์ชันที่เพิ่งเผยแพร่', () => {
    const r = buildPublishPatch({
      version: version({ versionNo: 4, id: 'v4' }),
      currentPublished: null,
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T11:00:00.000Z',
    });
    expect(r.layer).toEqual({
      currentVersionNo: 4,
      updatedAt: '2026-08-06T11:00:00.000Z',
      updatedBy: 'malee@example.com',
    });
  });

  // ย้อนเวอร์ชัน = กดเผยแพร่ที่เวอร์ชันเก่า ต้องใช้ไฟล์สาธารณะเดิมที่ยังอยู่
  // ไม่ต้องประมวลผลใหม่ และต้องประทับว่าใครเป็นคนย้อนเมื่อไร
  it('ย้อนเวอร์ชันประทับผู้กดใหม่ทับของเดิม', () => {
    const old = version({
      versionNo: 2,
      id: 'v2',
      status: 'superseded',
      publicAsset,
      publishedBy: 'somchai@example.com',
      publishedAt: '2026-01-01T00:00:00.000Z',
    });
    const r = buildPublishPatch({
      version: old,
      currentPublished: version({ versionNo: 5, id: 'v5', status: 'published' }),
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T12:00:00.000Z',
    });
    expect(r.publish.set).toMatchObject({
      status: 'published',
      publishedBy: 'malee@example.com',
      publishedAt: '2026-08-06T12:00:00.000Z',
    });
    expect(r.supersede).toEqual({ id: 'v5', set: { status: 'superseded' } });
    expect(r.layer.currentVersionNo).toBe(2);
  });

  it('เผยแพร่ทับตัวเองไม่สร้าง supersede ที่ชี้กลับมาที่ตัวเอง', () => {
    const self = version({ versionNo: 4, id: 'v4', status: 'published' });
    const r = buildPublishPatch({
      version: self,
      currentPublished: self,
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T11:00:00.000Z',
    });
    expect(r.supersede).toBeNull();
  });

  it('เขียนเฉพาะฟิลด์ที่ประกาศว่าแก้ได้ตอนเผยแพร่', () => {
    const r = buildPublishPatch({
      version: version({ versionNo: 4, id: 'v4' }),
      currentPublished: null,
      publicAsset,
      actor: 'malee@example.com',
      now: '2026-08-06T11:00:00.000Z',
    });
    expect(Object.keys(r.publish.set).sort()).toEqual(
      [...VERSION_EDITABLE_BY_PUBLISH].sort()
    );
  });
});

describe('assetsToPrune', () => {
  const kept = 3;

  it('เก็บไฟล์เต็มของเวอร์ชันล่าสุดตามจำนวนที่กำหนด', () => {
    const versions = [1, 2, 3, 4, 5].map((n) =>
      version({ id: `v${n}`, versionNo: n, fullAsset: { publicId: `full/${n}`, bytes: 1 } })
    );
    expect(assetsToPrune(versions, kept).map((a) => a.publicId)).toEqual([
      'full/1',
      'full/2',
    ]);
  });

  // เกิดได้จริงเมื่อย้อนกลับไปใช้เวอร์ชันเก่ามากแล้วอัปเวอร์ชันใหม่ต่ออีกหลายรอบ
  it('ห้ามลบไฟล์ของเวอร์ชันที่เผยแพร่อยู่ ไม่ว่ามันจะเก่าแค่ไหน', () => {
    const versions = [1, 2, 3, 4, 5].map((n) =>
      version({
        id: `v${n}`,
        versionNo: n,
        status: n === 1 ? 'published' : 'superseded',
        fullAsset: { publicId: `full/${n}`, bytes: 1 },
      })
    );
    expect(assetsToPrune(versions, kept).map((a) => a.publicId)).toEqual(['full/2']);
  });

  it('ข้ามเวอร์ชันที่ไฟล์ถูกลบไปแล้ว ไม่สั่งลบซ้ำ', () => {
    const versions = [1, 2, 3, 4, 5].map((n) =>
      version({
        id: `v${n}`,
        versionNo: n,
        fullAsset: n <= 2 ? null : { publicId: `full/${n}`, bytes: 1 },
      })
    );
    expect(assetsToPrune(versions, kept)).toEqual([]);
  });

  it('ยังไม่ถึงเพดานก็ไม่ลบอะไร', () => {
    const versions = [1, 2].map((n) => version({ id: `v${n}`, versionNo: n }));
    expect(assetsToPrune(versions, kept)).toEqual([]);
  });

  // publicAsset คือสิ่งเดียวที่ทำให้ย้อนเวอร์ชันได้ทันที ห้ามอยู่ในรายการลบ
  it('ไม่แตะไฟล์สาธารณะเลย', () => {
    const versions = [1, 2, 3, 4, 5].map((n) =>
      version({
        id: `v${n}`,
        versionNo: n,
        fullAsset: { publicId: `full/${n}`, bytes: 1 },
        publicAsset: { publicId: `pub/${n}`, url: 'https://cdn/x', bytes: 1 },
      })
    );
    const pruned = assetsToPrune(versions, kept).map((a) => a.publicId);
    expect(pruned.every((id) => id.startsWith('full/'))).toBe(true);
  });
});
