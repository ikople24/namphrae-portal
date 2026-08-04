import type { JobStatus } from '@/types/portal';

// ตารางเดียวที่ตัดสินว่าเปลี่ยนสถานะไหนได้ ใช้ร่วมทั้ง API และปุ่มบนหน้าจอ
// (หน้าจอซ่อนปุ่มที่ทำไม่ได้ ส่วน API ปฏิเสธด้วย 409 ไม่ว่าอย่างไร)
//
// ที่ให้ย้อนกลับได้ เพราะงานจริงมีการกดพลาด: ถอนอนุมัติ, เปิดงานที่เผลอปิด,
// กู้งานที่ยกเลิกผิด — ไม่ใช่เพื่อความยืดหยุ่นลอย ๆ
const ALLOWED: Record<JobStatus, readonly JobStatus[]> = {
  pending: ['approved', 'cancelled'],
  approved: ['done', 'cancelled', 'pending'],
  done: ['approved'],
  cancelled: ['pending'],
};

// `from` มาจากข้อมูลที่อ่านจาก storage (Mongo/JSON) โดยไม่ผ่าน Zod validate
// เสมอไป — TypeScript รับประกันไม่ได้ว่าค่าจริงตอนรันจะอยู่ใน JobStatus จริง
// ๆ (แถวข้อมูลเสีย/แก้ DB มือ) ถ้าตกตาราง ให้ถือว่า "ไม่มีทางไปต่อ" แทนที่
// จะ throw — API จะได้ตอบ 409 ตามปกติ ส่วนหน้าจอแอดมินจะไม่ throw กลาง
// render จนตารางทั้งหน้าล่มเพราะแถวเดียว
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return (ALLOWED[from] ?? []).includes(to);
}

// สถานะที่กดต่อได้จากสถานะปัจจุบัน — ใช้วาดปุ่มในตารางหลังบ้าน
export function nextStatuses(from: JobStatus): readonly JobStatus[] {
  return ALLOWED[from] ?? [];
}
