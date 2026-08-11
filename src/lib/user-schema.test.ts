import { describe, expect, it } from 'vitest';
import {
  accessPatchSchema,
  applyInputSchema,
  approveBodySchema,
  memberPatchSchema,
  rejectBodySchema,
} from '@/lib/user-schema';

describe('applyInputSchema', () => {
  const valid = {
    name: 'สมชาย ใจดี',
    position: 'นักวิชาการ',
    department: 'สาธารณสุข',
    phone: '081-234-5678',
  };

  it('accepts a normal application and trims whitespace', () => {
    const parsed = applyInputSchema.parse({ ...valid, name: '  สมชาย ใจดี  ' });
    expect(parsed.name).toBe('สมชาย ใจดี');
  });

  it('rejects missing fields', () => {
    expect(applyInputSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
    expect(applyInputSchema.safeParse({}).success).toBe(false);
  });

  it('rejects oversized fields', () => {
    expect(
      applyInputSchema.safeParse({ ...valid, name: 'ก'.repeat(201) }).success
    ).toBe(false);
  });

  it('has no role field — role is admin-assigned at approval', () => {
    const parsed = applyInputSchema.parse({ ...valid, role: 'admin' });
    expect('role' in parsed).toBe(false);
  });
});

describe('approveBodySchema', () => {
  it('requires a non-empty role', () => {
    expect(approveBodySchema.safeParse({ role: 'staff' }).success).toBe(true);
    expect(approveBodySchema.safeParse({ role: '  ' }).success).toBe(false);
    expect(approveBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('rejectBodySchema', () => {
  it('note is optional and defaults to empty string', () => {
    expect(rejectBodySchema.parse({}).note).toBe('');
    expect(rejectBodySchema.parse({ note: 'ข้อมูลไม่ครบ' }).note).toBe('ข้อมูลไม่ครบ');
  });
});

describe('memberPatchSchema', () => {
  it('accepts partial updates', () => {
    expect(memberPatchSchema.safeParse({ role: 'lead' }).success).toBe(true);
    expect(memberPatchSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(memberPatchSchema.safeParse({}).success).toBe(false);
  });

  it('rejects unknown-typed values', () => {
    expect(memberPatchSchema.safeParse({ isActive: 'no' }).success).toBe(false);
  });

  it('rejects blanking role', () => {
    expect(memberPatchSchema.safeParse({ role: '' }).success).toBe(false);
    expect(memberPatchSchema.safeParse({ role: '  ' }).success).toBe(false);
  });
});

describe('accessPatchSchema', () => {
  it('รับ features อย่างเดียว หรือ isManager อย่างเดียว', () => {
    expect(accessPatchSchema.safeParse({ features: ['calendar', 'map'] }).success).toBe(true);
    expect(accessPatchSchema.safeParse({ isManager: true }).success).toBe(true);
    expect(accessPatchSchema.safeParse({ features: [] }).success).toBe(true);
  });

  it('ปฏิเสธ object ว่าง และ feature key ที่ไม่รู้จัก', () => {
    expect(accessPatchSchema.safeParse({}).success).toBe(false);
    expect(accessPatchSchema.safeParse({ features: ['hack'] }).success).toBe(false);
    expect(accessPatchSchema.safeParse({ isManager: 'yes' }).success).toBe(false);
  });
});
