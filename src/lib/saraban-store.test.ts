// src/lib/saraban-store.test.ts
import { describe, expect, it } from 'vitest';
import {
  duplicateKeyOf,
  issueWithRetry,
  MAX_NUMBER_ATTEMPTS,
  NumberBusyError,
} from '@/lib/saraban-store';

// หน้าตาของ error ที่ Mongo driver โยนเมื่อชน unique index
function dupError(keyPattern: Record<string, number>) {
  return Object.assign(new Error('E11000 duplicate key error'), { code: 11000, keyPattern });
}

const noClash = () => dupError({ register: 1, fiscalYear: 1, no: 1 });
const isNoClash = (err: unknown) => duplicateKeyOf(err) === 'no';

describe('duplicateKeyOf', () => {
  it('ชน index เลขทะเบียน → no', () => {
    expect(duplicateKeyOf(noClash())).toBe('no');
  });

  it('ชน index id → id (ส่งซ้ำ)', () => {
    expect(duplicateKeyOf(dupError({ id: 1 }))).toBe('id');
  });

  it('error อื่น หรือ duplicate key ที่ไม่บอก keyPattern → null ให้ผู้เรียกโยนต่อ', () => {
    expect(duplicateKeyOf(new Error('boom'))).toBeNull();
    expect(duplicateKeyOf({ code: 11000 })).toBeNull();
    expect(duplicateKeyOf(null)).toBeNull();
  });
});

describe('issueWithRetry', () => {
  it('สำเร็จครั้งแรกก็จบ', async () => {
    let calls = 0;
    const result = await issueWithRetry(async () => {
      calls += 1;
      return 'ok';
    }, isNoClash);
    expect(result).toBe('ok');
    expect(calls).toBe(1);
  });

  it('เลขชนสองครั้งแล้วสำเร็จ → ได้ผลของครั้งที่สาม', async () => {
    let calls = 0;
    const result = await issueWithRetry(async () => {
      calls += 1;
      if (calls < 3) throw noClash();
      return calls;
    }, isNoClash);
    expect(result).toBe(3);
  });

  it('error ที่ไม่ใช่เลขชนโยนต่อทันที ไม่ลองใหม่', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw new Error('mongo down');
      }, isNoClash)
    ).rejects.toThrow('mongo down');
    expect(calls).toBe(1);
  });

  it('id ชน (ส่งซ้ำ) ไม่ใช่เลขชน — โยนต่อให้ผู้เรียกจัดการ idempotency ไม่ใช่ออกเลขใหม่', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw dupError({ id: 1 });
      }, isNoClash)
    ).rejects.toMatchObject({ code: 11000 });
    expect(calls).toBe(1);
  });

  it('ชนครบเพดานแล้วยอมแพ้ด้วย NumberBusyError — ลอง 5 ครั้งพอดี ไม่ขาดไม่เกิน', async () => {
    let calls = 0;
    await expect(
      issueWithRetry(async () => {
        calls += 1;
        throw noClash();
      }, isNoClash)
    ).rejects.toBeInstanceOf(NumberBusyError);
    expect(MAX_NUMBER_ATTEMPTS).toBe(5);
    expect(calls).toBe(MAX_NUMBER_ATTEMPTS);
  });
});
