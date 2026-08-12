import { thaiShortDate } from '@/lib/calendar-grid';
import type { CalendarJob } from '@/types/portal';

// ใช้ข้อความ text ธรรมดา ไม่ใช่ Flex — อ่านง่ายพอกันในกลุ่ม LINE แต่ไม่ต้อง
// ดูแลโครง JSON ก้อนใหญ่ และไม่พังเงียบ ๆ เมื่อสเปค Flex เปลี่ยน
//
// เคยมี formatNewJobMessage แจ้งรายงานใหม่ด้วย — ถอดออกเพราะกินโควตาข้อความ
// รายเดือนของ LINE OA เร็วเกินไป เหลือสรุปประจำวันช่องทางเดียว

// ไอคอนบอกชนิดงานหน้าบล็อก — kind นอกสัญญา (ข้อมูลเสียจาก storage ที่ไม่ผ่าน
// Zod) ได้ 🔔 กลาง ๆ แทน ไม่ใช่ "undefined"
const KIND_EMOJI: Record<CalendarJob['kind'], string> = {
  ems: '🚑',
  rescue: '🚨',
};

// เพดานข้อความ text ของ LINE Messaging API — เกินแล้ว push ทั้งก้อนโดน 400
const LINE_TEXT_LIMIT = 5000;

/** งานหนึ่งงานในสรุปประจำวัน = บล็อกหลายบรรทัด ไม่ใช่บรรทัดเดียวย่อ ๆ
 *
 * เจ้าหน้าที่ในกลุ่มต้องโทรหาคนไข้และรู้เส้นทางได้จากข้อความเลย — ย่อเหลือ
 * บรรทัดเดียวแล้วทุกคนต้องเปิดพอร์ทัลต่อ ซึ่งเสียเวลากว่าข้อความยาวขึ้นหน่อย
 * ฟิลด์ที่เว้นว่าง (หรือหายไปเพราะข้อมูลไม่ผ่าน Zod) ข้ามทั้งบรรทัด — ไม่ทิ้ง
 * บรรทัดเปล่าหรือ "undefined" ไว้ในบล็อก
 */
function digestJobBlock(job: CalendarJob): string {
  const lines = [`${KIND_EMOJI[job.kind] ?? '🔔'} ${job.title}`];

  if (job.time) lines.push(`🕐 เวลา: ${job.time} น.`);
  if (job.village) lines.push(`🏠 ${job.village}`);
  if (job.origin || job.destination) {
    lines.push(`➤ ${job.origin || '-'} → ${job.destination || '-'}`);
  }
  if (job.phone) lines.push(`☎ ${job.phone}`);
  if (job.note) lines.push(`📝 ${job.note}`);

  return lines.join('\n');
}

/** สรุปตารางงานพรุ่งนี้ ส่งเข้ากลุ่มทุก 17:00 (ดู /api/cron/daily-digest)
 *
 * งานรออนุมัติจงใจไม่อยู่ในนี้ — กลุ่ม LINE เป็นของเจ้าหน้าที่หน้างานที่ต้องรู้
 * ว่าพรุ่งนี้ต้องไปไหนบ้าง ไม่ใช่ที่ทวงงานค้างของแอดมิน การทวงย้ายไปอยู่ที่หน้า
 * จอหลังบ้านแทน (badge ข้าง "ปฏิทินปฏิบัติงาน" ใน AdminLayout)
 *
 * @param jobs งานของวันนั้นที่ผู้เรียกกรองสถานะมาแล้ว (ดู /api/cron/daily-digest)
 * เรียงลำดับแล้ว (listJobs เรียง (date, time, createdAt, id) มาให้อยู่แล้ว) —
 * ฟังก์ชันนี้ไม่กรอง/ไม่ sort
 * @param adminUrl origin ของพอร์ทัล — ใช้เฉพาะบรรทัดปิดตอนข้อความยาวเกินเพดาน
 * จนต้องตัดงานท้าย ๆ ออก ไม่ใส่ก็ไม่มีลิงก์ (ฟังก์ชันยังคง pure ไม่อ่าน env เอง)
 */
export function formatDailyDigestMessage(
  jobs: CalendarJob[],
  dateISO: string,
  adminUrl?: string
): string {
  const dateLabel = thaiShortDate(dateISO);
  // ส่งทุกวันแม้วันว่าง — เงียบ = ผิดปกติ ไม่ใช่ไม่มีงาน (ตัดสินใจใน spec)
  if (jobs.length === 0) return `📋 พรุ่งนี้ (${dateLabel}) ไม่มีงานในตาราง`;

  // ประกอบจากงาน count รายการแรก — ถ้ายาวเกินเพดาน ตัดงานท้าย ๆ ออกทีละงาน
  // แล้วปิดด้วยบรรทัด "…และอีก N งาน" แทนการปล่อยให้ LINE ปฏิเสธทั้งข้อความ
  const build = (count: number): string => {
    // ไม่แบ่งส่วนตามสถานะ — ผู้เรียกกรองมาแล้ว งานที่หลุดเข้ามานอกสัญญายังขึ้น
    // เป็นบล็อกปกติ ไม่ถูกกรองทิ้งเงียบ ๆ (แนวเดียวกับ fallback 🔔 ของ kind
    // เสีย: ข้อมูลนอกสัญญาต้อง "เห็นได้" ไม่ใช่ "หายเงียบ")
    //
    // ทุกบล็อกคั่นด้วยบรรทัดว่างเสมอ (join '\n\n' ทีเดียวตอนท้าย) — งานหนึ่ง
    // งานกินหลายบรรทัดแล้ว ถ้าไม่คั่นจะอ่านไม่ออกว่าบรรทัดไหนของใคร
    const sections: string[] = [
      `📋 ตารางงานพรุ่งนี้ — ${dateLabel}`,
      ...jobs.slice(0, count).map(digestJobBlock),
    ];
    if (count < jobs.length) {
      const rest = jobs.length - count;
      sections.push(
        adminUrl
          ? `…และอีก ${rest} งาน ดูทั้งหมดที่ ${adminUrl}/admin/calendar`
          : `…และอีก ${rest} งาน`
      );
    }
    return sections.join('\n\n');
  };

  // บล็อกข้อมูลเต็มกินพื้นที่ราว 5 เท่าของรูปแบบบรรทัดเดียวเดิม เพดาน 5,000
  // ตัวอักษรจึงเต็มที่งานราว 30–40 งานต่อวัน (เดิมหลายร้อย) — ยังห่างจากสเกล
  // จริงของเทศบาลมาก และเกินเมื่อไรก็ตัดท้ายพร้อมลิงก์ไปดูส่วนที่เหลือ
  for (let count = jobs.length; count > 1; count--) {
    const msg = build(count);
    if (msg.length <= LINE_TEXT_LIMIT) return msg;
  }
  // เหลืองานเดียวก็ยังเกินได้ในทางทฤษฎี (title ยาวผิดปกติ) — ยอมส่งตามนั้น
  // ให้ pushGroupText รายงาน 400 ใน log ดีกว่าเงียบหาย
  return build(1);
}
