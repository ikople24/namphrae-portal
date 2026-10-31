// src/types/file-library.ts
// โดเมนของคลังไฟล์ (สเปก 2026-10-31) — หนึ่งรายการ = หนึ่งไฟล์ใน bucket ใต้ prefix files/

import type { SarabanFileFormat } from '@/types/saraban';

export type LibraryFile = {
  id: string; // uuid
  title: string; // ชื่อเรื่องที่แสดง 1–300 ตัวอักษร
  fileName: string; // ชื่อไฟล์เดิม — ใช้ตั้ง Content-Disposition ตอนเปิด
  key: string; // `files/<uuid>.<format>` — ไม่ส่งออกไปหน้าเว็บ
  format: SarabanFileFormat;
  bytes: number;
  uploadedAt: string; // ISO
};

/** ส่วนที่ส่งให้หน้าเว็บ — ไม่มี key/fileName ทางเดียวที่เปิดไฟล์ได้คือ route view ที่ตรวจสิทธิ์ */
export type LibraryListItem = Pick<LibraryFile, 'id' | 'title' | 'format' | 'bytes' | 'uploadedAt'>;

export type LibraryPage = {
  items: LibraryListItem[];
  total: number;
  page: number;
  pageSize: number;
};
