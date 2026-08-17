// ชนิดข้อมูลรายงานจากชาวบ้าน — ยกจาก namphrae-map/lib/types.ts (ส่วนสาธารณสุข)
// ต้นทางคือ collection submittedreports ของระบบแจ้งเรื่อง LINE ไม่ใช่ของ portal
export interface DengueCase {
  _id: string;
  complaintId: string;
  community: string;
  status: string;
  date: string; // ISO (จาก createdAt)
  location: { lat: number; lng: number };
}
