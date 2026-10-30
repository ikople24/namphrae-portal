// src/lib/saraban-pdf.test.ts
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { countPdfPages } from '@/lib/saraban-pdf';

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < n; i += 1) doc.addPage();
  return doc.save();
}

describe('countPdfPages', () => {
  it('นับหน้าจริงของ PDF', async () => {
    expect(await countPdfPages(await pdfWithPages(3))).toBe(3);
    expect(await countPdfPages(await pdfWithPages(1))).toBe(1);
  });

  it('เปิดไม่ได้ → 0 (ไม่รู้) ไม่โยน — ยังรับไฟล์ได้ (สเปกข้อ 5)', async () => {
    expect(await countPdfPages(new TextEncoder().encode('%PDF-1.7 garbage'))).toBe(0);
    expect(await countPdfPages(new Uint8Array())).toBe(0);
  });
});
