import crypto from 'node:crypto';

/**
 * ตรวจลายเซ็น webhook ของ LINE: base64(HMAC-SHA256(rawBody, channelSecret))
 * เทียบกับ header `x-line-signature`
 *
 * รับ secret เป็นพารามิเตอร์ ไม่อ่าน process.env เอง — เทสต์จึงตั้งค่าเองได้
 * และ handler เป็นที่เดียวที่ตัดสินใจเรื่อง env
 *
 * @param rawBody body ดิบก่อนถูก parse — ลายเซ็นคำนวณจาก byte จริง
 */
export function verifyLineSignature(
  rawBody: Buffer | string,
  header: string | undefined,
  secret: string
): boolean {
  if (!header || !secret) return false;

  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
  );
  const received = Buffer.from(header);

  // timingSafeEqual โยน error ถ้าความยาวไม่เท่ากัน จึงต้องกันไว้ก่อน
  if (expected.length !== received.length) return false;
  return crypto.timingSafeEqual(expected, received);
}
