// src/lib/saraban-attachment.test.ts
import { describe, expect, it } from 'vitest';
import {
  checkAttachment,
  CONTENT_TYPES,
  inlineDisposition,
  keyFor,
  looseKeysOf,
  MAX_FILE_BYTES,
  MAX_FILES_PER_DOC,
  SARABAN_PREFIX,
  sniffFormat,
  type StoredObject,
} from '@/lib/saraban-attachment';
import { SARABAN_FILE_FORMATS } from '@/types/saraban';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (s: string) => new TextEncoder().encode(s);

describe('sniffFormat — ดูชนิดจากเนื้อไฟล์ ไม่เชื่อนามสกุล', () => {
  it('PDF ขึ้นต้นด้วย %PDF-', () => {
    expect(sniffFormat(ascii('%PDF-1.7\n...'))).toBe('pdf');
  });

  it('PDF ที่มีขยะนำหน้าไม่เกิน 1024 ไบต์ยังนับเป็น PDF — เครื่องสแกนบางรุ่นเขียนแบบนี้', () => {
    const junk = new Uint8Array(200).fill(0x20);
    expect(sniffFormat(new Uint8Array([...junk, ...ascii('%PDF-1.4')]))).toBe('pdf');
  });

  it('%PDF- ที่อยู่ลึกเกิน 1024 ไบต์ไม่นับ', () => {
    const junk = new Uint8Array(1100).fill(0x20);
    expect(sniffFormat(new Uint8Array([...junk, ...ascii('%PDF-1.4')]))).toBeNull();
  });

  it('JPEG และ PNG', () => {
    expect(sniffFormat(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe('jpg');
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe('png');
  });

  it('ชนิดอื่น ไฟล์ว่าง และไฟล์สั้นกว่าลายเซ็นไม่ผ่าน', () => {
    expect(sniffFormat(ascii('GIF89a'))).toBeNull();
    expect(sniffFormat(ascii('<html><script>'))).toBeNull();
    expect(sniffFormat(new Uint8Array())).toBeNull();
    expect(sniffFormat(ascii('%PDF'))).toBeNull();
    expect(sniffFormat(bytes(0x89, 0x50, 0x4e, 0x47))).toBeNull();
  });
});

describe('keyFor', () => {
  it('ประกอบ key ใต้ prefix ของสารบรรณ', () => {
    expect(keyFor('abc', 'pdf')).toBe(`${SARABAN_PREFIX}abc.pdf`);
    expect(SARABAN_PREFIX).toBe('saraban/');
  });
});

function stored(overrides: Partial<StoredObject> = {}): StoredObject {
  return {
    key: `${SARABAN_PREFIX}abc.pdf`,
    bytes: 1_200_000,
    contentType: 'application/pdf',
    pages: '2',
    ...overrides,
  };
}

describe('checkAttachment — เชื่อ object ที่เซิร์ฟเวอร์เขียนเอง ไม่เชื่อ client', () => {
  it('PDF ผ่าน และขนาด/จำนวนหน้า/ชนิดมาจาก object', () => {
    expect(checkAttachment(stored())).toEqual({
      ok: true,
      file: { key: `${SARABAN_PREFIX}abc.pdf`, format: 'pdf', bytes: 1_200_000, pages: 2 },
    });
  });

  it('key นอก prefix ไม่รับ — รวมชื่อที่ขึ้นต้นเหมือนกันแต่ไม่มี "/"', () => {
    expect(checkAttachment(stored({ key: 'other/abc.pdf' }))).toEqual({ ok: false, error: 'wrong_prefix' });
    expect(checkAttachment(stored({ key: 'saraban-evil/abc.pdf' }))).toEqual({
      ok: false,
      error: 'wrong_prefix',
    });
  });

  it('ContentType นอกรายการหรือไม่มีเลยไม่รับ — รวมชื่อที่ชนกับ property ของ Object', () => {
    expect(checkAttachment(stored({ contentType: 'image/gif' }))).toEqual({ ok: false, error: 'bad_format' });
    expect(checkAttachment(stored({ contentType: undefined }))).toEqual({ ok: false, error: 'bad_format' });
    expect(checkAttachment(stored({ contentType: 'constructor' }))).toEqual({
      ok: false,
      error: 'bad_format',
    });
  });

  it('เพดาน 10MB พอดีผ่าน เกินหนึ่งไบต์ไม่ผ่าน', () => {
    expect(checkAttachment(stored({ bytes: MAX_FILE_BYTES })).ok).toBe(true);
    expect(checkAttachment(stored({ bytes: MAX_FILE_BYTES + 1 }))).toEqual({ ok: false, error: 'too_large' });
  });

  it('ไม่มี metadata pages หรือค่าไม่ใช่ตัวเลข = object นี้ไม่ได้มาจาก uploads.ts', () => {
    expect(checkAttachment(stored({ pages: undefined }))).toEqual({ ok: false, error: 'not_ours' });
    expect(checkAttachment(stored({ pages: 'abc' }))).toEqual({ ok: false, error: 'not_ours' });
    expect(checkAttachment(stored({ pages: '-1' }))).toEqual({ ok: false, error: 'not_ours' });
  });

  it('pages 0 = อ่าน PDF ไม่ได้ ยังรับไฟล์', () => {
    const result = checkAttachment(stored({ pages: '0' }));
    expect(result.ok && result.file.pages).toBe(0);
  });

  it('ทุกชนิดใน SARABAN_FILE_FORMATS ผ่านด้วย ContentType ของมัน — CONTENT_TYPES ต้องครบรายการกลาง', () => {
    for (const format of SARABAN_FILE_FORMATS) {
      const result = checkAttachment(
        stored({ key: keyFor('x', format), contentType: CONTENT_TYPES[format], pages: '1' })
      );
      expect(result.ok && result.file.format, format).toBe(format);
    }
  });
});

describe('inlineDisposition — ลิงก์ชั่วคราวเปิด PDF ในแท็บพร้อมชื่อเดิม', () => {
  it('ชื่อ ASCII: filename ตรงตัว และ filename* เข้ารหัส', () => {
    expect(inlineDisposition("it's a.pdf")).toBe(
      `inline; filename="it's a.pdf"; filename*=UTF-8''it%27s%20a.pdf`
    );
  });

  it('ชื่อไทย: filename สำรองเป็น ASCII ล้วน ส่วน filename* เก็บชื่อจริง', () => {
    const header = inlineDisposition('หนังสือ.pdf');
    expect(header).toBe(
      `inline; filename="_______.pdf"; filename*=UTF-8''${encodeURIComponent('หนังสือ.pdf')}`
    );
  });

  it('" และ \\ ในชื่อไม่หลุดออกนอกเครื่องหมายคำพูด', () => {
    expect(inlineDisposition('a"b\\c.pdf')).toContain('filename="a_b_c.pdf"');
  });
});

describe('looseKeysOf — key ของไฟล์จาก body ที่ยังไม่ผ่าน zod (ใช้กวาดไฟล์เมื่อบันทึกล้ม)', () => {
  it('ดึงเฉพาะ key ใต้ prefix ตัดซ้ำ', () => {
    const body = {
      files: [
        { key: `${SARABAN_PREFIX}a.pdf` },
        { key: `${SARABAN_PREFIX}a.pdf` },
        { key: 'other/b.pdf' },
        { key: 42 },
        null,
        'x',
      ],
    };
    expect(looseKeysOf(body)).toEqual([`${SARABAN_PREFIX}a.pdf`]);
  });

  it('body ผิดรูปทุกแบบ → []', () => {
    expect(looseKeysOf(null)).toEqual([]);
    expect(looseKeysOf('x')).toEqual([]);
    expect(looseKeysOf({ files: 'x' })).toEqual([]);
  });

  it('ไม่เกิน MAX_FILES_PER_DOC — body ปลอมที่ใส่ key เป็นพันไม่ทำให้เราไล่ลบเป็นพัน', () => {
    const files = Array.from({ length: 50 }, (_, i) => ({ key: `${SARABAN_PREFIX}${i}.pdf` }));
    expect(looseKeysOf({ files })).toHaveLength(MAX_FILES_PER_DOC);
  });
});
