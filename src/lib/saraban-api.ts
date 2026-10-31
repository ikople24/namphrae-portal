// src/lib/saraban-api.ts
// ตัวเรียก API สารบรรณฝั่งเบราว์เซอร์ — โยน SarabanApiError ที่มีรหัสจาก API และข้อความไทย
// (errorMessage) ให้หน้าจอเอาไปแสดงได้ทันที · ชนิดจาก store ใช้แค่ import type (ไม่ดึงโค้ดเซิร์ฟเวอร์)

import type { z } from 'zod';
import type { RegisterView } from '@/lib/saraban-doc';
import type {
  DocKind,
  DocPatch,
  FileRef,
  receiveInputSchema,
  sendInputSchema,
  UnitInput,
  UnitPatch,
  YearStartInput,
} from '@/lib/saraban-schema';
import type { YearInfo } from '@/lib/saraban-store';
import { errorMessage } from '@/lib/saraban-view';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

export class SarabanApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number
  ) {
    super(errorMessage(code));
    this.name = 'SarabanApiError';
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let code = '';
    try {
      code = (await res.json())?.error ?? '';
    } catch {
      // body ไม่ใช่ JSON — ใช้ข้อความกลาง
    }
    throw new SarabanApiError(code, res.status);
  }
  return res.json() as Promise<T>;
}

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export const sarabanFetcher = <T>(url: string): Promise<T> => call<T>(url);

export const SUMMARY_KEY = '/api/admin/saraban/summary';
export const UNITS_KEY = '/api/admin/saraban/units';
export const yearKey = (register: string) => `/api/admin/saraban/years?register=${register}`;
export const docKey = (id: string) => `/api/admin/saraban/docs/${encodeURIComponent(id)}`;

export type SummaryResponse = { inboxPending: number; storageConfigured: boolean; today: string };
export type DocListResponse = {
  docs: SarabanDoc[];
  total: number;
  page: number;
  pageSize: number;
  fiscalYear: number;
  years: number[];
  counts: Record<RegisterView, number>;
  carryOver: number;
  today: string;
};
export type { YearInfo };

export type ReceiveBody = z.input<typeof receiveInputSchema>;
export type SendBody = z.input<typeof sendInputSchema>;

/** อัปไฟล์หนึ่งไฟล์ — body เป็นตัวไฟล์ดิบ เบราว์เซอร์ใส่ Content-Length ให้เอง */
export function uploadFile(file: File): Promise<{ key: string; bytes: number; pages: number }> {
  return call('/api/admin/saraban/uploads', { method: 'POST', body: file });
}

/** อัปทีละไฟล์ตามลำดับ (เซิร์ฟเวอร์รับไฟล์ละคำขอ) แล้วคืนตัวชี้สำหรับบันทึกหนังสือ */
export async function uploadAll(
  files: File[],
  onProgress?: (done: number) => void
): Promise<FileRef[]> {
  const refs: FileRef[] = [];
  for (const file of files) {
    const { key } = await uploadFile(file);
    refs.push({ key, name: file.name });
    onProgress?.(refs.length);
  }
  return refs;
}

export function createDoc(kind: DocKind, body: ReceiveBody | SendBody): Promise<SarabanDoc> {
  return call(`/api/admin/saraban/docs?kind=${kind}`, jsonInit('POST', body));
}

export function patchDoc(id: string, body: DocPatch): Promise<SarabanDoc> {
  return call(docKey(id), jsonInit('PATCH', body));
}

export function addDocFile(id: string, file: FileRef): Promise<SarabanDoc> {
  return call(`${docKey(id)}/files`, jsonInit('POST', { file }));
}

export function removeDocFile(id: string, fileId: string): Promise<SarabanDoc> {
  return call(fileUrl(id, fileId), { method: 'DELETE' });
}

/** ลิงก์เปิดไฟล์ — route ตรวจสิทธิ์แล้ว 302 ไปลิงก์ชั่วคราว ใช้เป็น href ของ <a target="_blank"> ตรง ๆ */
export function fileUrl(id: string, fileId: string): string {
  return `${docKey(id)}/files/${encodeURIComponent(fileId)}`;
}

export function createUnit(input: Partial<UnitInput> & { name: string }): Promise<SarabanUnit> {
  return call(UNITS_KEY, jsonInit('POST', input));
}

export function updateUnit(id: string, patch: UnitPatch): Promise<SarabanUnit> {
  return call(`${UNITS_KEY}/${encodeURIComponent(id)}`, jsonInit('PATCH', patch));
}

export function setStartNo(body: YearStartInput): Promise<YearInfo> {
  return call('/api/admin/saraban/years', jsonInit('PUT', body));
}

/** ข้อความของ error ใด ๆ สำหรับ toast */
export function messageOf(err: unknown): string {
  return err instanceof SarabanApiError ? err.message : 'เชื่อมต่อไม่ได้ ลองอีกครั้ง';
}
