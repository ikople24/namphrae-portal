// src/lib/saraban-pdf.ts
// นับหน้า PDF ตอนอัป (สเปกข้อ 5) — SERVER ONLY: pdf-lib ใหญ่ ไม่ให้หลุดเข้า bundle ของหน้าจอ
// จำนวนหน้าเก็บตั้งแต่วันแรกเพื่อสถิติกระดาษรอบ 6 และการวางตรา/ลายมือรายหน้ารอบ 4

import { PDFDocument } from 'pdf-lib';

/** 0 = เปิดไม่ได้ (ไฟล์เสีย หรือโครงสร้างแปลก) — ไม่ใช่เหตุให้ปฏิเสธไฟล์ที่ผู้ใช้เปิดดูได้ในเครื่องตัวเอง */
export async function countPdfPages(data: Uint8Array): Promise<number> {
  try {
    // ignoreEncryption: PDF ที่ล็อกการแก้ไขยังนับหน้าได้ · updateMetadata: เราไม่ save กลับ
    const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    return 0;
  }
}
