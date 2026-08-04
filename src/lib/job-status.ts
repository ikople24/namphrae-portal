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

export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return ALLOWED[from].includes(to);
}

// สถานะที่กดต่อได้จากสถานะปัจจุบัน — ใช้วาดปุ่มในตารางหลังบ้าน
export function nextStatuses(from: JobStatus): readonly JobStatus[] {
  return ALLOWED[from];
}
