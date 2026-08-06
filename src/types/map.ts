// โดเมนคลังไฟล์แผนที่ — แยกจาก portal.ts เพราะคนละโดเมนกันสิ้นเชิง
//
// GeoJSON ไทป์ประกาศเองแทนการลง @types/geojson: เราใช้แค่สามชนิดนี้และต้องการ
// ให้ properties เป็น Record<string, unknown> ตรง ๆ (ไม่ใช่ GeoJsonProperties ที่
// เป็น any) เพื่อให้ tsc จับการอ่านฟิลด์แบบไม่ตรวจชนิดได้

export type Geometry = { type: string; coordinates: unknown };

export type Feature = {
  type: 'Feature';
  geometry: Geometry | null;
  properties: Record<string, unknown> | null;
};

export type FeatureCollection = {
  type: 'FeatureCollection';
  features: Feature[];
  name?: string;
  crs?: unknown;
};

export const GEOMETRY_KINDS = [
  'Point',
  'MultiPoint',
  'LineString',
  'MultiLineString',
  'Polygon',
  'MultiPolygon',
] as const;
export type GeometryKind = (typeof GEOMETRY_KINDS)[number];

export const VERSION_STATUSES = [
  'draft',
  'published',
  'superseded',
  'discarded',
] as const;
export type VersionStatus = (typeof VERSION_STATUSES)[number];

export const SOURCE_FORMATS = ['geojson', 'qgis2web-js', 'shapefile-zip'] as const;
export type SourceFormat = (typeof SOURCE_FORMATS)[number];

// รหัสด่านตรวจทั้งหมด — แหล่งความจริงเดียว ใช้เป็น union ของ MapCheck.code
export const CHECK_CODES = [
  'parse-failed',
  'empty',
  'bad-geometry',
  'outside-thailand',
  'geometry-type-mismatch',
  'duplicate-key',
  'key-composition',
  'null-literal',
  'new-value',
  'count-jump',
  'field-removed',
  'mojibake',
  'identical',
  'new-public-candidate',
] as const;
export type CheckCode = (typeof CHECK_CODES)[number];

export type MapCheck = {
  code: CheckCode;
  level: 'error' | 'warning';
  message: string;
  count: number;
  sample: string[]; // ตัวอย่างไม่เกิน 5 ค่า สำหรับแสดงบนการ์ด
};

// `values` มีเฉพาะฟิลด์ประเภทหมวดหมู่ (distinct <= CATEGORICAL_MAX) — ด่าน
// new-value ของเวอร์ชันถัดไปเทียบกับอาเรย์นี้ จึงไม่ต้องดึงไฟล์เก่ามาทั้งก้อน
export type FieldStat = {
  name: string;
  filled: number;
  distinct: number;
  values?: string[];
};

export const CATEGORICAL_MAX = 50;

export type MapStats = {
  featureCount: number;
  geometryTypes: string[];
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  fields: FieldStat[];
};

export type MapDiff = {
  comparedToVersionNo: number;
  added: number;
  removed: number;
  changed: number;
  fieldsAdded: string[];
  fieldsRemoved: string[];
};

export type MapAsset = { publicId: string; bytes: number };
export type MapPublicAsset = MapAsset & { url: string };

export type MapLayer = {
  id: string;
  title: string;
  description?: string;
  geometryType: GeometryKind;
  keyFields: string[];
  keyComposition: string[][]; // ตั้งได้เมื่อ keyFields.length === 1 เท่านั้น
  visibility: 'public' | 'staff';
  publicFields: string[]; // [] = เปิดแค่รูปทรง ไม่เปิด properties เลย
  currentVersionNo: number | null;
  order: number;
  updatedAt: string;
  updatedBy: string;
};

export type MapLayerVersion = {
  id: string;
  layerId: string;
  versionNo: number;
  status: VersionStatus;
  source: { format: SourceFormat; fileName: string; bytes: number; sha256: string };
  // null = ไฟล์เต็มถูกลบตามนโยบายเก็บย้อนหลัง LAYER_VERSIONS_KEPT เวอร์ชัน
  // (เอกสารยังอยู่ตลอด ปุ่มดาวน์โหลดไฟล์เต็มถูกปิดเท่านั้น)
  fullAsset: MapAsset | null;
  // publicAsset ไม่เคยถูกลบตามนโยบายนั้น — มันคือสิ่งเดียวที่ทำให้ย้อนเวอร์ชัน
  // ได้ทันทีโดยไม่ต้องประมวลผลไฟล์ใหม่ null แปลว่ายังไม่เคยถูกเผยแพร่
  publicAsset: MapPublicAsset | null;
  stats: MapStats;
  checks: MapCheck[];
  diff: MapDiff | null;
  uploadedAt: string;
  uploadedBy: string;
  publishedAt?: string;
  publishedBy?: string;
  note?: string;
};

// ขอบเขตประเทศไทยแบบหลวม ๆ — ใช้ดักพิกัดที่ลืมแปลงจาก UTM (ค่าจะเป็นหลักแสน)
// ไม่ได้ใช้ตรวจว่าอยู่ในเขตเทศบาลจริงหรือไม่
export const THAILAND_BBOX: [number, number, number, number] = [
  97.3, 5.6, 105.7, 20.5,
];

export const LAYER_VERSIONS_KEPT = 5;
