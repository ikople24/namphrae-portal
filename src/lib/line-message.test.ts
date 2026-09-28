import { describe, expect, it } from 'vitest';
import {
  formatDailyDigestMessage,
  formatWeekendBridgeDigestMessage,
} from '@/lib/line-message';
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

describe('formatWeekendBridgeDigestMessage', () => {
  // 2026-09-05 เสาร์, 2026-09-06 อาทิตย์, 2026-09-07 จันทร์ (ต่อเนื่องจาก 2026-08-01
  // ที่เป็นวันเสาร์ — ดูคอมเมนต์ buildMonthGrid ในไฟล์ calendar-grid.test.ts)
  const BRIDGE_BASE: CalendarJob = {
    id: 'job-1',
    kind: 'ems',
    status: 'approved',
    date: '2026-09-05',
    time: '06:00',
    title: 'สมชาย ใจดี',
    village: 'ม.3 ต.น้ำแพร่',
    origin: 'บ้านที่อาศัย',
    destination: 'รพ.สวนดอก',
    phone: '0812345678',
    createdAt: '2026-09-04T11:00:00.000Z',
    createdBy: 'staff@example.com',
  };

  it('สามวันมีงานครบ — ขึ้นหัวข้อ 📅 ต่อวันตามลำดับเสาร์→อาทิตย์→จันทร์', () => {
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat', title: 'งานวันเสาร์' }] },
      { date: '2026-09-06', jobs: [{ ...BRIDGE_BASE, id: 'sun', title: 'งานวันอาทิตย์' }] },
      { date: '2026-09-07', jobs: [{ ...BRIDGE_BASE, id: 'mon', title: 'งานวันจันทร์' }] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days, 'https://namphrae-portal.app');
    expect(msg).toContain('📅 ส. 5 ก.ย. 69');
    expect(msg).toContain('📅 อา. 6 ก.ย. 69');
    expect(msg).toContain('📅 จ. 7 ก.ย. 69');
    expect(msg.indexOf('งานวันเสาร์')).toBeLessThan(msg.indexOf('งานวันอาทิตย์'));
    expect(msg.indexOf('งานวันอาทิตย์')).toBeLessThan(msg.indexOf('งานวันจันทร์'));
    expect(msg).toContain('ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์');
  });

  it('วันอาทิตย์ไม่มีงาน — ขึ้น "ไม่มีงาน" เฉพาะวันนั้น วันอื่นไม่กระทบ', () => {
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat' }] },
      { date: '2026-09-06', jobs: [] },
      { date: '2026-09-07', jobs: [{ ...BRIDGE_BASE, id: 'mon' }] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days);
    expect(msg).toContain('📅 อา. 6 ก.ย. 69\nไม่มีงาน');
    expect(msg).toContain('🚑 สมชาย ใจดี');
  });

  it('ทุกวันว่าง — ยังส่งข้อความครบสามวัน (เงียบ = ผิดปกติ)', () => {
    const days = [
      { date: '2026-09-05', jobs: [] },
      { date: '2026-09-06', jobs: [] },
      { date: '2026-09-07', jobs: [] },
    ];
    const msg = formatWeekendBridgeDigestMessage(days);
    expect(msg).toBe(
      [
        '📋 สรุปตารางงานเสาร์-จันทร์นี้ (ไม่มีข้อความแจ้งเตือนวันเสาร์-อาทิตย์)',
        '📅 ส. 5 ก.ย. 69\nไม่มีงาน',
        '📅 อา. 6 ก.ย. 69\nไม่มีงาน',
        '📅 จ. 7 ก.ย. 69\nไม่มีงาน',
      ].join('\n\n')
    );
  });

  it('งานกระจุกวันจันทร์จนเกินเพดาน — เสาร์และอาทิตย์เห็นครบ จันทร์ถูกตัดพร้อมลิงก์', () => {
    const monMany: CalendarJob[] = Array.from({ length: 300 }, (_, i) => ({
      ...BRIDGE_BASE,
      id: `mon-${i}`,
      title: `งานทดสอบข้อความยาวลำดับที่ ${i} ของวันจันทร์`,
    }));
    const days = [
      { date: '2026-09-05', jobs: [{ ...BRIDGE_BASE, id: 'sat', title: 'งานวันเสาร์' }] },
      { date: '2026-09-06', jobs: [{ ...BRIDGE_BASE, id: 'sun', title: 'งานวันอาทิตย์' }] },
      { date: '2026-09-07', jobs: monMany },
    ];
    const msg = formatWeekendBridgeDigestMessage(days, 'https://namphrae-portal.app');
    expect(msg.length).toBeLessThanOrEqual(5000);
    expect(msg).toContain('งานวันเสาร์');
    expect(msg).toContain('งานวันอาทิตย์');
    expect(msg).toMatch(
      /📅 จ\. 7 ก\.ย\. 69\n\n🚑[\s\S]*…และอีก \d+ งาน ดูทั้งหมดที่ https:\/\/namphrae-portal\.app\/admin\/calendar$/
    );
  });
});
