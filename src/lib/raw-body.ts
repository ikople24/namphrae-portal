// src/lib/raw-body.ts
// อ่าน body ดิบของคำขอโดยมีเพดาน — สำหรับ route ที่ปิด bodyParser (Next ไม่กันขนาดให้แล้ว และ
// Railway ไม่มีตัวกั้นที่ขอบแบบ Vercel) · รับ AsyncIterable ไม่ใช่ IncomingMessage เพื่อให้เทสต์
// ส่ง generator เข้ามาได้ตรง ๆ

/** เกิน max → null ทันทีโดยไม่อ่าน chunk ถัดไป (ไม่ปล่อยให้คนยิงไฟล์ใหญ่มาค้างหน่วยความจำ) */
export async function readRawBody(
  chunks: AsyncIterable<unknown>,
  max: number
): Promise<Buffer | null> {
  const parts: Buffer[] = [];
  let size = 0;
  for await (const chunk of chunks) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk as Uint8Array);
    size += buf.length;
    if (size > max) return null;
    parts.push(buf);
  }
  return Buffer.concat(parts);
}
