import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import {
  buildEdit,
  makeEvent,
  nameUnitChanges,
  sentTransition,
  voidTransition,
} from '@/lib/saraban-doc';
import { ackTransition, annotateTransition, FLOW_ERROR_STATUS } from '@/lib/saraban-flow';
import { docPatchSchema } from '@/lib/saraban-schema';
import { applyPatch, getDoc, type DocSet } from '@/lib/saraban-store';
import { listUnits } from '@/lib/saraban-units-store';
import type { SarabanEventDetail, SarabanEventKind, SarabanFieldChange } from '@/types/saraban';

// GET   /api/admin/saraban/docs/[id]
// PATCH /api/admin/saraban/docs/[id]  body { action: 'edit' | 'void' | 'sent' | 'annotate' | 'ack', updatedAt, … }
//   updatedAt = เวอร์ชันที่หน้าจอเห็น — ไม่ตรงกับใน DB = มีคนแก้ไปก่อน → 409 stale ให้โหลดใหม่
//   ไม่มี DELETE โดยตั้งใจ: เลขทะเบียนเป็นหลักฐานทางราชการ ใช้ยกเลิกแทน (สเปกข้อ 6)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method === 'GET') {
    try {
      const doc = await getDoc(id);
      return doc ? res.status(200).json(doc) : res.status(404).json({ error: 'not_found' });
    } catch (err) {
      console.error('GET /api/admin/saraban/docs/[id] failed', err);
      return res.status(500).json({ error: 'server_error' });
    }
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const parsed = docPatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }
  const patch = parsed.data;

  try {
    const current = await getDoc(id);
    if (!current) return res.status(404).json({ error: 'not_found' });
    if (current.updatedAt !== patch.updatedAt) return res.status(409).json({ error: 'stale' });

    // เวลากับ eventId สร้างครั้งเดียว — flow ใช้เป็น sentAt/sentEventId ของรายการเวียน และ
    // applyPatch ใช้ event.at เป็น updatedAt ใหม่ ทั้งสามต้องตรงกัน
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const actor = await resolveActor(admin);

    let set: DocSet;
    let kind: SarabanEventKind;
    let note = '';
    let changes: SarabanFieldChange[] | undefined;
    let detail: SarabanEventDetail | undefined;

    if (patch.action === 'edit') {
      const result = buildEdit(current, patch.edit);
      if (!result.ok) return res.status(409).json({ error: 'field_locked', field: result.field });
      // ไม่มีอะไรเปลี่ยน → คืนเรื่องเดิม ไม่ต่อ event "แก้ไขข้อมูล" เปล่า ๆ (handoff ของแผน 1A)
      if (result.changes.length === 0) return res.status(200).json(current);
      const units = await listUnits();
      if (result.set.holderUnitId !== undefined) {
        const target = units.find((u) => u.id === result.set.holderUnitId);
        if (!target?.isActive) return res.status(400).json({ error: 'invalid_unit' });
      }
      const nameOf = (unitId: string) => units.find((u) => u.id === unitId)?.name ?? unitId;
      set = result.set;
      kind = 'edited';
      changes = nameUnitChanges(result.changes, nameOf);
    } else if (patch.action === 'annotate' || patch.action === 'ack') {
      const result =
        patch.action === 'annotate'
          ? annotateTransition(current, patch, await listUnits(), { now, eventId })
          : ackTransition(current, patch.unitId, { now, actor });
      if (!result.ok) {
        const { ok: _ok, ...body } = result;
        return res.status(FLOW_ERROR_STATUS[result.error]).json(
          result.error === 'invalid_transition' ? { ...body, action: patch.action, status: current.status } : body
        );
      }
      set = result.set;
      kind = patch.action === 'annotate' ? 'annotated' : 'acknowledged';
      note = result.note;
      detail = result.detail;
    } else {
      const transition =
        patch.action === 'void'
          ? voidTransition(current, patch.reason)
          : sentTransition(current, patch.method);
      if (!transition) {
        return res.status(409).json({ error: 'invalid_transition', action: patch.action, status: current.status });
      }
      ({ set, kind, note } = transition);
    }

    const event = makeEvent({ id: eventId, at: now, actor, kind, note, changes, detail });
    const updated = await applyPatch(id, patch.updatedAt, set, event);
    if (updated) return res.status(200).json(updated);
    // null: ถูกแก้แทรกระหว่าง getDoc กับตรงนี้ หรือหายไป
    return (await getDoc(id))
      ? res.status(409).json({ error: 'stale' })
      : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error('PATCH /api/admin/saraban/docs/[id] failed', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
