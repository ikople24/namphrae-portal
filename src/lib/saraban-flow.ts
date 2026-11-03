// src/lib/saraban-flow.ts
// state machine ของการเกษียน/ส่งต่อ/แจ้งเวียน (สเปกรอบ 2 ข้อ 3) — client-safe บริสุทธิ์ แบบ job-status.ts
// หน้าจอใช้ canAnnotate/canAck/flowStep วาดปุ่มและแถบ · API ใช้ annotateTransition/ackTransition
// ตัดสินจริง หน้าจอกับเซิร์ฟเวอร์จึงเห็นตรงกัน · เวลา/eventId/ผู้ทำรับเป็นพารามิเตอร์ (เทสต์ส่งค่าคงที่ได้)
//
// ชื่อตำแหน่งทุกตัวอ่านจากสมุด (units) ที่ส่งเข้ามา ไม่เชื่อชื่อจาก client

import { isOpen, type Actor } from '@/lib/saraban-doc';
import type {
  AnnotateRouteKind,
  SarabanCirculation,
  SarabanDoc,
  SarabanEventDetail,
  SarabanStatus,
  SarabanUnit,
} from '@/types/saraban';

export const MAX_CIRCULATE = 30;

export type AnnotateRoute =
  | { kind: 'forward'; toUnitId: string }
  | { kind: 'close' }
  | { kind: 'stay' };

export type AnnotateInput = { note: string; route: AnnotateRoute; circulateTo: readonly string[] };

/** ช่องที่ flow เขียนได้ — route ส่งต่อให้ applyPatch ตรง ๆ */
export type FlowSet = Partial<Pick<SarabanDoc, 'status' | 'holderUnitId' | 'circulation'>>;

export type FlowOk = { ok: true; set: FlowSet; note: string; detail: SarabanEventDetail };
export type FlowError =
  | { ok: false; error: 'invalid_transition' }
  | { ok: false; error: 'invalid_unit'; unitId: string }
  | { ok: false; error: 'same_holder' }
  | { ok: false; error: 'already_circulated'; unitId: string }
  | { ok: false; error: 'not_circulated' }
  | { ok: false; error: 'already_acknowledged' };
export type FlowResult = FlowOk | FlowError;

// สเปกรอบ 2 ข้อ 6 — ทำผิดลำดับ/ทำซ้ำ = 409 (ข้อมูลถูกแต่สถานะไม่ให้) · ข้อมูลผิด = 400
export const FLOW_ERROR_STATUS: Record<FlowError['error'], 400 | 409> = {
  invalid_transition: 409,
  invalid_unit: 400,
  same_holder: 400,
  already_circulated: 400,
  not_circulated: 400,
  already_acknowledged: 409,
};

/** เกษียนได้เฉพาะหนังสือรับที่ยังเปิดอยู่ — ส่ง/เวียนยังใช้วงจร "รอส่ง → ส่งแล้ว" ของรอบ 1 */
export function canAnnotate(doc: Pick<SarabanDoc, 'register' | 'status'>): boolean {
  return doc.register === 'in' && isOpen(doc.status);
}

/** ติ๊กทราบได้ทุกสถานะยกเว้นยกเลิก — กระดาษเวียนกลับมาหลังจบเรื่องได้ (สเปกรอบ 2 ข้อ 1.5) */
export function canAck(doc: Pick<SarabanDoc, 'status'>): boolean {
  return doc.status !== 'void';
}

// stay บน pending ก็ได้ in-progress — มีคนสั่งการแล้ว เรื่องไม่ได้ "รอเกษียน" อีกต่อไป
function statusAfter(route: AnnotateRouteKind): SarabanStatus {
  return route === 'close' ? 'done' : 'in-progress';
}

export function annotateTransition(
  doc: SarabanDoc,
  input: AnnotateInput,
  units: readonly SarabanUnit[],
  stamp: { now: string; eventId: string }
): FlowResult {
  if (!canAnnotate(doc)) return { ok: false, error: 'invalid_transition' };
  const activeUnit = (id: string) => units.find((u) => u.id === id && u.isActive);
  const nameOf = (id: string) => units.find((u) => u.id === id)?.name ?? id;

  const set: FlowSet = { status: statusAfter(input.route.kind) };
  const detail: SarabanEventDetail = {
    onBehalfUnitId: doc.holderUnitId,
    onBehalfName: nameOf(doc.holderUnitId),
    route: input.route.kind,
  };

  if (input.route.kind === 'forward') {
    const to = activeUnit(input.route.toUnitId);
    if (!to) return { ok: false, error: 'invalid_unit', unitId: input.route.toUnitId };
    if (to.id === doc.holderUnitId) return { ok: false, error: 'same_holder' };
    set.holderUnitId = to.id;
    detail.toUnitId = to.id;
    detail.toUnitName = to.name;
  }

  if (input.circulateTo.length > 0) {
    const seen = new Set(doc.circulation.map((c) => c.unitId));
    const added: SarabanCirculation[] = [];
    for (const unitId of input.circulateTo) {
      if (seen.has(unitId)) return { ok: false, error: 'already_circulated', unitId };
      const target = activeUnit(unitId);
      if (!target) return { ok: false, error: 'invalid_unit', unitId };
      seen.add(unitId);
      added.push({
        unitId,
        unitName: target.name,
        sentAt: stamp.now,
        sentEventId: stamp.eventId,
        ackAt: '',
        ackBy: '',
        ackByName: '',
      });
    }
    set.circulation = [...doc.circulation, ...added];
    detail.circulateTo = added.map(({ unitId, unitName }) => ({ unitId, unitName }));
  }

  return { ok: true, set, note: input.note, detail };
}

export function ackTransition(
  doc: SarabanDoc,
  unitId: string,
  stamp: { now: string; actor: Actor }
): FlowResult {
  if (!canAck(doc)) return { ok: false, error: 'invalid_transition' };
  const row = doc.circulation.find((c) => c.unitId === unitId);
  if (!row) return { ok: false, error: 'not_circulated' };
  if (row.ackAt) return { ok: false, error: 'already_acknowledged' };
  const circulation = doc.circulation.map((c) =>
    c.unitId === unitId ? { ...c, ackAt: stamp.now, ackBy: stamp.actor.id, ackByName: stamp.actor.name } : c
  );
  return { ok: true, set: { circulation }, note: '', detail: { unitId, unitName: row.unitName } };
}

export type FlowStepNo = 1 | 2 | 3 | 4 | 5;

/**
 * ขั้นปัจจุบันของแถบ 5 ขั้น (ลงรับ → เสนอ/เกษียน → มอบหมาย → ดำเนินการ → จบเรื่อง) — คำนวณจาก
 * events ไม่เก็บ · นับเฉพาะ annotated ที่ route = forward การแก้ "เสนอถึง" ตอนรอเกษียนเป็นการแก้ที่
 * ลงรับผิด ไม่ใช่การส่งต่อ · null = ไม่แสดงแถบ (ส่ง/เวียน หรือยกเลิก)
 */
export function flowStep(doc: Pick<SarabanDoc, 'register' | 'status' | 'events'>): FlowStepNo | null {
  if (doc.register !== 'in' || doc.status === 'void') return null;
  if (doc.status === 'done') return 5;
  const forwards = doc.events.filter((e) => e.kind === 'annotated' && e.route === 'forward').length;
  return forwards === 0 ? 2 : forwards === 1 ? 3 : 4;
}
