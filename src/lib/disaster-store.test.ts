import { describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import {
  buildIncidentFields,
  buildIncidentFilter,
  toIncidentItem,
  type IncidentDoc,
} from '@/lib/disaster-store';
import type { IncidentInput } from '@/lib/disaster-schema';

const OID = new ObjectId('64b7f0c2e1a2b3c4d5e6f700');

const doc = (over: Partial<IncidentDoc> = {}): IncidentDoc => ({
  _id: OID,
  disasterType: 'FLOOD',
  year: 2566,
  date: new Date('2023-08-14T00:00:00.000Z'),
  dateText: '14 ส.ค. 2566',
  method: 'สูบน้ำ',
  areaType: 'พื้นที่เกษตร',
  location: { type: 'Point', coordinates: [98.9, 18.7] },
  imageFile: 'flood.jpg',
  createdBy: 'user_secret123',
  createdAt: new Date('2023-08-15T00:00:00.000Z'),
  updatedAt: new Date('2023-08-16T00:00:00.000Z'),
  ...over,
});

const input = (over: Partial<IncidentInput> = {}): IncidentInput => ({
  disasterType: 'WILDFIRE',
  year: 2567,
  dateText: '3 มี.ค. 2567',
  method: '',
  areaType: '',
  lat: 18.68,
  lng: 98.86,
  imageFile: '',
  ...over,
});

describe('buildIncidentFilter', () => {
  it('ไม่ส่งอะไรมา = ไม่กรอง', () => {
    expect(buildIncidentFilter({})).toEqual({});
  });

  it('กรองตามประเภท', () => {
    expect(buildIncidentFilter({ type: 'FLOOD' })).toEqual({ disasterType: 'FLOOD' });
  });

  it('กรองตามปี — แปลงเป็นตัวเลข เพราะ query string เป็นข้อความเสมอ', () => {
    expect(buildIncidentFilter({ year: '2566' })).toEqual({ year: 2566 });
  });

  it('กรองพร้อมกันสองอย่าง', () => {
    expect(buildIncidentFilter({ type: 'DROUGHT', year: '2565' })).toEqual({
      disasterType: 'DROUGHT',
      year: 2565,
    });
  });

  it('ค่าว่างไม่นับเป็นตัวกรอง', () => {
    expect(buildIncidentFilter({ type: '', year: '' })).toEqual({});
  });

  // ตรึงพฤติกรรมเดิมของ namphrae-map ไว้ตามตรง: ปีที่ไม่ใช่ตัวเลขกลายเป็น NaN
  // ซึ่งไม่ match อะไรเลย = คืนรายการว่าง ไม่ใช่คืนทุกรายการ การ "แก้" ให้ข้ามตัวกรอง
  // ทิ้งจะแย่กว่า เพราะผู้ใช้ขอปีเจาะจงแล้วได้ข้อมูลทุกปีกลับไปโดยไม่รู้ตัว
  it('ปีที่ไม่ใช่ตัวเลขให้ NaN — กรองแล้วไม่เจออะไร ไม่ใช่เจอทุกอัน', () => {
    const f = buildIncidentFilter({ year: 'abc' }) as { year: number };
    expect(Number.isNaN(f.year)).toBe(true);
  });
});

describe('toIncidentItem', () => {
  it('แปลง _id และ date เป็นข้อความให้ตรงกับชนิด IncidentItem', () => {
    const item = toIncidentItem(doc());
    expect(item._id).toBe('64b7f0c2e1a2b3c4d5e6f700');
    expect(item.date).toBe('2023-08-14T00:00:00.000Z');
  });

  // เหตุผลอยู่ในหัวข้อ "สองการเปลี่ยนพฤติกรรมที่ตั้งใจ" ของแผน — endpoint สาธารณะ
  // ของต้นทางคืน createdBy ซึ่งเป็น Clerk user ID ของเจ้าหน้าที่ออกไปด้วย
  it('ไม่คืน createdBy / createdAt / updatedAt ออกไปเด็ดขาด', () => {
    // เช็คที่ "คีย์ไม่มีอยู่" ไม่ใช่ "ค่าเป็น undefined" — คีย์ที่มีอยู่แต่ค่าว่าง
    // ก็ผ่านแบบหลังได้ ทั้งที่มันหลุดออกไปกับ response จริง
    const item = toIncidentItem(doc());
    const keys = Object.keys(item);
    expect(keys).not.toContain('createdBy');
    expect(keys).not.toContain('createdAt');
    expect(keys).not.toContain('updatedAt');
    expect(JSON.stringify(item)).not.toContain('user_secret123');
  });

  it('คืนคีย์ครบตามที่หน้าเว็บใช้ ไม่ขาดไม่เกิน', () => {
    expect(Object.keys(toIncidentItem(doc())).sort()).toEqual([
      '_id', 'areaType', 'date', 'dateText', 'disasterType',
      'imageFile', 'location', 'method', 'year',
    ]);
  });

  it('พิกัดคงลำดับ [lng, lat] ไว้เหมือนเดิม', () => {
    expect(toIncidentItem(doc()).location.coordinates).toEqual([98.9, 18.7]);
  });

  it('ฟิลด์ที่ document เก่าไม่มี กลายเป็นค่าว่าง ไม่ใช่ undefined', () => {
    const bare = doc();
    delete (bare as Record<string, unknown>).method;
    delete (bare as Record<string, unknown>).areaType;
    delete (bare as Record<string, unknown>).imageFile;
    const item = toIncidentItem(bare);
    expect(item.method).toBe('');
    expect(item.areaType).toBe('');
    expect(item.imageFile).toBe('');
  });
});

describe('buildIncidentFields', () => {
  it('แปลง lat/lng เป็น GeoJSON Point ลำดับ [lng, lat]', () => {
    const f = buildIncidentFields(input({ lat: 18.68, lng: 98.86 }));
    expect(f.location).toEqual({ type: 'Point', coordinates: [98.86, 18.68] });
  });

  it('อ่านวันที่จากข้อความไทยได้', () => {
    const f = buildIncidentFields(input({ dateText: '3 มี.ค. 2567', year: 2567 }));
    expect(f.date.getUTCFullYear()).toBe(2024);
    expect(f.date.getUTCMonth()).toBe(2);
    expect(f.date.getUTCDate()).toBe(3);
  });

  // ตรงกับต้นทาง: parseThaiDate(dateText) ?? new Date(Date.UTC(year - 543, 0, 1))
  it('อ่านข้อความไม่ออกให้ถอยไปเป็น 1 ม.ค. ของปีนั้น ไม่ใช่ปล่อยว่าง', () => {
    const f = buildIncidentFields(input({ dateText: 'เมื่อวานซืน', year: 2566 }));
    expect(f.date.toISOString()).toBe('2023-01-01T00:00:00.000Z');
  });

  it('ไม่พา lat/lng ดิบติดไปกับ document', () => {
    const f = buildIncidentFields(input()) as Record<string, unknown>;
    expect(f.lat).toBeUndefined();
    expect(f.lng).toBeUndefined();
  });

  it('เก็บฟิลด์เนื้อหาไว้ครบ', () => {
    const f = buildIncidentFields(input({ method: 'ดับไฟ', areaType: 'ป่า', imageFile: 'a.jpg' }));
    expect(f.disasterType).toBe('WILDFIRE');
    expect(f.year).toBe(2567);
    expect(f.dateText).toBe('3 มี.ค. 2567');
    expect(f.method).toBe('ดับไฟ');
    expect(f.areaType).toBe('ป่า');
    expect(f.imageFile).toBe('a.jpg');
  });
});
