// src/lib/saraban-member.ts
// โหมดเจ้าหน้าที่ (สเปกรอบ 3 ข้อ 2) — บริสุทธิ์ client-safe · ใครเห็นเรื่องไหน อยู่แท็บไหน ทำอะไรได้
// ตัดสินที่นี่ที่เดียว API ทุกตัวใต้ /me และหน้าจอใช้ชุดเดียวกัน สองแบ็กเอนด์จึงได้ผลเท่ากันโดยโครงสร้าง
//
// เฉพาะหนังสือรับ: หนังสือส่ง/เวียนมี holderUnitId เป็นหน่วยผู้ออก ไม่ใช่งานที่ต้องเกษียน

import { isOpen } from '@/lib/saraban-doc';
import { canAck, canAnnotate } from '@/lib/saraban-flow';
import type { SarabanDoc, SarabanUnit } from '@/types/saraban';

export const MEMBER_TABS = ['todo', 'forwarded', 'done'] as const;
export type MemberTab = (typeof MEMBER_TABS)[number];
export const MEMBER_PAGE_SIZE = 20;

type MemberDocView = Pick<SarabanDoc, 'register' | 'status' | 'holderUnitId' | 'circulation' | 'events'>;

/** ถืออยู่ · ถูกเวียนถึง · เคยเกษียน/ส่งต่อในนามตำแหน่งนี้ (สเปกรอบ 3 ข้อ 1.2) · ยกเลิกแล้วไม่เห็นเลย รวมเปิดตรงด้วย id */
export function canSeeDoc(doc: MemberDocView, unitIds: readonly string[]): boolean {
  if (doc.register !== 'in' || doc.status === 'void') return false;
  const mine = new Set(unitIds);
  return (
    mine.has(doc.holderUnitId) ||
    doc.circulation.some((c) => mine.has(c.unitId)) ||
    doc.events.some((e) => mine.has(e.onBehalfUnitId ?? ''))
  );
}

function pendingAcks(doc: MemberDocView, mine: Set<string>): string[] {
  return doc.circulation.filter((c) => mine.has(c.unitId) && !c.ackAt).map((c) => c.unitId);
}

/**
 * แท็บของเรื่องหนึ่ง · null = ไม่แสดง (ไม่เกี่ยว หรือยกเลิก)
 * แถวเวียนที่ยังไม่ทราบชนะสถานะ done — ทราบย้อนหลังได้ (สเปกรอบ 2 ข้อ 1.5) จึงยังเป็นงานค้าง
 */
export function memberTab(doc: MemberDocView, unitIds: readonly string[]): MemberTab | null {
  if (doc.status === 'void' || !canSeeDoc(doc, unitIds)) return null;
  const mine = new Set(unitIds);
  const holds = canAnnotate(doc) && mine.has(doc.holderUnitId);
  if (holds || pendingAcks(doc, mine).length > 0) return 'todo';
  if (doc.status === 'done') return 'done';
  return isOpen(doc.status) ? 'forwarded' : null;
}

export type MemberActions = { annotateAs: string | null; ackUnitIds: string[] };

export function memberActions(doc: MemberDocView, unitIds: readonly string[]): MemberActions {
  const mine = new Set(unitIds);
  return {
    annotateAs: canAnnotate(doc) && mine.has(doc.holderUnitId) ? doc.holderUnitId : null,
    ackUnitIds: canAck(doc) ? pendingAcks(doc, mine) : [],
  };
}

/**
 * ตำแหน่งของผู้ใช้ — Clerk: จาก memberClerkIds ของตำแหน่งที่เปิดใช้ · dev-open: ทุกคนคือ 'dev-open'
 * ที่ไม่ได้ผูกกับอะไร จึงสวมตำแหน่งจาก ?as= ได้ตำแหน่งเดียวเพื่อทดสอบ · ตั้ง Clerk แล้ว as ไม่มีผลเสมอ
 */
export function memberUnitIdsFor(args: {
  clerkOn: boolean;
  userId: string;
  as: string | undefined;
  units: readonly SarabanUnit[];
}): string[] {
  const active = args.units.filter((u) => u.isActive);
  if (!args.clerkOn) return active.some((u) => u.id === args.as) ? [args.as as string] : [];
  return active.filter((u) => u.memberClerkIds.includes(args.userId)).map((u) => u.id);
}

/** query หยาบของ Mongo — แท็บตัดสินด้วย memberTab ใน memory ต่อ (ตำแหน่งหนึ่งเกี่ยวหลักร้อยเรื่อง) */
export function memberCandidateQuery(unitIds: readonly string[]): Record<string, unknown> {
  const $in = [...unitIds];
  return {
    register: 'in',
    status: { $ne: 'void' },
    $or: [
      { holderUnitId: { $in } },
      { 'circulation.unitId': { $in } },
      { 'events.onBehalfUnitId': { $in } },
    ],
  };
}

function byRecent(a: SarabanDoc, b: SarabanDoc): number {
  return b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
}

export function pageMemberDocs(
  docs: readonly SarabanDoc[],
  unitIds: readonly string[],
  tab: MemberTab,
  page: number
): { items: SarabanDoc[]; total: number } {
  const all = docs.filter((d) => memberTab(d, unitIds) === tab).sort(byRecent);
  const skip = (page - 1) * MEMBER_PAGE_SIZE;
  return { items: all.slice(skip, skip + MEMBER_PAGE_SIZE), total: all.length };
}

export function countMemberTabs(docs: readonly SarabanDoc[], unitIds: readonly string[]): Record<MemberTab, number> {
  const counts: Record<MemberTab, number> = { todo: 0, forwarded: 0, done: 0 };
  for (const doc of docs) {
    const tab = memberTab(doc, unitIds);
    if (tab) counts[tab] += 1;
  }
  return counts;
}
