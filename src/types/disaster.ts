// ชนิดข้อมูลเหตุสาธารณภัย — ยกจาก namphrae-map/lib/types.ts (ส่วนภัยพิบัติ)
import type { DisasterType } from '@/lib/disaster-types';

export interface IncidentItem {
  _id: string;
  disasterType: DisasterType;
  year: number;
  date: string;
  dateText: string;
  method: string;
  areaType: string;
  location: { type: 'Point'; coordinates: [number, number] }; // [lng, lat]
  imageFile: string;
}

export interface YearStat { year: number; disasterType: DisasterType; count: number }
