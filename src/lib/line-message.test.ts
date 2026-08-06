import { describe, expect, it } from 'vitest';
import { formatDailyDigestMessage, formatNewJobMessage } from '@/lib/line-message';
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

describe('formatDailyDigestMessage', () => {
  const APPROVED: CalendarJob = { ...BASE, id: 'a1', status: 'approved' };

  // แต่ละงานเป็น "บล็อก" ข้อมูลเต็ม (ชื่อ/เวลา/หมู่บ้าน/เส้นทาง/โทร/หมายเหตุ)
  // ไม่ใช่บรรทัดเดียวย่อ ๆ — เจ้าหน้าที่ในกลุ่มต้องโทรหาคนไข้และรู้เส้นทางได้
  // จากข้อความเลย ไม่ต้องเปิดพอร์ทัลก่อน (เทียบรูปแบบเดิมของระบบ Google
  // Calendar ที่ใช้อยู่ก่อนหน้า) — บล็อกคั่นด้วยบรรทัดว่างให้อ่านง่ายในกลุ่ม
  it('งานที่อนุมัติแล้ว — บล็อกข้อมูลเต็มของแต่ละงาน ไม่มีส่วนรออนุมัติและไม่มีลิงก์', () => {
    const jobs: CalendarJob[] = [
      {
        ...APPROVED,
        time: '06:00',
        title: 'ศรีพลอย ดวงแก้ว',
        phone: '0817169397',
      },
      {
        ...APPROVED,
        id: 'a2',
        kind: 'rescue',
        time: '14:00',
        title: 'ตัดต้นไม้ล้ม',
        village: 'ม.5 ต.น้ำแพร่',
        origin: '',
        destination: '',
        phone: '',
      },
    ];
    expect(
      formatDailyDigestMessage(jobs, '2026-08-06', 'https://namphrae-portal.app')
    ).toBe(
      [
        '📋 ตารางงานพรุ่งนี้ — 6 ส.ค. 69',
        '',
        '🚑 ศรีพลอย ดวงแก้ว',
        '🕐 เวลา: 06:00 น.',
        '🏠 ม.3 ต.น้ำแพร่',
        '➤ บ้านที่อาศัย → รพ.สวนดอก',
        '☎ 0817169397',
        '',
        '🚨 ตัดต้นไม้ล้ม',
        '🕐 เวลา: 14:00 น.',
        '🏠 ม.5 ต.น้ำแพร่',
      ].join('\n')
    );
  });

  it('หมายเหตุขึ้นท้ายบล็อกเมื่อมี', () => {
    expect(
      formatDailyDigestMessage([{ ...APPROVED, note: 'ใช้รถเข็น' }], '2026-08-06')
    ).toContain('\n📝 ใช้รถเข็น');
  });

  // ฟิลด์ที่เว้นว่างถูกข้ามทั้งบรรทัด — บล็อกยาวขึ้นแล้วยิ่งต้องไม่มีบรรทัด
  // ขยะอย่าง "☎" ลอย ๆ หรือ "🕐 เวลา: undefined น." จากข้อมูลที่ไม่ผ่าน Zod
  it('ฟิลด์ว่าง/เวลาหายจากข้อมูลเสีย — ข้ามทั้งบรรทัด ไม่มีบรรทัดเปล่าในบล็อกและไม่มี undefined', () => {
    const msg = formatDailyDigestMessage(
      [
        {
          ...APPROVED,
          village: '',
          origin: '',
          destination: '',
          phone: '',
          time: undefined as unknown as string,
        },
      ],
      '2026-08-06'
    );
    expect(msg).not.toContain('undefined');
    expect(msg).toBe(['📋 ตารางงานพรุ่งนี้ — 6 ส.ค. 69', '', '🚑 สมชาย ใจดี'].join('\n'));
  });

  it('วันว่าง — ข้อความบรรทัดเดียว', () => {
    expect(formatDailyDigestMessage([], '2026-08-06')).toBe(
      '📋 พรุ่งนี้ (6 ส.ค. 69) ไม่มีงานในตาราง'
    );
  });

  // งานรออนุมัติไม่ถูกเตือนทางกลุ่ม LINE อีกต่อไป (เตือนที่หน้าจอแอดมินแทน —
  // ดู badge ข้าง "ปฏิทินปฏิบัติงาน" ใน AdminLayout) หน้าที่กรองสถานะจึงย้าย
  // ไปอยู่ที่ผู้เรียกทั้งหมด formatter ไม่แบ่งส่วนตามสถานะแล้ว — งานที่ผู้เรียก
  // ลืมกรองยังขึ้นเป็นบล็อกปกติ ไม่หายเงียบ (แนวเดียวกับ fallback 🔔 ของ kind
  // เสีย: ข้อมูลนอกสัญญาต้อง "เห็นได้" ไม่ใช่ "หายเงียบ")
  it('งานสถานะอื่นที่ผู้เรียกลืมกรอง — ขึ้นเป็นบล็อกปกติ ไม่มีหัวข้อแยกตามสถานะ', () => {
    const msg = formatDailyDigestMessage(
      [{ ...BASE, id: 'p1', title: 'รับผู้ป่วยกลับบ้าน' }],
      '2026-08-06',
      'https://namphrae-portal.app'
    );
    expect(msg).toContain('🚑 รับผู้ป่วยกลับบ้าน');
    expect(msg).not.toContain('รออนุมัติ');
    expect(msg).not.toContain('👉');
  });

  it('kind นอกตาราง (ข้อมูลเสียจาก storage) — fallback 🔔 ไม่ใช่ undefined', () => {
    const msg = formatDailyDigestMessage(
      [{ ...APPROVED, kind: 'flood' as CalendarJob['kind'] }],
      '2026-08-06'
    );
    expect(msg).toContain('🔔');
    expect(msg).not.toContain('undefined');
  });

  it('ข้อความเกินเพดาน LINE — ตัดงานท้าย ๆ แล้วปิดด้วยจำนวนที่เหลือ', () => {
    const many: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...APPROVED,
      id: `a${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันพรุ่งนี้`,
    }));
    const msg = formatDailyDigestMessage(
      many,
      '2026-08-06',
      'https://namphrae-portal.app'
    );
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toMatch(/…และอีก \d+ งาน ดูทั้งหมดที่ https:\/\/namphrae-portal\.app\/admin\/calendar$/);
  });

  it('ข้อความเกินเพดานและไม่มี adminUrl — บรรทัดปิดไม่มีลิงก์', () => {
    const many: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...APPROVED,
      id: `a${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันพรุ่งนี้`,
    }));
    const msg = formatDailyDigestMessage(many, '2026-08-06');
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toMatch(/…และอีก \d+ งาน$/);
  });

  // สองเทสต์ข้างบนดูแค่ว่าข้อความไม่เกินเพดานและมีบรรทัดปิด — ไม่เคยตรวจว่า
  // ตัวเลข N ใน "…และอีก N งาน" ตรงกับจำนวนงานที่หายไปจริง เทสต์นี้ "อ่าน
  // ตัวเลขจากข้อความจริง" แล้วนับบรรทัดหัวบล็อกเทียบ ไม่ hardcode ค่าที่
  // คำนวณเอง — บล็อกข้อมูลเต็มยาวหลายบรรทัดต่องาน การนับพลาดเป็นไปได้ง่ายกว่า
  // ตอนที่งานหนึ่งงานเท่ากับหนึ่งบรรทัด
  it('ตัดบางส่วน — ตัวเลขใน “…และอีก N งาน” ตรงกับจำนวนบล็อกที่หายไปจริง', () => {
    const jobs: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...APPROVED,
      id: `a${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันพรุ่งนี้`,
    }));
    const msg = formatDailyDigestMessage(
      jobs,
      '2026-08-06',
      'https://namphrae-portal.app'
    );

    const restMatch = msg.match(/…และอีก (\d+) งาน/);
    expect(restMatch).not.toBeNull();
    const rest = Number(restMatch![1]);

    // ทุกงานใน fixture นี้เป็น kind: 'ems' → บรรทัดแรกของทุกบล็อกขึ้นต้นด้วย
    // 🚑 เสมอ (บรรทัดอื่นในบล็อกขึ้นด้วย 🕐/🏠/➤/☎) นับบล็อกได้ตรง ๆ
    const shownBlocks = msg.split('\n').filter((l) => l.startsWith('🚑')).length;
    expect(jobs.length - rest).toBe(shownBlocks);
    expect(rest).toBeGreaterThan(0); // เทสต์พิสูจน์ตัวเองว่ามีการตัดเกิดขึ้นจริง
  });
});
