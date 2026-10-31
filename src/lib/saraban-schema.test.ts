// src/lib/saraban-schema.test.ts
import { describe, expect, it } from 'vitest';
import {
  docKindSchema,
  docListQuerySchema,
  docPatchSchema,
  receiveInputSchema,
  sendInputSchema,
  unitInputSchema,
  unitPatchSchema,
  yearQuerySchema,
  yearStartSchema,
} from '@/lib/saraban-schema';

const ID = '3f1c2a9e-8b7d-4c6e-9f10-2a3b4c5d6e7f';

const RECEIVE = {
  id: ID,
  ref: 'ชม 0023.1/ว 1245',
  docDate: '2026-09-28',
  party: 'ที่ทำการปกครองอำเภอหางดง',
  subject: 'ขอเชิญประชุมหัวหน้าส่วนราชการ',
  holderUnitId: 'palad',
};

const FILE = { key: 'saraban/3f1c2a9e.pdf', name: 'scan.pdf' };

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.error?.issues.map((i) => i.message) ?? [];
}

describe('receiveInputSchema', () => {
  it('ข้อมูลครบผ่าน และเติมค่าเริ่มต้น', () => {
    expect(receiveInputSchema.parse(RECEIVE)).toEqual({
      ...RECEIVE,
      level: 'normal',
      dueDate: '',
      files: [],
    });
  });

  it('ตัดช่องว่างหัวท้าย', () => {
    expect(receiveInputSchema.parse({ ...RECEIVE, subject: '  เรื่อง  ' }).subject).toBe('เรื่อง');
  });

  it('ช่องบังคับว่างได้ข้อความภาษาไทย', () => {
    expect(messages(receiveInputSchema.safeParse({ ...RECEIVE, ref: '   ' }))).toContain(
      'ต้องระบุที่หนังสือ'
    );
  });

  it('วันที่ที่ไม่มีจริงไม่ผ่าน', () => {
    expect(messages(receiveInputSchema.safeParse({ ...RECEIVE, docDate: '2026-02-30' }))).toContain(
      'วันที่ไม่มีอยู่จริง'
    );
  });

  it('ปี พ.ศ. ที่พิมพ์ลงช่อง ค.ศ. ไม่ผ่าน — ทั้งที่เป็นวันที่ที่มีจริง', () => {
    const result = receiveInputSchema.safeParse({ ...RECEIVE, docDate: '2569-09-28' });
    expect(result.success).toBe(false);
    expect(messages(result).join()).toContain('พ.ศ.');
  });

  it('กำหนดแล้วเสร็จเว้นว่างได้ แต่ถ้าใส่ต้องเป็นวันที่ที่ถูกต้อง', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, dueDate: '' }).success).toBe(true);
    expect(receiveInputSchema.safeParse({ ...RECEIVE, dueDate: '2569-10-10' }).success).toBe(false);
  });

  it('id ต้องเป็น uuid — เป็น idempotency key ของการออกเลข', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, id: 'abc' }).success).toBe(false);
  });

  it('แนบได้ไม่เกิน 10 ไฟล์', () => {
    expect(receiveInputSchema.safeParse({ ...RECEIVE, files: Array(10).fill(FILE) }).success).toBe(true);
    expect(receiveInputSchema.safeParse({ ...RECEIVE, files: Array(11).fill(FILE) }).success).toBe(false);
  });
  it('ไฟล์แนบเป็นตัวชี้ { key, name } อย่างเดียว — ช่องอื่นที่ client ส่งมาถูกทิ้ง', () => {
    const parsed = receiveInputSchema.parse({
      ...RECEIVE,
      files: [{ ...FILE, bytes: 1, pages: 999, format: 'pdf' }],
    });
    expect(parsed.files).toEqual([FILE]);
  });
});

describe('sendInputSchema', () => {
  const SEND = {
    id: ID,
    ownerUnitId: 'office',
    docDate: '2026-10-02',
    party: 'นายอำเภอหางดง',
    subject: 'รายงานผลการดำเนินโครงการ',
  };

  it('หนังสือเวียนเป็น false โดยปริยาย', () => {
    expect(sendInputSchema.parse(SEND).circular).toBe(false);
  });

  it('ต้องเลือกส่วนราชการเจ้าของเรื่อง', () => {
    expect(sendInputSchema.safeParse({ ...SEND, ownerUnitId: '' }).success).toBe(false);
  });
});

describe('docPatchSchema — แยกตาม action', () => {
  it('edit บางช่องผ่าน', () => {
    const r = docPatchSchema.parse({ action: 'edit', updatedAt: 't', edit: { subject: ' ใหม่ ' } });
    expect(r).toEqual({ action: 'edit', updatedAt: 't', edit: { subject: 'ใหม่' } });
  });

  it('edit ที่ไม่มีช่องไหนเลยไม่ผ่าน', () => {
    expect(docPatchSchema.safeParse({ action: 'edit', updatedAt: 't', edit: {} }).success).toBe(false);
  });

  it('ยกเลิกต้องมีเหตุผล', () => {
    expect(docPatchSchema.safeParse({ action: 'void', updatedAt: 't', reason: ' ' }).success).toBe(false);
    expect(docPatchSchema.safeParse({ action: 'void', updatedAt: 't', reason: 'ลงรับซ้ำ' }).success).toBe(true);
  });

  it('ส่งแล้วรับเฉพาะวิธีส่งที่รู้จัก', () => {
    expect(docPatchSchema.safeParse({ action: 'sent', updatedAt: 't', method: 'post' }).success).toBe(true);
    expect(docPatchSchema.safeParse({ action: 'sent', updatedAt: 't', method: 'fax' }).success).toBe(false);
  });

  it('action แปลกหรือไม่มี updatedAt ไม่ผ่าน', () => {
    expect(docPatchSchema.safeParse({ action: 'delete', updatedAt: 't' }).success).toBe(false);
    expect(docPatchSchema.safeParse({ action: 'void', reason: 'x' }).success).toBe(false);
  });
});

describe('unitInputSchema / unitPatchSchema', () => {
  it('ค่าเริ่มต้น', () => {
    expect(unitInputSchema.parse({ name: 'กองช่าง' })).toEqual({
      name: 'กองช่าง',
      dept: '',
      refCode: '',
      order: 0,
      isActive: true,
    });
  });

  it("รหัสส่วนราชการห้ามมี '/' — ระบบต่อ /เลข ให้เอง", () => {
    expect(unitInputSchema.safeParse({ name: 'กองช่าง', refCode: 'ชม 55203/' }).success).toBe(false);
  });

  it('patch ที่ไม่มีช่องไหนเลยไม่ผ่าน', () => {
    expect(unitPatchSchema.safeParse({}).success).toBe(false);
    expect(unitPatchSchema.parse({ isActive: false })).toEqual({ isActive: false });
  });
});

describe('yearStartSchema', () => {
  it('เลขเริ่มต้นต้องไม่น้อยกว่า 1', () => {
    const base = { register: 'in', fiscalYear: 2570 };
    expect(yearStartSchema.safeParse({ ...base, startNo: 0 }).success).toBe(false);
    expect(yearStartSchema.safeParse({ ...base, startNo: 422 }).success).toBe(true);
  });
});

describe('docListQuerySchema — ค่าจาก query string เป็นสตริงทั้งหมด', () => {
  it('แปลงเป็นตัวเลขและเติมค่าเริ่มต้น', () => {
    expect(docListQuerySchema.parse({ register: 'in', year: '2570', page: '2' })).toEqual({
      register: 'in',
      year: 2570,
      view: 'all',
      page: 2,
    });
    expect(docListQuerySchema.parse({ register: 'out' })).toEqual({
      register: 'out',
      view: 'all',
      page: 1,
    });
  });

  it('ทะเบียนที่ไม่รู้จักไม่ผ่าน', () => {
    expect(docListQuerySchema.safeParse({ register: 'secret' }).success).toBe(false);
  });
});

describe('yearQuerySchema / docKindSchema', () => {
  it('ปีจาก query string แปลงเป็นตัวเลข เว้นได้', () => {
    expect(yearQuerySchema.parse({ register: 'in', year: '2570' })).toEqual({ register: 'in', year: 2570 });
    expect(yearQuerySchema.parse({ register: 'out' })).toEqual({ register: 'out' });
    expect(yearQuerySchema.safeParse({ register: 'x' }).success).toBe(false);
  });

  it('kind ของ POST /docs มีแค่ลงรับกับออกเลข', () => {
    expect(docKindSchema.parse('receive')).toBe('receive');
    expect(docKindSchema.parse('send')).toBe('send');
    expect(docKindSchema.safeParse('delete').success).toBe(false);
  });
});
