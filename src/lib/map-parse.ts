import type { FeatureCollection, SourceFormat } from '@/types/map';

// แกะข้อความไฟล์เป็น FeatureCollection — ไม่มี dependency และไม่มี I/O
//
// รองรับสองทางเข้าเท่านั้น: .geojson/.json ตรง ๆ กับไฟล์ qgis2web (.js) ที่ห่อ
// GeoJSON ไว้ด้วย `var json_ชื่อเลเยอร์ = {...}` ส่วน shapefile (.zip) ถูกแปลงที่
// เบราว์เซอร์ก่อนอัปขึ้นมา (ดูสเปกหัวข้อ "ทำไมแปลง shapefile ที่เบราว์เซอร์") —
// ห้ามเพิ่ม dependency อ่าน shapefile ที่ไฟล์นี้: shpjs ชี้ exports.require ไปที่
// บันเดิลสำหรับเบราว์เซอร์ซึ่งอ้าง `self` แล้วพังทันทีบน Node ส่วน Pages Router
// ไม่ bundle dependency โดยปริยาย จึงเรียกด้วย require() เสมอ

export type ParseResult =
  | { ok: true; fc: FeatureCollection; format: SourceFormat }
  | { ok: false; message: string };

// `var json_x = ` โดยจำนวนช่องว่างไม่แน่นอนตามรุ่นของ qgis2web
const QGIS2WEB_HEAD = /^\s*var\s+json_[A-Za-z0-9_]+\s*=\s*/;

// ชื่อ CRS ที่แปลว่า lon/lat องศาบน WGS84 — ตัวอื่นทั้งหมดปฏิเสธ ไม่แปลงให้เอง
// เพราะการเดา CRS ผิดทำให้ข้อมูลไปโผล่ผิดที่โดยไม่มีอะไรเตือน
const CRS84 = new Set([
  'urn:ogc:def:crs:ogc:1.3:crs84',
  'urn:ogc:def:crs:epsg::4326',
  'epsg:4326',
]);

export function parseMapFile(text: string, fileName: string): ParseResult {
  const isJs = fileName.toLowerCase().endsWith('.js');
  let body = text;
  let format: SourceFormat = 'geojson';

  if (isJs) {
    if (!QGIS2WEB_HEAD.test(text)) {
      return {
        ok: false,
        message:
          'อ่านไฟล์ไม่ออก: ไฟล์ .js ต้องขึ้นต้นด้วย var json_… = ตามรูปแบบของ qgis2web',
      };
    }
    format = 'qgis2web-js';
    // ตัดหัวออก แล้วตัดอัฒภาค/ช่องว่างท้ายไฟล์ทิ้ง (บางไฟล์ไม่มี ; ปิด)
    body = text.replace(QGIS2WEB_HEAD, '').trim().replace(/;+\s*$/, '');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    return { ok: false, message: `อ่านไฟล์ไม่ออก: ${(err as Error).message}` };
  }

  const fc = parsed as FeatureCollection;
  if (!fc || fc.type !== 'FeatureCollection' || !Array.isArray(fc.features)) {
    return { ok: false, message: 'อ่านไฟล์ไม่ออก: เนื้อไฟล์ไม่ใช่ FeatureCollection' };
  }

  const crsName = readCrsName(fc.crs);
  if (crsName && !CRS84.has(crsName.toLowerCase())) {
    return {
      ok: false,
      message: `ไฟล์ระบุระบบพิกัดเป็น ${crsName} — ต้อง export เป็น EPSG:4326 (WGS 84 lon/lat) ก่อน ระบบไม่แปลงพิกัดให้เอง`,
    };
  }

  return { ok: true, fc, format };
}

function readCrsName(crs: unknown): string | null {
  if (!crs || typeof crs !== 'object') return null;
  const props = (crs as { properties?: { name?: unknown } }).properties;
  return typeof props?.name === 'string' ? props.name : null;
}
