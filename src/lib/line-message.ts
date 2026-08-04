import { thaiShortDate } from '@/lib/calendar-grid';
import type { CalendarJob } from '@/types/portal';

// ใช้ข้อความ text ธรรมดา ไม่ใช่ Flex — อ่านง่ายพอกันในกลุ่ม LINE แต่ไม่ต้อง
// ดูแลโครง JSON ก้อนใหญ่ และไม่พังเงียบ ๆ เมื่อสเปค Flex เปลี่ยน

const HEAD: Record<CalendarJob['kind'], string> = {
  ems: '🚑 รับ-ส่งผู้ป่วย',
  rescue: '🚨 งานป้องกัน',
};

/** ข้อความแจ้งกลุ่มเจ้าหน้าที่ตอนมีงานใหม่เข้ามารออนุมัติ */
export function formatNewJobMessage(job: CalendarJob): string {
  const lines = [
    '🔔 มีงานใหม่รออนุมัติ',
    `${HEAD[job.kind]} · ${thaiShortDate(job.date)} เวลา ${job.time}`,
    job.village ? `👤 ${job.title} (${job.village})` : `👤 ${job.title}`,
  ];

  // ฟิลด์ที่เว้นว่างถูกข้ามทั้งบรรทัด ไม่ทิ้งบรรทัดเปล่าไว้ในข้อความ
  if (job.origin || job.destination) {
    lines.push(`➤ ${job.origin || '-'} → ${job.destination || '-'}`);
  }
  if (job.phone) lines.push(`☎ ${job.phone}`);
  if (job.note) lines.push(`📝 ${job.note}`);

  return lines.join('\n');
}
