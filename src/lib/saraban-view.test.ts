// src/lib/saraban-view.test.ts
import { describe, expect, it } from 'vitest';
import {
  changeValue,
  dateHint,
  docsKey,
  errorMessage,
  fileSizeLabel,
  isUrgentOpen,
  precheckFile,
  thaiDate,
  thaiDateTime,
  viewsOf,
} from '@/lib/saraban-view';
import type { RegisterView } from '@/lib/saraban-doc';

const COUNTS: Record<RegisterView, number> = {
  all: 9,
  pending: 3,
  'in-progress': 2,
  done: 3,
  void: 0,
  overdue: 1,
};

describe('viewsOf — ปุ่มกรองแยกตามทะเบียน (สเปกข้อ 6)', () => {
  it('รับ: ทั้งหมด รอเกษียน ดำเนินการ เสร็จสิ้น เกินกำหนด พร้อมจำนวน', () => {
    expect(viewsOf('in', COUNTS)).toEqual([
      { view: 'all', label: 'ทั้งหมด', count: 9 },
      { view: 'pending', label: 'รอเกษียน', count: 3 },
      { view: 'in-progress', label: 'ดำเนินการ', count: 2 },
      { view: 'done', label: 'เสร็จสิ้น', count: 3 },
      { view: 'overdue', label: 'เกินกำหนด', count: 1 },
    ]);
  });

  it('ส่ง/เวียน: ทั้งหมด รอส่ง ส่งแล้ว — ไม่มี "รอส่ง" สองปุ่ม', () => {
    expect(viewsOf('out', COUNTS).map((b) => b.label)).toEqual(['ทั้งหมด', 'รอส่ง', 'ส่งแล้ว']);
    expect(viewsOf('circular', COUNTS).map((b) => b.view)).toEqual(['all', 'in-progress', 'done']);
  });

  it('"ยกเลิก" ต่อท้ายเมื่อมีอย่างน้อย 1', () => {
    expect(viewsOf('in', { ...COUNTS, void: 2 }).at(-1)).toEqual({ view: 'void', label: 'ยกเลิก', count: 2 });
  });
});

describe('วันที่ไทย', () => {
  it('thaiDate: ISO → วัน เดือนย่อ ปี พ.ศ. · ว่างหรือผิดรูป → ""', () => {
    expect(thaiDate('2026-09-13')).toBe('13 ก.ย. 2569');
    expect(thaiDate('')).toBe('');
    expect(thaiDate('2026-13-01')).toBe('');
  });

  it('thaiDateTime: เวลากรุงเทพฯ ไม่ขึ้นกับ timezone ของเครื่อง — ข้ามเที่ยงคืน UTC ได้วันถัดไป', () => {
    expect(thaiDateTime('2026-09-13T02:42:00.000Z')).toBe('13 ก.ย. 2569 09:42');
    expect(thaiDateTime('2026-09-30T17:30:00.000Z')).toBe('1 ต.ค. 2569 00:30');
    expect(thaiDateTime('nope')).toBe('');
  });

  it('dateHint: บอกวันที่ พ.ศ. ใต้ช่อง และเตือนปี พ.ศ. ที่พิมพ์ลงช่อง ค.ศ.', () => {
    expect(dateHint('')).toEqual({ text: '', warn: false });
    expect(dateHint('2026-09-13')).toEqual({ text: '= 13 ก.ย. 2569', warn: false });
    expect(dateHint('2569-09-13')).toEqual({
      text: 'ปี 2569 ดูเหมือนเป็น พ.ศ. — ช่องนี้ใช้ ค.ศ. (2026)',
      warn: true,
    });
    expect(dateHint('2026-02-30')).toEqual({ text: 'วันที่ไม่มีอยู่จริง', warn: true });
  });
});

describe('ตัวช่วยอื่น', () => {
  it('fileSizeLabel', () => {
    expect(fileSizeLabel(1_258_291)).toBe('1.2 MB');
    expect(fileSizeLabel(820 * 1024)).toBe('820 KB');
    expect(fileSizeLabel(10)).toBe('1 KB');
  });

  it('isUrgentOpen: ด่วนขึ้นไปและยังเปิดอยู่เท่านั้น (พื้นแถวสีอ่อน)', () => {
    expect(isUrgentOpen({ level: 'urgent', status: 'pending' })).toBe(true);
    expect(isUrgentOpen({ level: 'most-urgent', status: 'done' })).toBe(false);
    expect(isUrgentOpen({ level: 'normal', status: 'pending' })).toBe(false);
  });

  it('errorMessage: รหัสที่รู้จักเป็นภาษาไทย ที่ไม่รู้จักได้ข้อความกลาง (รวมชื่อที่ชน Object.prototype)', () => {
    expect(errorMessage('number_busy')).toBe('มีคนลงรับพร้อมกัน กดอีกครั้ง');
    expect(errorMessage('constructor')).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
    expect(errorMessage(undefined)).toBe('เกิดข้อผิดพลาด ลองอีกครั้ง');
  });

  it('docsKey: ใส่เฉพาะค่าที่ไม่ใช่ค่าเริ่มต้น', () => {
    expect(docsKey({ register: 'in' })).toBe('/api/admin/saraban/docs?register=in');
    expect(docsKey({ register: 'out', year: 2569, view: 'done', page: 2 })).toBe(
      '/api/admin/saraban/docs?register=out&year=2569&view=done&page=2'
    );
    expect(docsKey({ register: 'in', view: 'all', page: 1 })).toBe('/api/admin/saraban/docs?register=in');
  });

  it('changeValue: แปลค่าดิบในประวัติการแก้ไข', () => {
    expect(changeValue('level', 'very-urgent')).toBe('ด่วนมาก');
    expect(changeValue('docDate', '2026-09-13')).toBe('13 ก.ย. 2569');
    expect(changeValue('dueDate', '')).toBe('—');
    expect(changeValue('subject', 'เรื่อง')).toBe('เรื่อง');
  });

  it('precheckFile: กันไฟล์ใหญ่และนามสกุลแปลกก่อนอัป (เซิร์ฟเวอร์ยังตรวจเนื้อไฟล์ซ้ำ)', () => {
    expect(precheckFile({ name: 'a.PDF', size: 100 })).toBeNull();
    expect(precheckFile({ name: 'a.jpeg', size: 100 })).toBeNull();
    expect(precheckFile({ name: 'a.docx', size: 100 })).toBe('a.docx: รับเฉพาะ PDF, JPG, PNG');
    expect(precheckFile({ name: 'big.pdf', size: 10 * 1024 * 1024 + 1 })).toBe('big.pdf: ใหญ่เกิน 10 MB');
  });
});
