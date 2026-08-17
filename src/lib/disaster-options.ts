import type { DisasterType } from '@/lib/disaster-types';

// ตัวเลือกต่อประเภทภัย (จากข้อมูลจริงใน DB)
export const METHOD_OPTIONS: Record<DisasterType, string[]> = {
  WILDFIRE: ['ดับด้วยคน'],
  FLOOD: ['มอบถุงยังชีพ/ทำความสะอาด', 'ซ่อมแซมบ้าน'],
  LANDSLIDE: ['ไถดินที่ขวางทางถนน'],
  DROUGHT: ['เทศบาลบริการขนส่งน้ำ'],
};

// areaType: ไฟป่า/ดินโคลนถล่ม = หมวดพื้นที่; อุทกภัย/ภัยแล้ง = ที่อยู่ (ว่าง → ช่องพิมพ์)
export const AREA_TYPE_OPTIONS: Record<DisasterType, string[]> = {
  WILDFIRE: ['ป่าอนุรักษ์', 'ป่าสงวนแห่งชาติ'],
  LANDSLIDE: ['ถนนทางไป อช.ออบขาน (แม่ขนิลใต้)'],
  FLOOD: [],
  DROUGHT: [],
};

/** true when value is a non-empty custom entry not present in the option list. */
export function isCustomValue(value: string, options: string[]): boolean {
  return value !== '' && !options.includes(value);
}
