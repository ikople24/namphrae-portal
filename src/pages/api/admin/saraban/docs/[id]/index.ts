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
import { docPatchSchema } from '@/lib/saraban-schema';
import { applyPatch, getDoc, type DocSet } from '@/lib/saraban-store';
import { listUnits } from '@/lib/saraban-units-store';
import type { SarabanEventKind, SarabanFieldChange } from '@/types/saraban';

// GET   /api/admin/saraban/docs/[id]
// PATCH /api/admin/saraban/docs/[id]  body { action: 'edit' | 'void' | 'sent', updatedAt, … }
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

    let set: DocSet;
    let kind: SarabanEventKind;
    let note = '';
    let changes: SarabanFieldChange[] | undefined;

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

    const event = makeEvent({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: await resolveActor(admin),
      kind,
      note,
      changes,
    });
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
