import type { FeatureCollection } from '@/types/map';

// แปลง shapefile (.zip) เป็น GeoJSON — **ฝั่งเบราว์เซอร์เท่านั้น**
//
// ทำไมไม่ทำที่เซิร์ฟเวอร์: package.json ของ shpjs ชี้ exports.require ไปที่บันเดิล
// สำหรับเบราว์เซอร์ซึ่งอ้าง `self` แล้วพังทันทีบน Node (ReferenceError) ส่วน Pages
// Router ของ Next คอมไพล์ API route เป็น CJS และไม่ bundle dependency โดยปริยาย
// (bundlePagesRouterDependencies ต้องเปิดเอง) ทุก import จึงกลายเป็น require()
// การเปิด bundling ทั้งระบบเพื่อไลบรารีตัวเดียวกระทบ mongodb/clerk/cloudinary ด้วย
// จึงเลือกแปลงที่เบราว์เซอร์ซึ่งเป็นบ้านเกิดของไลบรารีนี้อยู่แล้ว
//
// เรื่องความปลอดภัย: เซิร์ฟเวอร์ไม่เคยเชื่อไฟล์ที่รับมาอยู่แล้ว ด่านตรวจทั้งหมดรัน
// ฝั่งเซิร์ฟเวอร์กับ GeoJSON ที่ได้รับ ไม่ว่ามันถูกแปลงมาจากไหน ผู้ใช้ที่ประสงค์ร้าย
// อัป GeoJSON อะไรก็ได้อยู่แล้วโดยไม่ต้องผ่านที่นี่ (แค่เลือกไฟล์ .geojson ตรง ๆ)

// เพดานก่อนเริ่มแปลง — ไฟล์ใหญ่กว่านี้จะทำให้แท็บค้างนานจนดูเหมือนเว็บแฮงก์
export const MAX_ZIP_BYTES = 100 * 1024 * 1024;

export async function shapefileZipToGeoJson(file: File): Promise<FeatureCollection> {
  if (file.size > MAX_ZIP_BYTES) {
    throw new Error(
      `ไฟล์ใหญ่เกิน ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)} MB — ลอง export เป็น GeoJSON จาก QGIS แล้วอัปแทน`
    );
  }

  // โหลดตอนใช้จริงเท่านั้น (~100 KB) หน้า /admin/map จึงไม่แบกน้ำหนักนี้ตอนเปิดปกติ
  const shp = (await import('shpjs')).default;

  let raw: unknown;
  try {
    raw = await shp(await file.arrayBuffer());
  } catch (err) {
    throw new Error(
      `แกะ shapefile ไม่สำเร็จ: ${(err as Error).message} — ไฟล์ zip ต้องมี .shp .shx .dbf และ .prj ครบ`
    );
  }

  // shp() คืนอาเรย์เมื่อ zip มีหลายเลเยอร์ — รวมทุกเลเยอร์เข้าด้วยกัน แล้วให้
  // ด่าน geometry-type-mismatch ฝั่งเซิร์ฟเวอร์เป็นคนบอกถ้ามันปนกันผิดชนิด
  const parts = (Array.isArray(raw) ? raw : [raw]) as FeatureCollection[];
  const features = parts.flatMap((p) => p?.features ?? []);

  if (features.length === 0) {
    throw new Error('แกะ shapefile ได้แต่ไม่มีข้อมูลสักรายการ');
  }

  // ไม่ใส่ crs: shpjs แปลงเป็น WGS84 lon/lat ให้แล้วตาม .prj ซึ่งเป็นค่าปริยายของ
  // GeoJSON อยู่แล้ว การใส่ crs ที่ไม่ใช่ CRS84 จะทำให้ parseMapFile ปฏิเสธไฟล์เอง
  return { type: 'FeatureCollection', features };
}

/** ไฟล์ที่วางมาต้องแปลงก่อนอัปไหม */
export function needsConversion(file: File): boolean {
  return file.name.toLowerCase().endsWith('.zip');
}
