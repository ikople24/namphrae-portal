// สร้างไฟล์ Excel (pure; ใช้ใน API runtime)
import * as XLSX from 'xlsx';
import type { YearComparisonRow } from '@/lib/health-registry-stats';

/** สถิติสาธารณะ: ชีตรายปี + รายหมู่ (ไม่มี PII) */
export function statsWorkbookBuffer(
  yearRows: YearComparisonRow[],
  mooRows: { moo: number; count: number }[]
): Buffer {
  const wb = XLSX.utils.book_new();
  const yearAoa: unknown[][] = [
    ['ปี (พ.ศ.)', 'เคสรวม', 'ไทย', 'ต่างด้าว', 'ประชากร', 'อัตราป่วยไทย/แสน', 'มัธยฐานอัตรา 5 ปี'],
    ...yearRows.map((r) => [r.yearBE, r.total, r.thai ?? '', r.foreign ?? '', r.population ?? '', r.ratePer100kThai ?? '', r.medianRatePrev5 ?? '']),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(yearAoa), 'รายปี');
  const mooAoa: unknown[][] = [['หมู่', 'จำนวนเคส'], ...mooRows.map((r) => [r.moo, r.count])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(mooAoa), 'รายหมู่');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export interface RegistryExportRow {
  yearBE: number; seq: number; fullName: string; ageYears: number | null; address: string;
  moo: number | null; onsetDate: string | null; treatDate: string | null; notifyDate: string | null;
  diagnosis: string; careType: string; hospital: string; note: string;
}

/** ทะเบียนเต็ม (รวม PII) — สำหรับ export หลังบ้านเท่านั้น */
export function registryWorkbookBuffer(rows: RegistryExportRow[]): Buffer {
  const wb = XLSX.utils.book_new();
  const aoa: unknown[][] = [
    ['ปี', 'ลำดับ', 'ชื่อ-สกุล', 'อายุ', 'ที่อยู่', 'หมู่', 'เริ่มป่วย', 'รักษา', 'รับแจ้ง', 'วินิจฉัย', 'ประเภท', 'รพ.', 'หมายเหตุ'],
    ...rows.map((r) => [r.yearBE, r.seq, r.fullName, r.ageYears ?? '', r.address, r.moo ?? '', r.onsetDate ?? '', r.treatDate ?? '', r.notifyDate ?? '', r.diagnosis, r.careType, r.hospital, r.note]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'ทะเบียน');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
