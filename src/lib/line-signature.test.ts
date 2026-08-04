import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyLineSignature } from '@/lib/line-signature';

const SECRET = 'test-channel-secret';
const BODY = JSON.stringify({ events: [] });
// BODY เดิมเป็น ASCII ล้วน string กับ Buffer จึงเห็นพ้องกันโดยบังเอิญไม่ว่า
// encoding ไหน — body จริงจาก LINE มีข้อความไทยได้ ต้องพิสูจน์ว่า Buffer.from
// (utf8 โดย default) ตรงกับ string จริง ๆ ไม่ใช่แค่ผ่านเพราะเทสต์เดิมไม่เคย
// เจอ multi-byte character
const THAI = JSON.stringify({ events: [{ message: { text: 'สวัสดีครับ' } }] });

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

describe('verifyLineSignature', () => {
  it('ผ่านเมื่อลายเซ็นถูกต้อง', () => {
    expect(verifyLineSignature(BODY, sign(BODY), SECRET)).toBe(true);
  });

  it('ผ่านเมื่อ body มาเป็น Buffer', () => {
    expect(
      verifyLineSignature(Buffer.from(BODY, 'utf8'), sign(BODY), SECRET)
    ).toBe(true);
  });

  it('ไม่ผ่านเมื่อ body ถูกแก้แม้ตัวอักษรเดียว', () => {
    expect(verifyLineSignature(BODY + ' ', sign(BODY), SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อเซ็นด้วย secret คนละตัว', () => {
    expect(verifyLineSignature(BODY, sign(BODY, 'other'), SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อไม่มี header หรือ header ว่าง', () => {
    expect(verifyLineSignature(BODY, undefined, SECRET)).toBe(false);
    expect(verifyLineSignature(BODY, '', SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อความยาวลายเซ็นไม่เท่ากัน (ต้องไม่ throw)', () => {
    expect(verifyLineSignature(BODY, 'สั้นเกิน', SECRET)).toBe(false);
  });

  it('ไม่ผ่านเมื่อยังไม่ได้ตั้ง secret', () => {
    expect(verifyLineSignature(BODY, sign(BODY), '')).toBe(false);
  });

  it('body ภาษาไทย: string กับ Buffer ต้องได้ผลตรงกัน', () => {
    const sig = sign(THAI);
    expect(verifyLineSignature(THAI, sig, SECRET)).toBe(true);
    expect(verifyLineSignature(Buffer.from(THAI, 'utf8'), sig, SECRET)).toBe(
      true
    );
  });
});
