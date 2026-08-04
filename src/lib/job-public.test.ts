import { describe, expect, it } from 'vitest';
import { toPublicJob, toPublicJobs } from '@/lib/job-public';
import type { CalendarJob, PublicJob } from '@/types/portal';

const FULL: CalendarJob = {
  id: 'job-1',
  kind: 'ems',
  status: 'approved',
  date: '2026-08-05',
  time: '06:00',
  title: 'สมชาย ใจดี',
  village: 'ม.3 ต.น้ำแพร่',
  origin: 'บ้านที่อาศัย',
  destination: 'รพ.สวนดอก',
  phone: '0812345678',
  note: 'ใช้รถเข็น',
  createdAt: '2026-08-04T11:00:00.000Z',
  createdBy: 'staff@example.com',
  decidedAt: '2026-08-04T12:00:00.000Z',
  decidedBy: 'staff@example.com',
};

describe('toPublicJob', () => {
  it('ส่งออกเฉพาะคีย์ที่อนุญาต ไม่มีคีย์อื่นเล็ดลอด', () => {
    expect(Object.keys(toPublicJob(FULL)).sort()).toEqual([
      'date',
      'id',
      'kind',
      'status',
      'time',
      'village',
    ]);
  });

  it('ไม่มีข้อมูลส่วนบุคคลติดไปแม้แต่ฟิลด์เดียว', () => {
    const pub = toPublicJob(FULL) as Record<string, unknown>;
    for (const key of ['title', 'phone', 'origin', 'destination', 'note']) {
      expect(pub[key], key).toBeUndefined();
    }
  });

  it('ค่าที่ยอมให้ผ่านต้องตรงกับต้นฉบับ', () => {
    expect(toPublicJob(FULL)).toEqual({
      id: 'job-1',
      kind: 'ems',
      status: 'approved',
      date: '2026-08-05',
      time: '06:00',
      village: 'ม.3 ต.น้ำแพร่',
    });
  });

  it('ไม่ใส่คีย์ village เมื่อไม่มีข้อมูล', () => {
    const { village: _village, ...noVillage } = FULL;
    expect('village' in toPublicJob(noVillage)).toBe(false);
  });

  it('ค่าที่ไม่ใช่ชื่อจริงก็ยังต้องไม่หลุด — สตริงว่างก็ถือว่าไม่มี', () => {
    expect('village' in toPublicJob({ ...FULL, village: '' })).toBe(false);
  });

  it('สถานะนอกตาราง (ข้อมูลเสียจาก storage ที่ไม่ผ่าน validate) ยังคง mask PII ตามปกติ ไม่ throw', () => {
    const bogus = { ...FULL, status: 'deferred' as CalendarJob['status'] };
    const pub = toPublicJob(bogus) as Record<string, unknown>;
    expect(pub.title).toBeUndefined();
    expect(pub.phone).toBeUndefined();
    expect(pub.status).toBe('deferred');
  });

  it('PublicJob กันการ spread ทั้งก้อนตั้งแต่ตอน compile', () => {
    // @ts-expect-error — CalendarJob ทั้งก้อนต้องไม่ assign เป็น PublicJob ได้
    const leak: PublicJob = { ...FULL };
    expect(leak.id).toBe('job-1');
  });
});

describe('toPublicJobs', () => {
  const make = (id: string, status: CalendarJob['status']): CalendarJob => ({
    ...FULL,
    id,
    status,
  });

  it('คัดเหลือเฉพาะ approved กับ done', () => {
    const out = toPublicJobs([
      make('a', 'pending'),
      make('b', 'approved'),
      make('c', 'done'),
      make('d', 'cancelled'),
    ]);
    expect(out.map((j) => j.id)).toEqual(['b', 'c']);
  });

  it('งานที่รออนุมัติไม่หลุดออกสู่สาธารณะ', () => {
    expect(toPublicJobs([make('a', 'pending')])).toEqual([]);
  });

  it('อาเรย์ว่างคืนอาเรย์ว่าง', () => {
    expect(toPublicJobs([])).toEqual([]);
  });

  it('สถานะนอกตาราง JOB_STATUSES (ข้อมูลเสียจาก Mongo ที่ยังไม่ผ่าน Zod — ดู Task 6) ต้องถูกกรองออก ไม่ใช่หลุดผ่านเป็นค่า default', () => {
    // ฟิลด์นี้อ่านจาก Mongo ตรง ๆ โดยไม่ validate (Task 6) ค่าที่ไม่รู้จักต้อง
    // ปฏิบัติแบบเดียวกับสถานะที่ปิดกั้น (pending/cancelled) คือไม่ขึ้นปฏิทิน
    // สาธารณะ — "ไม่รู้จัก" ต้องปลอดภัยไว้ก่อนเสมอ (fail closed)
    const bogus = make('x', 'deferred' as CalendarJob['status']);
    expect(toPublicJobs([bogus])).toEqual([]);
  });
});
