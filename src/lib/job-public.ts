import type { CalendarJob, JobStatus, PublicJob } from '@/types/portal';

// โมดูลนี้ตั้งใจไม่ import อะไรนอกจาก type — เทสต์จึงเรียกได้ตรง ๆ โดยไม่ลาก
// mongodb เข้ามาด้วย ซึ่งจะเกิดขึ้นถ้าฟังก์ชันนี้ไปอยู่ใน jobs-store.ts

// สถานะที่ยอมให้คนทั่วไปเห็น: งานที่ยังรออนุมัติหรือถูกยกเลิกไม่ขึ้นปฏิทินสาธารณะ
export const PUBLIC_JOB_STATUSES: readonly JobStatus[] = ['approved', 'done'];

/**
 * ตัดข้อมูลส่วนบุคคลออกก่อนส่งสู่สาธารณะ
 *
 * ประกอบ object ใหม่ทีละฟิลด์โดยเจตนา — ถ้าใช้ rest-spread หรือ delete
 * ฟิลด์ PII ที่เพิ่มเข้า CalendarJob ทีหลังจะรั่วออกไปเองโดยอัตโนมัติ
 * แบบนี้การเพิ่มฟิลด์สาธารณะต้องเป็นการตัดสินใจที่ตั้งใจเสมอ
 *
 * ฟังก์ชันนี้ไม่กรองสถานะ — feed สาธารณะต้องเรียกผ่าน toPublicJobs() เสมอ
 */
export function toPublicJob(job: CalendarJob): PublicJob {
  const out: PublicJob = {
    id: job.id,
    kind: job.kind,
    date: job.date,
    time: job.time,
    status: job.status,
  };
  if (job.village) out.village = job.village;
  return out;
}

export function toPublicJobs(jobs: CalendarJob[]): PublicJob[] {
  return jobs
    .filter((job) => PUBLIC_JOB_STATUSES.includes(job.status))
    .map(toPublicJob);
}
