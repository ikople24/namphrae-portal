import { describe, it, expect } from 'vitest';
import { incidentInputSchema } from '@/lib/disaster-schema';

const valid = {
  disasterType: 'WILDFIRE',
  year: 2564,
  dateText: '21 มกราคม 2564',
  method: 'ดับด้วยคน',
  areaType: 'ป่าสงวนแห่งชาติ',
  lat: 18.69838,
  lng: 98.84615,
  imageFile: 'A001.jpg',
};

describe('incidentInputSchema', () => {
  it('รับ input ที่ถูกต้อง', () => {
    expect(incidentInputSchema.safeParse(valid).success).toBe(true);
  });
  it('ปฏิเสธ disasterType นอก enum', () => {
    expect(incidentInputSchema.safeParse({ ...valid, disasterType: 'EARTHQUAKE' }).success).toBe(false);
  });
  it('ปฏิเสธ lat เกินช่วง', () => {
    expect(incidentInputSchema.safeParse({ ...valid, lat: 91 }).success).toBe(false);
  });
  it('เติมค่า default ให้ field ที่ไม่ส่งมา', () => {
    const r = incidentInputSchema.safeParse({
      disasterType: 'FLOOD', year: 2569, dateText: '1 ตุลาคม 2569', lat: 18.7, lng: 98.8,
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.method).toBe('');
  });
});
