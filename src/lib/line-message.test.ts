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
    expect(formatNewJobMessage(job).length).toBeLessThan(3000);
  });

  // job.date มาจาก CalendarJob ที่ควรผ่าน Zod มาแล้วเสมอในทางปกติ แต่ข้อมูลเสีย
  // จาก storage (อ่านตรงจาก Mongo โดยไม่ validate ซ้ำ) ก็ยังต้องไม่ทำให้การส่ง
  // แจ้งเตือนทั้งข้อความล้ม — ข้อความเพี้ยนได้แต่ต้องไม่ throw จนกลุ่มไม่ได้รับ
  // แจ้งเตือนอะไรเลย (เทียบกับ thaiShortDate's own guard ใน calendar-grid.test.ts)
  it('วันที่เพี้ยนจากข้อมูลที่ไม่ผ่าน Zod ไม่ทำให้ formatter throw', () => {
    expect(() => formatNewJobMessage({ ...BASE, date: '' })).not.toThrow();
    expect(
      typeof formatNewJobMessage({
        ...BASE,
        date: undefined as unknown as string,
      })
    ).toBe('string');
  });
});
