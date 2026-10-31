// src/lib/file-library.ts
// ตรรกะของคลังไฟล์ (สเปก 2026-10-31) — client-safe บริสุทธิ์ ไม่ import mongo/SDK
// ใช้ร่วมทั้ง API, store และหน้าจอ ตรึงด้วย file-library.test.ts

import { z } from 'zod';
import { thaiDate } from '@/lib/saraban-view';
import type { SarabanFileFormat } from '@/types/saraban';
import type { LibraryFile, LibraryListItem } from '@/types/file-library';

// ต้องไม่ซ้อนกับ 'saraban/' — scripts/smoke-saraban-api.mts ลบทุก key ใต้ saraban/ ตอนเก็บกวาด
// และ backup:saraban กวาดเฉพาะ prefix นั้น
export const FILES_PREFIX = 'files/';
export const PAGE_SIZE = 20;
export const MAX_QUERY_LENGTH = 100;
export const MAX_TITLE_LENGTH = 300;

export const titleSchema = z.string().trim().min(1).max(MAX_TITLE_LENGTH);
export const fileNameSchema = z.string().trim().min(1).max(255);
export const renameBodySchema = z.object({ title: titleSchema });

/** key ของไฟล์ใหม่ — id เป็น uuid ไม่ใช้ชื่อไฟล์ของผู้ใช้ (ภาษาไทย ช่องว่าง ชื่อซ้ำ) */
export function libraryKey(id: string, format: SarabanFileFormat): string {
  return `${FILES_PREFIX}${id}.${format}`;
}

/** 'รายงาน 2568.pdf' → 'รายงาน 2568' · ไม่มีนามสกุลหรือขึ้นต้นด้วยจุด → คืนทั้งชื่อ */
export function titleFromFileName(name: string): string {
  const trimmed = name.trim();
  const dot = trimmed.lastIndexOf('.');
  return dot > 0 ? trimmed.slice(0, dot).trim() : trimmed;
}

type QueryValue = string | string[] | undefined;

function firstValue(value: QueryValue): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

/** req.query / router.query → { q, page } ที่ใช้ได้เสมอ — ค่าแปลกตกเป็นค่าเริ่มต้น ไม่โยน */
export function parseListQuery(query: { q?: QueryValue; page?: QueryValue }): {
  q: string;
  page: number;
} {
  const q = firstValue(query.q).trim().slice(0, MAX_QUERY_LENGTH);
  const raw = firstValue(query.page);
  const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
  return { q, page: Number.isSafeInteger(n) && n >= 1 ? n : 1 };
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** คู่ของ $regex แบบ escape + flag i ฝั่ง Mongo — ใช้ในแบ็กเอนด์ไฟล์ให้ผลเหมือนกัน */
export function matchesQuery(title: string, q: string): boolean {
  return q === '' || title.toLowerCase().includes(q.toLowerCase());
}

/** uploadedAt ใหม่ก่อน แล้ว id มากไปน้อย — เทียบแบบไบต์ให้ตรงกับ sort({ uploadedAt: -1, id: -1 }) ของ Mongo */
export function newestFirst(a: LibraryFile, b: LibraryFile): number {
  if (a.uploadedAt !== b.uploadedAt) return a.uploadedAt < b.uploadedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

export function toListItem(file: LibraryFile): LibraryListItem {
  return {
    id: file.id,
    title: file.title,
    format: file.format,
    bytes: file.bytes,
    uploadedAt: file.uploadedAt,
  };
}

export function totalPages(total: number): number {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export function rowNumber(page: number, index: number): number {
  return (page - 1) * PAGE_SIZE + index + 1;
}

/** หมายเลขหน้ารอบหน้าปัจจุบัน ไม่เกิน size ปุ่ม — ชิดขอบเมื่ออยู่ใกล้หน้าแรก/สุดท้าย */
export function pageWindow(page: number, pages: number, size = 5): number[] {
  const count = Math.min(size, pages);
  const start = Math.min(Math.max(1, page - Math.floor(size / 2)), pages - count + 1);
  return Array.from({ length: count }, (_, i) => start + i);
}

/** key ของ SWR = URL ของ GET รายการ · ไม่ใส่ค่าเริ่มต้นลง URL */
export function libraryListKey(q: string, page: number): string {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (page > 1) params.set('page', String(page));
  const search = params.toString();
  return search ? `/api/admin/files?${search}` : '/api/admin/files';
}

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** ISO timestamp → '31 ต.ค. 2569' ตามวันที่กรุงเทพฯ · ผิดรูป → '' */
export function uploadedDateLabel(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return thaiDate(new Date(t + BANGKOK_OFFSET_MS).toISOString().slice(0, 10));
}

// Map ไม่ใช่ object literal — ERROR_MESSAGES['constructor'] ของ object literal คืนฟังก์ชันของ
// Object.prototype (บทเรียนเดียวกับ FORMAT_OF ใน saraban-attachment.ts)
const ERROR_MESSAGES = new Map<string, string>([
  ['storage_not_configured', 'ยังไม่ได้ตั้งค่าที่เก็บไฟล์ ติดต่อผู้ดูแลระบบ'],
  ['file_too_large', 'ไฟล์ใหญ่เกิน 10 MB'],
  ['bad_format', 'รับเฉพาะไฟล์ PDF, JPG, PNG'],
  ['invalid_title', 'กรุณาใส่ชื่อเรื่อง (ไม่เกิน 300 ตัวอักษร)'],
  ['feature_denied', 'คุณไม่มีสิทธิ์จัดการคลังไฟล์'],
  ['not_found', 'ไม่พบไฟล์นี้ อาจถูกลบไปแล้ว'],
]);

export function libraryErrorMessage(code: string | undefined): string {
  return (code && ERROR_MESSAGES.get(code)) || 'เกิดข้อผิดพลาด ลองใหม่อีกครั้ง';
}
