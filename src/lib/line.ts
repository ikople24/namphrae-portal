import { getConfig, mutateConfig } from '@/lib/config-store';

// ฝั่ง I/O ของ LINE — แยกจาก line-message.ts / line-signature.ts เพราะไฟล์นี้
// import config-store ซึ่งลาก mongodb ตามมา ทำให้เทสต์ตรง ๆ ไม่ได้
//
// LINE Notify ปิดบริการไปแล้ว (31 มี.ค. 2025) จึงใช้ Messaging API อย่างเดียว

const PUSH_URL = 'https://api.line.me/v2/bot/message/push';

// สองความพร้อมนี้เป็นคนละเรื่องกัน ใช้คนละ env var: ส่งแจ้งเตือน (push) ใช้แค่
// LINE_CHANNEL_ACCESS_TOKEN (ดู pushGroupText ด้านล่าง) ส่วนรับ event จาก
// LINE (webhook เก็บ groupId ตอนบอทเข้ากลุ่ม) ใช้แค่ LINE_CHANNEL_SECRET ตรวจ
// ลายเซ็น (ดู src/pages/api/line/webhook.ts) ตั้งแค่ token อย่างเดียวก็ยิง
// แจ้งเตือนได้จริง แต่ webhook จะ 503 ตลอด — เดิม isLineConfigured() เดียว
// ต้องมีครบทั้งคู่ ทำให้กรณีนี้ขึ้น "ยังไม่ได้ตั้งค่า" ทั้งที่แจ้งเตือนออกจริง
// (ดู M-1 ในรีวิวรอบสุดท้ายก่อน merge) — แยกให้ /admin/settings บอกแต่ละครึ่ง
export function isLinePushConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

export function isLineWebhookConfigured(): boolean {
  return Boolean(process.env.LINE_CHANNEL_SECRET);
}

export function isLineConfigured(): boolean {
  return isLinePushConfigured() && isLineWebhookConfigured();
}

/** กลุ่มที่บอทถูกเชิญเข้าไป — webhook เป็นคนเก็บค่านี้ให้ตอน event `join` */
export async function getLineGroupId(): Promise<string | undefined> {
  return (await getConfig()).lineGroupId || undefined;
}

export async function setLineGroupId(
  groupId: string | undefined,
  actor: string
): Promise<void> {
  await mutateConfig((draft) => {
    draft.lineGroupId = groupId;
  }, actor);
}

/**
 * ส่งข้อความ text เข้ากลุ่มเจ้าหน้าที่ — best effort ไม่โยน error ออกไป
 *
 * ทางส่งข้อความเดียวของระบบ ใช้กับสรุปประจำวัน (/api/cron/daily-digest) และ
 * ข้อความทดสอบจาก /admin/settings — token/groupId/timeout อยู่ที่นี่ที่เดียว
 *
 * จงใจไม่มีแจ้งเตือนรายงานใหม่ (เคยมี — ถอดออกเพราะกินโควตาข้อความรายเดือน
 * ของ LINE OA เร็วเกินไป เหลือสรุปประจำวันช่องทางเดียว)
 *
 * @returns true เมื่อข้อความออกไปจริง
 */
export async function pushGroupText(text: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn('LINE push ข้าม: ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN');
    return false;
  }

  let to: string | undefined;
  try {
    to = await getLineGroupId();
  } catch (err) {
    console.warn('LINE push ข้าม: อ่าน config ไม่ได้', err);
    return false;
  }
  if (!to) {
    console.warn('LINE push ข้าม: ยังไม่มี groupId — เชิญบอท OA เข้ากลุ่มก่อน');
    return false;
  }

  try {
    const res = await fetch(PUSH_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      // ไม่มีใครควรนั่งรอผลของ noti — ตั้ง timeout สั้น ๆ กัน LINE ค้างแล้วลาก
      // request ของผู้เรียก (cron / หน้า settings) ให้ค้างตาม
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    });
    if (!res.ok) {
      console.warn(`LINE push ล้มเหลว: ${res.status} ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('LINE push ล้มเหลว', err);
    return false;
  }
}
