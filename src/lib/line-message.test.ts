import { describe, expect, it } from 'vitest';
import { formatNewJobMessage } from '@/lib/line-message';
import { jobInputSchema } from '@/lib/schema';
import type { CalendarJob } from '@/types/portal';

const BASE: CalendarJob = {
  id: 'job-1',
  kind: 'ems',
  status: 'pending',
  date: '2026-08-05',
  time: '06:00',
  title: 'สมชาย ใจดี',
  village: 'ม.3 ต.น้ำแพร่',
  origin: 'บ้านที่อาศัย',
  destination: 'รพ.สวนดอก',
  phone: '0812345678',
  createdAt: '2026-08-04T11:00:00.000Z',
  createdBy: 'staff@example.com',
};

describe('formatNewJobMessage', () => {
  it('งานกู้ชีพที่กรอกครบ', () => {
    expect(formatNewJobMessage(BASE)).toBe(
      [
        '🔔 มีงานใหม่รออนุมัติ',
        '🚑 รับ-ส่งผู้ป่วย · 5 ส.ค. 69 เวลา 06:00',
        '👤 สมชาย ใจดี (ม.3 ต.น้ำแพร่)',
        '➤ บ้านที่อาศัย → รพ.สวนดอก',
        '☎ 0812345678',
      ].join('\n')
    );
  });

  it('งานกู้ภัยที่เว้นฟิลด์ว่าง — ไม่มีบรรทัดเปล่าและใช้ไอคอนคนละตัว', () => {
    const msg = formatNewJobMessage({
      ...BASE,
      kind: 'rescue',
      title: 'ตัดต้นไม้ล้มขวางถนน',
      origin: '',
      destination: '',
      phone: '',
    });
    expect(msg).toBe(
      [
        '🔔 มีงานใหม่รออนุมัติ',
        '🚨 งานป้องกัน · 5 ส.ค. 69 เวลา 06:00',
        '👤 ตัดต้นไม้ล้มขวางถนน (ม.3 ต.น้ำแพร่)',
      ].join('\n')
    );
    expect(msg.split('\n').every((line) => line.trim().length > 0)).toBe(true);
  });

  it('ไม่มีหมู่บ้านก็ไม่ขึ้นวงเล็บว่าง', () => {
    const msg = formatNewJobMessage({ ...BASE, village: '' });
    expect(msg).toContain('👤 สมชาย ใจดี\n');
    expect(msg).not.toContain('()');
  });

  it('ต้นทางหรือปลายทางมีอย่างเดียวก็ยังขึ้นบรรทัดเส้นทาง', () => {
    expect(formatNewJobMessage({ ...BASE, origin: '' })).toContain(
      '➤ - → รพ.สวนดอก'
    );
  });

  it('หมายเหตุขึ้นบรรทัดสุดท้ายเมื่อมี', () => {
    expect(formatNewJobMessage({ ...BASE, note: 'ใช้รถเข็น' })).toContain(
      '\n📝 ใช้รถเข็น'
    );
  });

  // ผูก schema กับ formatter เข้าด้วยกัน: origin ที่เป็นช่องว่างล้วนต้องถูก
  // .trim() ทิ้งตั้งแต่ jobInputSchema (ไม่ใช่กรองที่ formatter) ค่าที่เก็บ
  // ลง storage และขึ้นตารางแอดมินจึงเป็นสตริงว่างจริง ๆ ไม่ใช่ '   ' ที่ truthy
  // — ถ้าใครถอด .trim() ออกจาก schema ทีหลัง เทสต์นี้ต้องแดง
  it('origin ที่เป็นช่องว่างล้วนถูกตัดตั้งแต่ schema — formatter จึงไม่ขึ้นบรรทัดเส้นทางที่เป็นขยะ', () => {
    const parsed = jobInputSchema.parse({
      kind: 'ems',
      date: '2026-08-05',
      time: '06:00',
      title: 'สมชาย ใจดี',
      origin: '   ',
      destination: '',
    });
    const job: CalendarJob = {
      id: 'job-1',
      status: 'pending',
      createdAt: '2026-08-04T11:00:00.000Z',
      createdBy: 'staff@example.com',
      ...parsed,
    };
    expect(formatNewJobMessage(job)).not.toContain('➤');
  });

  // LINE จำกัดข้อความ push ที่ 5000 ตัวอักษร; schema จำกัด title/village/
  // origin/destination ที่ 200, phone ที่ 30, note ที่ 1000 — ทุกฟิลด์ยาวสุด
  // พร้อมกันต้องยังห่างจากเพดานของ LINE มากพอ ไม่ใช่แค่ "ไม่เกิน" พอดี ๆ
  it('ทุกฟิลด์ยาวสุดตามสคีมาพร้อมกัน ข้อความรวมยังห่างจากเพดาน 5000 ตัวอักษรของ LINE มาก', () => {
    const job: CalendarJob = {
      ...BASE,
      title: 'ก'.repeat(200),
      village: 'ข'.repeat(200),
      origin: 'ค'.repeat(200),
      destination: 'ง'.repeat(200),
      phone: '1'.repeat(30),
      note: 'จ'.repeat(1000),
    };
    const msg = formatNewJobMessage(job); // ไม่ใส่ adminUrl — วัดโครงพื้นฐาน
    // โครงข้อความตอนไม่มี adminUrl มี 6 บรรทัดตายตัวเสมอ: หัว + ชนิด/เวลา +
    // ชื่อ + เส้นทาง + โทร + หมายเหตุ — เช็คจำนวนบรรทัดจับบั๊กที่ความยาวรวม
    // เฉย ๆ จับไม่ได้ เช่น push บรรทัด note ซ้ำสองครั้ง (ยาวขึ้นแต่ยังไม่ชน
    // เพดาน 3000 ที่ตั้งไว้กว้าง ๆ ด้านล่าง)
    expect(msg.split('\n')).toHaveLength(6);
    expect(msg.length).toBeLessThan(3000); // เพดานจริงของ LINE คือ 5000
  });

  // เทสต์ข้างบนเข้ารหัสตัวเลข 200/200/200/200/30/1000 ไว้ตรง ๆ ซึ่งจะไม่รู้ตัว
  // เลยถ้ามีคนขยับ .max() ใน jobInputSchema ในอนาคต (schema แก้ แต่เทสต์ข้อความ
  // ยังใช้ตัวเลขเดิม ข้อความจริงจึงยาวกว่าที่เทสต์คำนวณไว้แบบเงียบ ๆ) ปักหมุด
  // เพดานจาก schema ตรง ๆ ในเทสต์แยกนี้แทน — ถ้า .max() เปลี่ยน เทสต์นี้ต้อง
  // แดงก่อน เตือนให้ไปปรับตัวเลขในเทสต์ข้อความด้านบนตามด้วย (ไม่อ่านค่ากลับ
  // จาก .max() ผ่าน .optional().default() ตรง ๆ เพราะยุ่งยากใน zod 4)
  it('เพดานความยาวฟิลด์ที่ใช้คำนวณเทสต์ข้อความด้านบนปักหมุดจาก schema โดยตรง', () => {
    const ok = {
      kind: 'ems' as const,
      date: '2026-08-05',
      time: '06:00',
      title: 'ก'.repeat(200),
      village: 'ข'.repeat(200),
      origin: 'ค'.repeat(200),
      destination: 'ง'.repeat(200),
      phone: '1'.repeat(30),
      note: 'จ'.repeat(1000),
    };
    expect(jobInputSchema.safeParse(ok).success).toBe(true);
    expect(
      jobInputSchema.safeParse({ ...ok, title: 'ก'.repeat(201) }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...ok, village: 'ข'.repeat(201) }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...ok, origin: 'ค'.repeat(201) }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...ok, destination: 'ง'.repeat(201) })
        .success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...ok, phone: '1'.repeat(31) }).success
    ).toBe(false);
    expect(
      jobInputSchema.safeParse({ ...ok, note: 'จ'.repeat(1001) }).success
    ).toBe(false);
  });

  // ข้อมูลเสียจาก storage ที่ไม่ผ่าน Zod (kind นอกตาราง / date, time หายไป)
  // ต้องไม่ทำให้ formatter throw จนกลุ่มไม่ได้รับแจ้งเตือนอะไรเลย ข้อความ
  // เพี้ยนได้แต่ต้องไม่ throw — เทียบกับ thaiShortDate's own guard ใน
  // calendar-grid.test.ts และ JOB_STATUS_LABEL[status] ?? ... ของ Task 13
  // ที่กัน "undefined" โผล่ในข้อความ/ตารางแบบเดียวกัน
  it('kind/วันที่/เวลาเพี้ยนจากข้อมูลที่ไม่ผ่าน Zod ไม่ทำให้ formatter throw หรือขึ้น undefined', () => {
    expect(() => formatNewJobMessage({ ...BASE, date: '' })).not.toThrow();
    expect(
      typeof formatNewJobMessage({
        ...BASE,
        date: undefined as unknown as string,
      })
    ).toBe('string');
    expect(() =>
      formatNewJobMessage({ ...BASE, time: undefined as unknown as string })
    ).not.toThrow();

    const bogusKind = formatNewJobMessage({
      ...BASE,
      kind: 'triage' as CalendarJob['kind'],
    });
    expect(bogusKind).not.toContain('undefined');
    expect(bogusKind).toContain('🔔 triage');
  });

  it('มี adminUrl ต่อท้ายด้วยลิงก์ไปหน้าปฏิทินแอดมิน', () => {
    const msg = formatNewJobMessage(BASE, 'https://portal.example.com');
    expect(msg).toContain('\n👉 https://portal.example.com/admin/calendar');
    expect(msg.split('\n')).toHaveLength(6); // BASE เดิม 5 บรรทัด + ลิงก์ 1
  });

  it('ไม่มี adminUrl ก็ไม่ขึ้นบรรทัดลิงก์ — graceful degradation แบบเดียวกับ Cloudinary', () => {
    expect(formatNewJobMessage(BASE)).not.toContain('👉');
  });
});
