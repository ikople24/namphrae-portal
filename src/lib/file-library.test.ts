import { describe, expect, it } from 'vitest';
import {
  escapeRegex,
  libraryErrorMessage,
  libraryKey,
  libraryListKey,
  matchesQuery,
  MAX_QUERY_LENGTH,
  newestFirst,
  pageWindow,
  parseListQuery,
  rowNumber,
  titleFromFileName,
  titleSchema,
  toListItem,
  totalPages,
  uploadedDateLabel,
} from '@/lib/file-library';
import type { LibraryFile } from '@/types/file-library';

const file = (over: Partial<LibraryFile> = {}): LibraryFile => ({
  id: 'a',
  title: 'รายงาน',
  fileName: 'รายงาน.pdf',
  key: 'files/a.pdf',
  format: 'pdf',
  bytes: 10,
  uploadedAt: '2026-10-31T03:00:00.000Z',
  ...over,
});

describe('libraryKey', () => {
  it('อยู่ใต้ files/ ไม่ซ้อนกับ saraban/ ที่สคริปต์ smoke ลบทิ้งทั้ง prefix', () => {
    expect(libraryKey('abc', 'pdf')).toBe('files/abc.pdf');
    expect(libraryKey('abc', 'pdf').startsWith('saraban/')).toBe(false);
  });
});

describe('titleFromFileName', () => {
  it('ตัดนามสกุลออก', () => {
    expect(titleFromFileName('รายงาน 2568.pdf')).toBe('รายงาน 2568');
  });
  it('ไม่มีนามสกุล → คืนทั้งชื่อ', () => {
    expect(titleFromFileName('รายงาน')).toBe('รายงาน');
  });
  it('มีหลายจุด → ตัดเฉพาะนามสกุลท้ายสุด', () => {
    expect(titleFromFileName('a.b.pdf')).toBe('a.b');
  });
  it('ขึ้นต้นด้วยจุด → ไม่ตัดจนว่าง', () => {
    expect(titleFromFileName('.pdf')).toBe('.pdf');
  });
  it('ตัดช่องว่างหัวท้าย', () => {
    expect(titleFromFileName('  คำสั่ง .png ')).toBe('คำสั่ง');
  });
});

describe('titleSchema', () => {
  it('trim แล้วผ่าน', () => {
    expect(titleSchema.parse('  ชื่อ  ')).toBe('ชื่อ');
  });
  it('ว่าง / ช่องว่างล้วน / ยาวเกิน 300 ไม่ผ่าน', () => {
    expect(titleSchema.safeParse('').success).toBe(false);
    expect(titleSchema.safeParse('   ').success).toBe(false);
    expect(titleSchema.safeParse('ก'.repeat(301)).success).toBe(false);
    expect(titleSchema.safeParse('ก'.repeat(300)).success).toBe(true);
  });
  it('ไม่ใช่ string (query ซ้ำเป็นอาเรย์) ไม่ผ่าน', () => {
    expect(titleSchema.safeParse(['a', 'b']).success).toBe(false);
  });
});

describe('parseListQuery', () => {
  it('ไม่มีอะไร → q ว่าง หน้า 1', () => {
    expect(parseListQuery({})).toEqual({ q: '', page: 1 });
  });
  it('page ไม่ใช่จำนวนเต็มบวก → 1', () => {
    for (const page of ['abc', '0', '-2', '1.5', '', '1e3']) {
      expect(parseListQuery({ page }).page).toBe(1);
    }
  });
  it('page ปกติ', () => {
    expect(parseListQuery({ page: '3' }).page).toBe(3);
  });
  it('ค่าซ้ำเป็นอาเรย์ → ใช้ตัวแรก', () => {
    expect(parseListQuery({ q: ['ก', 'ข'], page: ['2', '5'] })).toEqual({ q: 'ก', page: 2 });
  });
  it('q ถูก trim และตัดที่ MAX_QUERY_LENGTH', () => {
    expect(parseListQuery({ q: '  ผู้สูงอายุ ' }).q).toBe('ผู้สูงอายุ');
    expect(parseListQuery({ q: 'x'.repeat(500) }).q).toHaveLength(MAX_QUERY_LENGTH);
  });
});

describe('escapeRegex / matchesQuery', () => {
  it('วงเล็บและ .* ไม่กลายเป็น pattern', () => {
    expect(new RegExp(escapeRegex('(2567)')).test('รายงาน (2567)')).toBe(true);
    expect(new RegExp(escapeRegex('.*')).test('อะไรก็ได้')).toBe(false);
  });
  it('matchesQuery เป็น substring ไม่สนตัวพิมพ์ · q ว่าง = ตรงทั้งหมด', () => {
    expect(matchesQuery('รายงาน OTOP 2568', 'otop')).toBe(true);
    expect(matchesQuery('รายงาน', 'คนพิการ')).toBe(false);
    expect(matchesQuery('อะไรก็ได้', '')).toBe(true);
  });
});

describe('newestFirst', () => {
  it('ใหม่ก่อน เวลาเท่ากันเรียงตาม id มากไปน้อย (ให้ตรงกับ sort ของ Mongo)', () => {
    const rows = [
      file({ id: 'a', uploadedAt: '2026-10-01T00:00:00.000Z' }),
      file({ id: 'b', uploadedAt: '2026-10-31T00:00:00.000Z' }),
      file({ id: 'c', uploadedAt: '2026-10-31T00:00:00.000Z' }),
    ];
    expect(rows.sort(newestFirst).map((r) => r.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('toListItem', () => {
  it('ไม่ส่ง key และ fileName ออกไป', () => {
    const item = toListItem(file());
    expect(item).toEqual({
      id: 'a',
      title: 'รายงาน',
      format: 'pdf',
      bytes: 10,
      uploadedAt: '2026-10-31T03:00:00.000Z',
    });
    expect('key' in item).toBe(false);
  });
});

describe('เลขหน้า', () => {
  it('totalPages อย่างน้อย 1', () => {
    expect(totalPages(0)).toBe(1);
    expect(totalPages(20)).toBe(1);
    expect(totalPages(21)).toBe(2);
  });
  it('rowNumber นับต่อเนื่องข้ามหน้า', () => {
    expect(rowNumber(1, 0)).toBe(1);
    expect(rowNumber(2, 0)).toBe(21);
    expect(rowNumber(3, 4)).toBe(45);
  });
  it('pageWindow ไม่เกิน 5 ปุ่ม ชิดขอบเมื่อใกล้หน้าแรก/สุดท้าย', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 2)).toEqual([1, 2]);
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(5, 10)).toEqual([3, 4, 5, 6, 7]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });
});

describe('libraryListKey', () => {
  it('ไม่ใส่พารามิเตอร์ที่เป็นค่าเริ่มต้น', () => {
    expect(libraryListKey('', 1)).toBe('/api/admin/files');
    expect(libraryListKey('', 2)).toBe('/api/admin/files?page=2');
  });
  it('เข้ารหัสคำค้นภาษาไทย', () => {
    expect(libraryListKey('คนพิการ', 1)).toBe(
      `/api/admin/files?q=${encodeURIComponent('คนพิการ')}`
    );
  });
});

describe('uploadedDateLabel', () => {
  it('วันที่ไทยย่อ ปี พ.ศ.', () => {
    expect(uploadedDateLabel('2026-10-31T03:00:00.000Z')).toBe('31 ต.ค. 2569');
  });
  it('ใช้วันที่ของกรุงเทพฯ ไม่ใช่ UTC', () => {
    expect(uploadedDateLabel('2026-10-31T18:00:00.000Z')).toBe('1 พ.ย. 2569');
  });
  it('ผิดรูป → ว่าง', () => {
    expect(uploadedDateLabel('ไม่ใช่วันที่')).toBe('');
  });
});

describe('libraryErrorMessage', () => {
  it('code ที่รู้จัก → ข้อความไทย', () => {
    expect(libraryErrorMessage('file_too_large')).toBe('ไฟล์ใหญ่เกิน 10 MB');
    expect(libraryErrorMessage('bad_format')).toBe('รับเฉพาะไฟล์ PDF, JPG, PNG');
    expect(libraryErrorMessage('invalid_name')).toBe('ชื่อไฟล์ยาวเกินไป (ไม่เกิน 255 ตัวอักษร)');
  });
  it('ไม่รู้จัก / ไม่มี / ชื่อ property ของ Object → ข้อความกลาง', () => {
    expect(libraryErrorMessage('อะไร')).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    expect(libraryErrorMessage(undefined)).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
    expect(libraryErrorMessage('constructor')).toBe('เกิดข้อผิดพลาด ลองใหม่อีกครั้ง');
  });
});
