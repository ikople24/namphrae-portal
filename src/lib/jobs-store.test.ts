import { describe, expect, it } from 'vitest';
import {
  bySchedule,
  buildJobPatch,
  buildNewJob,
  JOB_EDITABLE_FIELDS,
  matches,
} from '@/lib/jobs-store';
import { jobInputSchema, type JobInput } from '@/lib/schema';
import type { CalendarJob } from '@/types/portal';

// เทสต์นี้ครอบเฉพาะ matches() และ bySchedule() — ฟังก์ชันบริสุทธิ์ล้วน ๆ
// ไม่แตะ DB/filesystem เลย จุดที่ต้องระวังคือ matches() พูดกฎกรองเดียวกับ
// query object ของ Mongo ใน listJobs() แต่เขียนแยกกันคนละที่ (ดูคอมเมนต์บน
// matches() ใน jobs-store.ts) เทสต์เหล่านี้ตรึงพฤติกรรมของ matches() ไว้เป็น
// สเปกอ้างอิง ถ้า query ฝั่ง Mongo เพี้ยนไปจากนี้ ต้องจับได้จากการรีวิวโค้ด
// ทั้งสองจุดคู่กัน เพราะเทสต์ mock DB จริงไม่ได้ (ห้ามใช้ test container)

function makeJob(overrides: Partial<CalendarJob> = {}): CalendarJob {
  return {
    id: 'job-1',
    kind: 'ems',
    status: 'pending',
    date: '2026-08-15',
    time: '09:00',
    title: 'ผู้ป่วยทดสอบ',
    createdAt: '2026-08-01T00:00:00.000Z',
    createdBy: 'tester@example.com',
    ...overrides,
  };
}

describe('matches', () => {
  it('filter ว่างเปล่า — ผ่านทุกงานไม่ว่าสถานะหรือวันที่ใด', () => {
    expect(matches(makeJob(), {})).toBe(true);
    expect(
      matches(makeJob({ status: 'cancelled', date: '2020-01-01' }), {})
    ).toBe(true);
  });

  describe('month filter', () => {
    it('วันแรกของเดือนตรงกับ filter เดือนนั้น', () => {
      const job = makeJob({ date: '2026-08-01' });
      expect(matches(job, { month: '2026-08' })).toBe(true);
    });

    it('วันสุดท้ายของเดือน (31) ตรงกับ filter เดือนนั้น', () => {
      const job = makeJob({ date: '2026-08-31' });
      expect(matches(job, { month: '2026-08' })).toBe(true);
    });

    it('วันแรกของเดือนถัดไปไม่ตรงกับ filter เดือนก่อนหน้า — กันความเพี้ยนข้ามเดือน', () => {
      const job = makeJob({ date: '2026-09-01' });
      expect(matches(job, { month: '2026-08' })).toBe(false);
    });

    it('เดือนเดียวกันแต่คนละปีไม่ตรงกัน', () => {
      const job = makeJob({ date: '2025-08-15' });
      expect(matches(job, { month: '2026-08' })).toBe(false);
    });
  });

  describe('status filter', () => {
    it('สถานะตรงกัน — ผ่าน', () => {
      const job = makeJob({ status: 'approved' });
      expect(matches(job, { status: 'approved' })).toBe(true);
    });

    it('สถานะไม่ตรงกัน — ไม่ผ่าน', () => {
      const job = makeJob({ status: 'approved' });
      expect(matches(job, { status: 'pending' })).toBe(false);
    });
  });

  describe('month + status ผสมกัน', () => {
    const job = makeJob({ date: '2026-08-15', status: 'approved' });

    it('ผ่านทั้งสองเงื่อนไข — ผ่าน', () => {
      expect(matches(job, { month: '2026-08', status: 'approved' })).toBe(
        true
      );
    });

    it('เดือนตรงแต่สถานะไม่ตรง — ไม่ผ่าน', () => {
      expect(matches(job, { month: '2026-08', status: 'pending' })).toBe(
        false
      );
    });

    it('สถานะตรงแต่เดือนไม่ตรง — ไม่ผ่าน', () => {
      expect(matches(job, { month: '2026-09', status: 'approved' })).toBe(
        false
      );
    });
  });
});

// bySchedule ต้องเป็น total order (date, time, createdAt, id) ไล่ครบทุกระดับ
// — ไม่ใช่แค่ date+time — เพราะ Mongo ไม่รับประกันลำดับของเอกสารที่ sort key
// เท่ากันเป๊ะ (และลำดับนั้นเปลี่ยนได้ระหว่างรัน query สองครั้ง) ในขณะที่
// Array.prototype.sort ของแบ็กเอนด์ไฟล์เสถียรมาตั้งแต่ ES2019 เทสต์ชุดนี้จึง
// ตั้งใจ "จับ" ค่า date/time/createdAt ให้ชนกันแล้วดูว่า id ตัดสินผลได้จริง
// แทนที่จะพึ่งลำดับที่ใส่เข้ามาใน array (ซึ่งเป็นพฤติกรรมที่ Mongo ให้ไม่ได้)
describe('bySchedule — total order ที่ทั้งแบ็กเอนด์ไฟล์และ Mongo ต้องให้ผลตรงกัน', () => {
  it('วันที่ต่างกัน — เรียงตามวันที่ก่อนเวลา', () => {
    const early = makeJob({ id: 'a', date: '2026-08-01', time: '23:00' });
    const late = makeJob({ id: 'b', date: '2026-08-02', time: '00:00' });
    expect(bySchedule(early, late)).toBeLessThan(0);
    expect(bySchedule(late, early)).toBeGreaterThan(0);
  });

  it('วันที่เดียวกัน — เรียงตามเวลา', () => {
    const morning = makeJob({ id: 'a', date: '2026-08-01', time: '08:00' });
    const evening = makeJob({ id: 'b', date: '2026-08-01', time: '18:00' });
    expect(bySchedule(morning, evening)).toBeLessThan(0);
    expect(bySchedule(evening, morning)).toBeGreaterThan(0);
  });

  it('วัน+เวลาเท่ากัน — เรียงตาม createdAt ต่อ ไม่ใช่ลำดับที่ใส่เข้ามา', () => {
    const older = makeJob({
      id: 'a',
      date: '2026-08-01',
      time: '06:00',
      createdAt: '2026-07-01T00:00:00.000Z',
    });
    const newer = makeJob({
      id: 'b',
      date: '2026-08-01',
      time: '06:00',
      createdAt: '2026-07-02T00:00:00.000Z',
    });
    // เรียก newer ก่อน older โดยตั้งใจ — ถ้าฟังก์ชันแอบพึ่งลำดับอาร์กิวเมนต์
    // หรือ Array.sort's stability แทนที่จะเทียบ createdAt เอง ผลจะกลับด้าน
    expect(bySchedule(newer, older)).toBeGreaterThan(0);
    expect(bySchedule(older, newer)).toBeLessThan(0);
  });

  it('วัน+เวลา+createdAt เท่ากันหมด — เรียงตาม id เป็นตัวตัดสินสุดท้าย', () => {
    const shared = {
      date: '2026-08-01',
      time: '06:00',
      createdAt: '2026-07-01T00:00:00.000Z',
    };
    const a = makeJob({ id: 'a', ...shared });
    const z = makeJob({ id: 'z', ...shared });
    expect(bySchedule(a, z)).toBeLessThan(0);
    expect(bySchedule(z, a)).toBeGreaterThan(0);
  });

  it('เรียง list ที่สลับลำดับแบบสมจริงได้ ascending ตาม total order แม้ date/time/createdAt ชนกันหมด', () => {
    const sameCreatedAt = '2026-08-01T00:00:00.000Z';
    const jobs = [
      makeJob({
        id: '5',
        date: '2026-08-20',
        time: '10:00',
        createdAt: sameCreatedAt,
      }),
      makeJob({
        id: 'z',
        date: '2026-08-05',
        time: '09:00',
        createdAt: sameCreatedAt,
      }),
      makeJob({
        id: '4',
        date: '2026-08-05',
        time: '23:30',
        createdAt: sameCreatedAt,
      }),
      // date/time/createdAt เหมือน 'z' ทุกตัว — id ต้องเป็นตัวตัดสินว่ามาก่อน
      makeJob({
        id: 'a',
        date: '2026-08-05',
        time: '09:00',
        createdAt: sameCreatedAt,
      }),
      makeJob({
        id: '3',
        date: '2026-08-05',
        time: '14:00',
        createdAt: sameCreatedAt,
      }),
      makeJob({
        id: '6',
        date: '2026-09-01',
        time: '00:00',
        createdAt: sameCreatedAt,
      }),
    ];
    const sorted = [...jobs].sort(bySchedule);
    expect(sorted.map((j) => j.id)).toEqual(['a', 'z', '3', '4', '5', '6']);
  });
});

// ---- รูปร่างเอกสาร: createJob (ผ่าน buildNewJob) กับ updateJob (ผ่าน --------
// buildJobPatch) ต้องเห็นตรงกันว่าฟิลด์ที่ไม่บังคับว่าง ('') ไม่ใช่ค่าที่ควร
// ตัดคีย์ทิ้ง — เดิม createJob ตัดคีย์ทิ้งด้วย conditional spread ขณะที่
// updateJob เขียนทุกคีย์เสมอ ทำให้งานที่ไม่เคยแก้กับงานที่แก้แล้วมีรูปร่าง
// เอกสารต่างกันทั้งที่ความหมายเดียวกัน (ดูคอมเมนต์บน buildNewJob ใน
// jobs-store.ts) ตอนนี้ทั้งสองทางเขียนคีย์ครบเสมอแล้ว เทสต์ชุดนี้ตรึงไว้
describe('รูปร่างเอกสาร: buildNewJob กับ buildJobPatch ต้องเขียนคีย์ชุดเดียวกัน', () => {
  const BLANK_INPUT: JobInput = {
    kind: 'ems',
    date: '2026-08-05',
    time: '06:00',
    title: 'ก',
    village: '',
    origin: '',
    destination: '',
    phone: '',
    note: '',
  };

  const FULL_INPUT: JobInput = {
    kind: 'rescue',
    date: '2026-08-06',
    time: '13:30',
    title: 'ข',
    village: 'ม.3 ต.น้ำแพร่',
    origin: 'บ้านที่อาศัย',
    destination: 'รพ.สวนดอก',
    phone: '0812345678',
    note: 'ใช้รถเข็น',
  };

  it('งานใหม่ที่เว้นฟิลด์ไม่บังคับว่าง ยังมีคีย์ครบ ไม่ตัดทิ้ง', () => {
    const job = buildNewJob(BLANK_INPUT, 'staff@example.com');
    const optionalKeys = [
      'village',
      'origin',
      'destination',
      'phone',
      'note',
    ] as const;
    for (const key of optionalKeys) {
      expect(key in job, key).toBe(true);
      expect(job[key]).toBe('');
    }
  });

  it('JOB_EDITABLE_FIELDS ตรงกับคีย์ที่ buildJobPatch เขียนจริงทุกตัว ไม่ขาดไม่เกิน', () => {
    const patchKeys = Object.keys(buildJobPatch(FULL_INPUT)).sort();
    expect(patchKeys).toEqual([...JOB_EDITABLE_FIELDS].sort());
  });

  // เทสต์ก่อนหน้าเทียบ JOB_EDITABLE_FIELDS กับ buildJobPatch เท่านั้น — สอง
  // จุดนั้นแก้พร้อมกันได้โดยที่เทสต์ยังเขียวสนิท (เช่นลบ 'note' ออกทั้งคู่)
  // แล้ว updateJob จะเลิกบันทึกฟิลด์ note เงียบ ๆ ทั้งที่ฟอร์มยังส่งมา ผูกไว้กับ
  // jobInputSchema ซึ่งเป็นแหล่งความจริงของฟิลด์ที่ฟอร์มส่งจริงแทน — วันนี้ทุก
  // คีย์ของ JobInput แก้ไขได้หมด (9 ตัวเท่ากัน) จึงต้องเท่ากันเป๊ะ
  it('JOB_EDITABLE_FIELDS ครอบทุกฟิลด์ที่ฟอร์มส่งมา — ลบพร้อมกันทั้งสองที่ก็ต้องแดง', () => {
    expect([...JOB_EDITABLE_FIELDS].sort()).toEqual(
      Object.keys(jobInputSchema.shape).sort()
    );
  });

  it('คีย์ที่ buildJobPatch เขียน ต้องเป็นชุดย่อยของคีย์ที่ buildNewJob สร้าง', () => {
    // ถ้าสองทางนี้ไม่ตรงกัน งานที่ผ่านการแก้จะมีรูปร่างต่างจากงานที่เพิ่งสร้าง
    const built = new Set(
      Object.keys(buildNewJob(FULL_INPUT, 'staff@example.com'))
    );
    for (const key of JOB_EDITABLE_FIELDS) {
      expect(built.has(key), key).toBe(true);
    }
  });

  it('buildJobPatch ไม่แตะสถานะหรือ audit trail', () => {
    const patch = buildJobPatch(FULL_INPUT) as Record<string, unknown>;
    const forbidden = [
      'status',
      'createdAt',
      'createdBy',
      'decidedAt',
      'decidedBy',
      'doneAt',
      'doneBy',
    ];
    for (const key of forbidden) {
      expect(key in patch, key).toBe(false);
    }
  });
});

// ---- สมมติฐานของ -31 upper bound ที่ query ฝั่ง Mongo ใน listJobs() พึ่งพา ----
//
// `query.date = { $gte: `${month}-01`, $lte: `${month}-31` }` ใช้ได้เพราะ
// สตริง 'YYYY-MM-DD' เทียบแบบ lexicographic แล้วให้ผลตรงกับการเทียบวันที่จริง
// ทุกเดือน (แม้เดือนนั้นมีแค่ 28/29/30 วัน) เทสต์นี้ตรึงสมมติฐานนั้นไว้
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate(); // month เป็น 1-indexed
}

describe('สมมติฐาน -31 upper bound (ที่ query ของ Mongo ใน listJobs พึ่งพา)', () => {
  // ครอบเดือน 31 วัน, 30 วัน, ก.พ.ปีปกติ (28 วัน) และ ก.พ.ปีอธิกสุรทิน (29 วัน)
  const months = ['2026-01', '2026-04', '2026-02', '2024-02'];

  it.each(months)(
    'ทุกวันจริงในเดือน %s อยู่ระหว่าง `${month}-01` ถึง `${month}-31` เมื่อเทียบแบบสตริง',
    (month) => {
      const [yearStr, monthStr] = month.split('-');
      const year = Number(yearStr);
      const mon = Number(monthStr);
      const lower = `${month}-01`;
      const upper = `${month}-31`;
      const total = daysInMonth(year, mon);

      for (let d = 1; d <= total; d++) {
        const date = `${month}-${String(d).padStart(2, '0')}`;
        expect(date >= lower).toBe(true);
        expect(date <= upper).toBe(true);
      }
    }
  );
});
