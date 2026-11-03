// src/lib/saraban-labels.ts
// ป้ายภาษาไทยของคีย์ในโดเมนสารบรรณ — client-safe ใช้ทั้งหน้าจอและข้อความใน event

import type {
  AnnotateRouteKind,
  DisplayStatus,
  SarabanEventKind,
  SarabanLevel,
  SarabanRegister,
  SendMethod,
} from '@/types/saraban';

export const REGISTER_LABELS: Record<SarabanRegister, string> = {
  in: 'ทะเบียนหนังสือรับ',
  out: 'ทะเบียนหนังสือส่ง',
  circular: 'ทะเบียนหนังสือเวียน',
};

export const LEVEL_LABELS: Record<SarabanLevel, string> = {
  normal: 'ปกติ',
  urgent: 'ด่วน',
  'very-urgent': 'ด่วนมาก',
  'most-urgent': 'ด่วนที่สุด',
};

// ข้อความเต็มประโยค เพราะใช้เป็น note ของ event "ส่งแล้ว" ตรง ๆ และตรงกับคอลัมน์
// "การปฏิบัติ" ของรายงานทะเบียนส่งในต้นแบบ
// ข้อความนี้ถูกเก็บถาวรใน note ของ event "ส่งแล้ว" — ใช้ศัพท์ของระเบียบงานสารบรรณ
// (พนักงานเดินหนังสือ) ไม่ใช่ภาษาพูด เพราะแก้ย้อนหลังในหนังสือที่บันทึกไปแล้วไม่ได้
export const SEND_METHOD_LABELS: Record<SendMethod, string> = {
  system: 'ส่งทางระบบสารบรรณอิเล็กทรอนิกส์',
  post: 'ส่งทางไปรษณีย์',
  hand: 'ส่งทางพนักงานเดินหนังสือ',
};

// ชื่อเหตุการณ์บนไทม์ไลน์ "เส้นทางหนังสือ" ของหน้า /saraban/track/[id] (สเปกข้อ 6)
export const EVENT_KIND_LABELS: Record<SarabanEventKind, string> = {
  received: 'ลงรับหนังสือ',
  issued: 'ออกเลขหนังสือ',
  edited: 'แก้ไขข้อมูล',
  'file-added': 'แนบไฟล์',
  'file-removed': 'ลบไฟล์แนบ',
  sent: 'ส่งหนังสือแล้ว',
  voided: 'ยกเลิกเลขทะเบียน',
  annotated: 'เกษียน/สั่งการ',
  acknowledged: 'รับทราบ (แจ้งเวียน)',
};

const IN_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอเกษียน',
  'in-progress': 'ดำเนินการ',
  done: 'เสร็จสิ้น',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

// ส่ง/เวียนเริ่มที่ in-progress เสมอและไม่มีกำหนดแล้วเสร็จ — 'pending' กับ 'overdue' ไม่เกิดจริง
// ใส่ไว้ให้ Record ครบ (ข้อมูลเสียจนเจอค่าเหล่านี้ก็ยังได้ป้ายที่อ่านรู้เรื่อง)
// จงใจเบี่ยงจากต้นแบบ — วงจรของหนังสือส่งคือ "ออกเลข → ส่ง" ป้ายควรบอกตรง ๆ (สเปกข้อ 3)
const OUTGOING_STATUS_LABELS: Record<DisplayStatus, string> = {
  pending: 'รอส่ง',
  'in-progress': 'รอส่ง',
  done: 'ส่งแล้ว',
  void: 'ยกเลิก',
  overdue: 'เกินกำหนด',
};

export function statusLabel(register: SarabanRegister, status: DisplayStatus): string {
  return (register === 'in' ? IN_STATUS_LABELS : OUTGOING_STATUS_LABELS)[status];
}

/**
 * ชื่อช่องที่แสดงในประวัติการแก้ไข — `field` มาจาก event ที่เก็บไว้ จึงเป็น string อิสระ
 * ใช้ Object.hasOwn ไม่ใช่ `labels[field] ?? field` เพราะ 'constructor' จะได้ฟังก์ชันของ
 * Object.prototype กลับมาแทน
 */
export function fieldLabel(register: SarabanRegister, field: string): string {
  const labels: Record<string, string> = {
    ref: 'ที่หนังสือ',
    docDate: 'ลงวันที่',
    party: register === 'in' ? 'จาก' : 'ถึง',
    subject: 'เรื่อง',
    level: 'ชั้นความเร็ว',
    dueDate: 'กำหนดแล้วเสร็จ',
    holderUnitId: register === 'in' ? 'เสนอถึง' : 'ส่วนราชการเจ้าของเรื่อง',
  };
  return Object.hasOwn(labels, field) ? labels[field] : field;
}

// แถบ 5 ขั้นของหน้าติดตาม (ต้นแบบจอ 6) — ลำดับตรงกับ flowStep() ใน saraban-flow.ts (ขั้น 1 = index 0)
export const FLOW_STEP_LABELS = ['ลงรับ', 'เสนอ/เกษียน', 'มอบหมาย', 'ดำเนินการ', 'จบเรื่อง'] as const;

export const ROUTE_LABELS: Record<AnnotateRouteKind, string> = {
  forward: 'ส่งต่อ',
  close: 'ส่งคืนสารบรรณ (จบเรื่อง)',
  stay: 'คงไว้ที่เดิม',
};

// ชิปข้อความสำเร็จรูปของฟอร์มเกษียน — ค่าคงที่ไปก่อน ยังไม่มีหน้าตั้งค่า (สเปกรอบ 2 ข้อ 1.8)
export const QUICK_NOTES = [
  'ทราบ',
  'ทราบ มอบดำเนินการ',
  'เพื่อโปรดพิจารณา',
  'ทราบ แจ้งเวียนให้ทราบ',
  'ทราบ เก็บเข้าแฟ้ม',
] as const;
