import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyLineSignature } from '@/lib/line-signature';
import { getLineGroupId, setLineGroupId } from '@/lib/line';

// ลายเซ็นคำนวณจาก byte ดิบของ body — ถ้าปล่อยให้ Next parse ก่อน จะตรวจไม่ผ่าน
export const config = { api: { bodyParser: false } };

type LineEvent = {
  type: string;
  source?: { type?: string; groupId?: string };
};

async function readRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
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

  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) {
    console.warn('LINE webhook ถูกเรียกแต่ยังไม่ได้ตั้ง LINE_CHANNEL_SECRET');
    return res.status(503).end();
  }

  const raw = await readRawBody(req);
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
