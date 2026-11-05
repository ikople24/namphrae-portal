// src/lib/saraban-api.ts
// ตัวเรียก API สารบรรณฝั่งเบราว์เซอร์ — โยน SarabanApiError ที่มีรหัสจาก API และข้อความไทย
// (errorMessage) ให้หน้าจอเอาไปแสดงได้ทันที · ชนิดจาก store ใช้แค่ import type (ไม่ดึงโค้ดเซิร์ฟเวอร์)

import type { ScopedMutator } from 'swr';
import { unstable_serialize } from 'swr/infinite';
import type { z } from 'zod';
import type { RegisterView } from '@/lib/saraban-doc';
import { MEMBER_TABS, type MemberActions, type MemberTab } from '@/lib/saraban-member';
import type {
  DocKind,
  docPatchSchema,
  FileRef,
  memberPatchSchema,
  receiveInputSchema,
  sendInputSchema,
  UnitInput,
  UnitPatch,
  YearStartInput,
} from '@/lib/saraban-schema';
import type { YearInfo } from '@/lib/saraban-store';
import { errorMessage, memberDocKey, memberDocsKey } from '@/lib/saraban-view';
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

// input ของ schema: ฝั่งเรียกไม่ต้องส่งช่องที่ schema เติมค่าเริ่มต้นให้ (circulateTo)
export function patchDoc(id: string, body: z.input<typeof docPatchSchema>): Promise<SarabanDoc> {
  return call(docKey(id), jsonInit('PATCH', body));
}

// ชนิดของ body มาจาก schema ตรง ๆ — circulateTo เป็น optional (schema ใส่ [] ให้)
type AnnotateBody = Omit<Extract<z.input<typeof docPatchSchema>, { action: 'annotate' }>, 'action' | 'updatedAt'>;

export function annotateDoc(
  doc: Pick<SarabanDoc, 'id' | 'updatedAt'>,
  body: AnnotateBody
): Promise<SarabanDoc> {
  return patchDoc(doc.id, { action: 'annotate', updatedAt: doc.updatedAt, ...body });
}

export function ackCirculation(doc: Pick<SarabanDoc, 'id' | 'updatedAt'>, unitId: string): Promise<SarabanDoc> {
  return patchDoc(doc.id, { action: 'ack', updatedAt: doc.updatedAt, unitId });
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

// ---- โหมดเจ้าหน้าที่ (สเปกรอบ 3) — ทุกคำขอต่อ ?as= ของ dev-open ผ่าน withAs ในตัวสร้างคีย์ ----

export type UnitRef = { id: string; name: string; dept?: string };
export type MemberSummary = { units: UnitRef[]; canReceive: boolean; counts: Record<MemberTab, number> };
export type MemberDocsResponse = { items: SarabanDoc[]; total: number; page: number; pageSize: number };
export type MemberDocResponse = { doc: SarabanDoc; actions: MemberActions; units: UnitRef[]; canReceive: boolean };

type MemberBody = Extract<z.input<typeof memberPatchSchema>, { action: 'annotate' }>;

export function memberAnnotate(
  doc: Pick<SarabanDoc, 'id' | 'updatedAt'>,
  body: Omit<MemberBody, 'action' | 'updatedAt'>,
  as: string | undefined
): Promise<SarabanDoc> {
  return call(memberDocKey(doc.id, as), jsonInit('PATCH', { action: 'annotate', updatedAt: doc.updatedAt, ...body }));
}

export function memberAck(doc: Pick<SarabanDoc, 'id' | 'updatedAt'>, unitId: string, as: string | undefined): Promise<SarabanDoc> {
  return call(memberDocKey(doc.id, as), jsonInit('PATCH', { action: 'ack', updatedAt: doc.updatedAt, unitId }));
}

export function setUnitMembers(id: string, clerkIds: string[]): Promise<SarabanUnit> {
  return call(`${UNITS_KEY}/${encodeURIComponent(id)}/members`, jsonInit('PUT', { clerkIds }));
}

// ---- แคชของโหมดเจ้าหน้าที่ (บทเรียนรอบ 2: เขียนแล้วต้องล้างแคชทุกหน้าที่เกี่ยว) ----

/** getKey ของรายการงานตามแท็บ (useSWRInfinite) — ใช้ร่วมกันทุกหน้าเพื่อให้ unstable_serialize ได้คีย์ตรงกัน */
export function memberListGetKey(tab: MemberTab, as: string | undefined, enabled = true) {
  return (index: number): string | null => (enabled ? memberDocsKey({ tab, page: index + 1, as }) : null);
}

/** ล้างแคชหลังเขียน: คีย์ธรรมดาของ me/* และ docs/* + สรุปของโหมดเต็ม
 *  (mutate แบบ filter ข้ามคีย์ $inf$ ของรายการ infinite — ต้องล้างแยกด้วย clearMemberLists) */
export async function revalidateSaraban(mutate: ScopedMutator): Promise<void> {
  await Promise.all([
    mutate((k) => typeof k === 'string' && (k.startsWith('/api/admin/saraban/me') || k.startsWith('/api/admin/saraban/docs'))),
    mutate(SUMMARY_KEY),
  ]);
}

/** ทิ้งแคช infinite ของทุกแท็บ (ไม่ revalidate) — กลับไปหน้ารายการแล้วโหลดใหม่ ไม่เห็นของเก่า */
export async function clearMemberLists(mutate: ScopedMutator, as: string | undefined): Promise<void> {
  await Promise.all(
    MEMBER_TABS.map((t) => mutate(unstable_serialize(memberListGetKey(t, as)), undefined, { revalidate: false }))
  );
}
