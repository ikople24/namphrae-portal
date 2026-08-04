import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyLineSignature } from '@/lib/line-signature';
import { getLineGroupId, setLineGroupId } from '@/lib/line';
import { clientIp, rateLimit } from '@/lib/rate-limit';

// ลายเซ็นคำนวณจาก byte ดิบของ body — ถ้าปล่อยให้ Next parse ก่อน จะตรวจไม่ผ่าน
export const config = { api: { bodyParser: false } };

type LineEvent = {
  type: string;
  source?: { type?: string; groupId?: string };
};

// LINE webhook จริงมีขนาดไม่กี่ KB — ตั้งเพดานไว้กันคนยิง body ใหญ่ ๆ ใส่
// endpoint ที่ใครก็เรียกได้ Next ปิด bodyParser แล้วไม่มีเพดานให้เลย และ Railway
// ก็ไม่มีตัวกั้นที่ขอบเหมือน Vercel — ถ้าไม่กันตรงนี้ก็ไม่มีใครกันแล้ว
const MAX_BODY_BYTES = 256 * 1024;

async function readRawBody(req: NextApiRequest): Promise<Buffer | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buf.length;
    if (size > MAX_BODY_BYTES) return null; // เกินเพดาน — ไม่อ่านต่อ
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

// POST /api/line/webhook
//
// หน้าที่เดียวคือจำว่าบอทอยู่กลุ่มไหน เจ้าหน้าที่จึงไม่ต้องไปหา groupId เอง:
// เชิญบอท OA เข้ากลุ่ม → LINE ส่ง event `join` มาที่นี่ → เก็บลง config
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  // กันไว้ก่อนอ่าน body: จำกัดต่อ IP เพราะ endpoint นี้คำนวณ HMAC ทั้ง body
  // ทุกครั้ง ไม่ได้ฟรี ตัวจำกัดเป็นแบบ in-memory ต่อ instance (ดู rate-limit.ts)
  // จึงเป็นแค่ตัวกันหยาบ ๆ ไม่ใช่การรับประกันแบบแข็ง แต่ก็ยังดีกว่าไม่มีเลย
  if (!rateLimit(`line-webhook:${clientIp(req)}`, 120, 60_000)) {
    return res.status(429).end();
  }

  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    console.warn('LINE webhook ถูกเรียกแต่ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET');
    return res.status(503).end();
  }

  const raw = await readRawBody(req);
  if (!raw) return res.status(413).end();

  const signature = req.headers['x-line-signature'];
  if (
    !verifyLineSignature(
      raw,
      typeof signature === 'string' ? signature : undefined,
      secret
    )
  ) {
    return res.status(401).end();
  }

  let body: { events?: LineEvent[] };
  try {
    body = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  // ปุ่ม Verify ในคอนโซล LINE ส่ง events ว่างมา — ต้องตอบ 200 ให้ผ่าน
  for (const event of body.events ?? []) {
    const groupId =
      event.source?.type === 'group' ? event.source.groupId : undefined;
    if (!groupId) continue;

    try {
      if (event.type === 'join') {
        const current = await getLineGroupId();
        if (current && current !== groupId) {
          // ไม่ทับของเดิมโดยอัตโนมัติ — ข้อความแจ้งเตือนมีชื่อผู้ป่วย เบอร์โทร
          // ต้นทางปลายทางครบ ใครก็ตามที่เชิญบอทเข้ากลุ่มใหม่ได้จะเปลี่ยนปลายทาง
          // ของข้อมูลชุดนั้นทันทีโดยไม่มีอะไรเตือน — ให้เจ้าหน้าที่ไปเปลี่ยนเอง
          // ที่ /admin/settings ซึ่งเห็นค่าปัจจุบันอยู่แล้ว
          console.warn(
            `LINE webhook: ถูกเชิญเข้ากลุ่ม ${groupId} แต่ตั้งกลุ่ม ${current} ไว้อยู่แล้ว — ` +
              'ไม่เปลี่ยนให้อัตโนมัติ ถ้าต้องการย้ายกลุ่มให้แก้ที่ /admin/settings'
          );
          continue;
        }
        await setLineGroupId(groupId, 'line-webhook');
        console.log(`LINE webhook: เข้ากลุ่ม ${groupId} — ตั้งเป็นปลายทางแจ้งเตือน`);
      } else if (event.type === 'leave') {
        if ((await getLineGroupId()) === groupId) {
          await setLineGroupId(undefined, 'line-webhook');
          console.log(`LINE webhook: ออกจากกลุ่ม ${groupId} — ล้างปลายทางแล้ว`);
        }
      }
    } catch (err) {
      // ตอบ 200 ต่อไป ไม่งั้น LINE จะ retry ซ้ำ ๆ ด้วย event เดิม
      console.error('LINE webhook: บันทึก groupId ไม่สำเร็จ', err);
    }
  }

  return res.status(200).end();
}
