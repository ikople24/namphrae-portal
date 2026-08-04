import { thaiShortDate } from '@/lib/calendar-grid';
import { JOB_KIND_LABEL, type CalendarJob } from '@/types/portal';

// ใช้ข้อความ text ธรรมดา ไม่ใช่ Flex — อ่านง่ายพอกันในกลุ่ม LINE แต่ไม่ต้อง
// ดูแลโครง JSON ก้อนใหญ่ และไม่พังเงียบ ๆ เมื่อสเปค Flex เปลี่ยน
//
// import ค่า JOB_KIND_LABEL จาก types/portal.ts (ไม่ใช่แค่ type) เพราะ
// types/portal.ts เป็น dependency-free leaf เหมือนเดิม ไม่ได้ลาก mongodb หรือ
// I/O อะไรเข้ามา — สิ่งที่โมดูลนี้ต้องหลีกเลี่ยงคือ I/O ไม่ใช่การ import ค่า

// ไอคอนเท่านั้น — คำเรียกชนิดงานใช้ JOB_KIND_LABEL ตัวเดียวกับตารางแอดมิน ไม่
// ก็อปคำมาซ้ำ กันข้อความ LINE กับตารางแอดมินเพี้ยนกันเมื่อมีคนแก้ label
const KIND_EMOJI: Record<CalendarJob['kind'], string> = {
  ems: '🚑',
  rescue: '🚨',
};

/** ข้อความแจ้งกลุ่มเจ้าหน้าที่ตอนมีงานใหม่เข้ามารออนุมัติ
 *
 * @param adminUrl origin ของพอร์ทัล (เช่น NEXT_PUBLIC_SITE_URL) ใส่มาก็ต่อท้าย
 * ลิงก์ไปหน้าปฏิทินแอดมิน — ไม่ใส่ก็ไม่ขึ้นบรรทัดนี้ (ฟังก์ชันยังคง pure,
 * ไม่อ่าน env เอง; Task 7 เป็นคนส่ง process.env.NEXT_PUBLIC_SITE_URL เข้ามา)
 */
export function formatNewJobMessage(job: CalendarJob, adminUrl?: string): string {
  const lines = [
    '🔔 มีงานใหม่รออนุมัติ',
    // kind นอกตาราง JOB_KIND_LABEL (ข้อมูลเสียจาก storage ที่ไม่ผ่าน Zod) ยัง
    // ต้องขึ้นข้อความได้ ไม่ใช่ "undefined" — เทียบ JOB_STATUS_LABEL[status] ??
    // ... ของ Task 13 ที่กันปัญหาแบบเดียวกันไว้แล้ว
    `${KIND_EMOJI[job.kind] ?? '🔔'} ${JOB_KIND_LABEL[job.kind] ?? job.kind} · ${thaiShortDate(job.date)} เวลา ${job.time}`,
    job.village ? `👤 ${job.title} (${job.village})` : `👤 ${job.title}`,
  ];

  // ฟิลด์ที่เว้นว่างถูกข้ามทั้งบรรทัด ไม่ทิ้งบรรทัดเปล่าไว้ในข้อความ
  if (job.origin || job.destination) {
    lines.push(`➤ ${job.origin || '-'} → ${job.destination || '-'}`);
  }
  if (job.phone) lines.push(`☎ ${job.phone}`);
  if (job.note) lines.push(`📝 ${job.note}`);
  if (adminUrl) lines.push(`👉 ${adminUrl}/admin/calendar`);

  return lines.join('\n');
}
