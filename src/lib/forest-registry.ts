// src/lib/forest-registry.ts
import type { ForestLayer } from '@/types/forest';

// นิยามชั้นข้อมูลป่าไม้ตั้งต้น 7 ชั้น สำหรับ scripts/import-forest-map.mts เท่านั้น
//
// **ไฟล์นี้ไม่ใช่แหล่งความจริง** — ตั้งแต่รอบ 3 เจ้าหน้าที่สร้างชั้นเองได้ที่
// /admin/forest/new ฐานข้อมูลจึงเป็นความจริง ถ้าปล่อยให้ไฟล์นี้เป็นแหล่งความจริง
// วันที่มีคนรันสคริปต์ซ้ำ ชั้นที่เจ้าหน้าที่เพิ่มเองจะหายหรือถูกเขียนทับ
//
// ทุกชั้นตั้ง coordinatePrecision เป็น 6 (= 11 ซม. ที่ละติจูดของน้ำแพร่) เพราะไฟล์
// ต้นทางพกทศนิยมมา 14 ตำแหน่งทุกชั้น

export type ForestSeed = {
  /** ชื่อไฟล์ข้อมูลบนแผนที่ป่าไม้ที่เป็นต้นทางของชั้นนี้ */
  source: string;
  /** จำนวน feature ที่ต้องได้หลังล้างฟิลด์ — ไม่ตรง = หยุดนำเข้าทั้งงาน */
  expect: number;
  layer: Omit<ForestLayer, 'currentVersionNo' | 'updatedAt' | 'updatedBy'>;
};

const PRECISION = 6;

export const FOREST_SEEDS: ForestSeed[] = [
  {
    source: '_7.js',
    expect: 4,
    layer: {
      id: 'community-forest',
      title: 'ป่าชุมชน',
      description: 'ขอบเขตป่าชุมชนหมู่ 7, 9, 10 และ 11',
      geometryType: 'MultiPolygon',
      keyFields: ['moo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['moo', 'area_rai', 'area_km2'],
      // ชั้นเดียวที่เปิด — อีกสามชั้นรูปปิดมีเนื้อที่ทางการติดมาในไฟล์แล้ว ถ้าเปิดจะได้
      // ตัวเลขที่สามที่ไม่ตรงกับอีกสอง แล้วคนเอาไปอ้างผิดบนพอร์ทัลราชการ
      computeArea: true,
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 1,
    },
  },
  {
    source: '_8.js',
    expect: 13,
    layer: {
      id: 'forest-weir',
      title: 'ฝาย',
      description: 'ทะเบียนฝายที่สร้างในพื้นที่ป่า ปี 2564–2568',
      geometryType: 'Point',
      keyFields: ['name'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['name', 'surveyed_at', 'note'],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 2,
    },
  },
  {
    source: '_8.js',
    expect: 41,
    layer: {
      id: 'forest-weir-survey',
      title: 'จุดสำรวจฝาย มิ.ย. 2568',
      description: 'จุดที่เดินสำรวจและถ่ายรูปเมื่อ 18 และ 20 มิถุนายน 2568',
      geometryType: 'Point',
      // ชื่อไฟล์รูปเป็นทั้งตัวตนของหมุดและตัวชี้ไปที่รูป — รอบ 4 จับคู่รูปด้วยคีย์นี้ตรง ๆ
      keyFields: ['photo'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['surveyed_at', 'elevation_m'],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      publishPhotos: false,
      order: 3,
    },
  },
  {
    source: '_4.js',
    expect: 1,
    layer: {
      id: 'forest-kortorchor',
      title: 'วงรอบ คทช. ป่าแม่ท่าช้าง–ป่าแม่ขนิน',
      description: 'วงรอบพื้นที่ คทช. เนื้อที่ 5,935 ไร่ 1 งาน 36 ตารางวา',
      geometryType: 'MultiPolygon',
      // แถวเดียว ไม่มีอะไรให้ชนกัน — ด่าน duplicate-key จึงไม่มีงานทำ
      keyFields: [],
      keyComposition: [],
      visibility: 'public',
      // เนื้อที่ยังไม่เปิดจนกว่าจะรู้ว่าชุดไหนคืออะไร (ดู prepKortorchor)
      publicFields: [],
      coordinatePrecision: PRECISION,
      defaultOn: true,
      order: 4,
    },
  },
  {
    source: '_5.js',
    expect: 327,
    layer: {
      id: 'forest-stream',
      title: 'แหล่งน้ำ',
      description: 'ลำน้ำและแหล่งน้ำจำแนกตามชั้นคุณภาพ 6 ประเภท',
      geometryType: 'MultiLineString',
      // ชื่อลำน้ำเติมแค่ 65 จาก 327 เส้น ตั้งเป็นคีย์ไม่ได้ — เทียบแค่จำนวนเหมือนชั้นอาคาร
      keyFields: [],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['name', 'class_th'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 5,
    },
  },
  {
    source: '_2.js',
    expect: 26,
    layer: {
      id: 'forest-reserve',
      title: 'ป่าสงวนแห่งชาติ',
      description: 'ขอบเขตป่าสงวนแห่งชาติ เชียงใหม่ ลำพูน และแม่ฮ่องสอน',
      geometryType: 'MultiPolygon',
      keyFields: ['nrf_code'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['nrf_code', 'name', 'province', 'rai_gazette', 'rai_rfd', 'office'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 6,
    },
  },
  {
    source: '_3.js',
    expect: 29,
    layer: {
      id: 'forest-permanent',
      title: 'ป่าไม้ถาวร',
      description: 'ขอบเขตป่าไม้ถาวรตามมติคณะรัฐมนตรี',
      geometryType: 'MultiPolygon',
      keyFields: ['per_id'],
      keyComposition: [],
      visibility: 'public',
      publicFields: ['per_id', 'name', 'rai_rfd'],
      coordinatePrecision: PRECISION,
      defaultOn: false,
      order: 7,
    },
  },
];
