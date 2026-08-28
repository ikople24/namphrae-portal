import type { FeatureCollection } from '@/types/map';

// กรอง properties ให้เหลือเฉพาะฟิลด์ที่ประกาศเปิดเผยไว้อย่างตั้งใจ
//
// ทิศทางของค่าเริ่มต้นคือหัวใจ: publicFields ว่าง = ไม่เปิดฟิลด์ใดเลย ไม่ใช่เปิดหมด
// ฟิลด์ใหม่ที่โผล่มาในไฟล์เวอร์ชันหน้าจึงถูกกันไว้เองโดยอัตโนมัติ ไม่ใช่หลุดออกไป
// เองโดยอัตโนมัติ — ดูเหตุผลเดียวกันที่ PUBLIC_JOB_FIELDS ใน src/types/portal.ts
// ซึ่งเคยตกหล่นไปสามฟิลด์ตอนที่ยังไล่ประกาศฟิลด์ต้องห้ามทีละชื่อ
//
// ฟังก์ชันนี้ถูกเรียกตอน "เผยแพร่" ครั้งเดียวต่อเวอร์ชัน ไม่ใช่ตอนเสิร์ฟทุก request
// ไฟล์ที่วางอยู่บน CDN สาธารณะจึงไม่เคยมีฟิลด์ PII อยู่ในนั้นตั้งแต่แรก ต่อให้โค้ด
// ฝั่ง API พังหรือมีคนเดา URL เจอ ก็ไม่มีอะไรให้หลุด
export function toPublicFeatureCollection(
  fc: FeatureCollection,
  publicFields: string[]
): FeatureCollection {
  const allow = new Set(publicFields);
  return {
    // ประกอบใหม่ทั้งก้อนแทนการ spread: `name` กับ `crs` ของไฟล์ต้นทางไม่ควรติดไป
    // ด้วย และการ spread จะพาฟิลด์ระดับบนสุดที่เพิ่มมาในอนาคตหลุดไปเงียบ ๆ
    type: 'FeatureCollection',
    features: fc.features.map((f) => {
      const props: Record<string, unknown> = {};
      for (const key of Object.keys(f.properties ?? {})) {
        if (allow.has(key)) props[key] = f.properties![key];
      }
      return { type: 'Feature' as const, geometry: f.geometry, properties: props };
    }),
  };
}

/**
 * ไฟล์สาธารณะที่มีอยู่ ยังตรงกับนโยบายฟิลด์ปัจจุบันของเลเยอร์ไหม
 *
 * การกรองเกิดตอนเผยแพร่ครั้งเดียว ไฟล์ที่วางอยู่บน CDN จึงตรึงนโยบายของวันที่มันถูก
 * สร้างไว้ตลอดไป ถ้าไม่บันทึกไว้ว่าใช้ชุดไหนกรอง ก็ไม่มีทางรู้ว่ามันยังถูกต้องอยู่หรือ
 * กลายเป็นของเก่าไปแล้ว — และไม่รู้แปลว่าเดา ซึ่งเดาผิดทางหนึ่งคือ PII หลุด
 *
 * เทียบแบบไม่สนลำดับ เพราะลำดับใน publicFields ไม่มีความหมายกับผลการกรอง การสร้าง
 * ไฟล์ใหม่เพราะคนสลับลำดับติ๊กคือการเปลืองเปล่า ๆ
 *
 * ไฟล์ที่สร้างก่อนระบบจะเริ่มบันทึกนโยบาย (ไม่มีฟิลด์นี้) ถือว่าเก่าเสมอ — สร้างใหม่
 * เปลืองแค่ครั้งเดียว ส่วนการเดาว่ามันยังตรงอยู่แล้วเดาผิดคือข้อมูลส่วนบุคคลหลุด
 */
export function publicAssetIsStale(
  asset: { publicFields?: string[] } | null,
  publicFields: string[]
): boolean {
  if (!asset?.publicFields) return true;
  const was = [...asset.publicFields].sort();
  const now = [...publicFields].sort();
  return was.length !== now.length || was.some((f, i) => f !== now[i]);
}
