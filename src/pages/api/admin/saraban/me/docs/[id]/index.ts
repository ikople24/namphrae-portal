import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveActor } from '@/lib/saraban-actor';
import { makeEvent } from '@/lib/saraban-doc';
import { ackTransition, annotateTransition, FLOW_ERROR_STATUS } from '@/lib/saraban-flow';
import { canSeeDoc, memberActions } from '@/lib/saraban-member';
import { requireSarabanMember } from '@/lib/saraban-member-guard';
import { memberPatchSchema } from '@/lib/saraban-schema';
import { applyPatch, getDoc } from '@/lib/saraban-store';

// GET   /api/admin/saraban/me/docs/[id] — { doc, actions, units } · ตำแหน่งไม่เคยเกี่ยว → 404 ไม่ใช่ 403
//       (ไม่บอกว่ามีหนังสือเรื่องนี้อยู่ — สเปกรอบ 3 ข้อ 3)
// PATCH /api/admin/saraban/me/docs/[id] — เจ้าตัวเกษียน/ทราบเอง ใช้ transition ของรอบ 2 ตัวเดิม
//       ต่างจาก route โหมดเต็มแค่ "ทำในนามตำแหน่งที่ตัวเองถือเท่านั้น" → 403 not_holder
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const member = await requireSarabanMember(req, res);
  if (!member) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'GET' && req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const current = await getDoc(id);
    if (!current || !canSeeDoc(current, member.unitIds)) return res.status(404).json({ error: 'not_found' });

    if (req.method === 'GET') {
      return res.status(200).json({
        doc: current,
        actions: memberActions(current, member.unitIds),
        // ชิปปลายทาง — ไม่ส่ง memberClerkIds ออกไปให้เจ้าหน้าที่
        units: member.units.filter((u) => u.isActive).map(({ id: unitId, name, dept }) => ({ id: unitId, name, dept })),
      });
    }

    const parsed = memberPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
    }
    const patch = parsed.data;
    if (current.updatedAt !== patch.updatedAt) return res.status(409).json({ error: 'stale' });

    // ทำในนามตำแหน่งที่ตัวเองถือเท่านั้น — ตรวจก่อนเรียก transition ใด ๆ
    const actingUnit = patch.action === 'annotate' ? current.holderUnitId : patch.unitId;
    if (!member.unitIds.includes(actingUnit)) return res.status(403).json({ error: 'not_holder' });

    // เวลา/eventId สร้างครั้งเดียวแบบ route โหมดเต็ม — ใช้ทั้งใน transition และ event
    const now = new Date().toISOString();
    const eventId = crypto.randomUUID();
    const actor = await resolveActor(member.admin);
    const result =
      patch.action === 'annotate'
        ? annotateTransition(current, patch, member.units, { now, eventId })
        : ackTransition(current, patch.unitId, { now, actor });
    if (!result.ok) {
      const body =
        result.error === 'invalid_transition'
          ? { error: result.error, action: patch.action, status: current.status }
          : { error: result.error, ...('unitId' in result ? { unitId: result.unitId } : {}) };
      return res.status(FLOW_ERROR_STATUS[result.error]).json(body);
    }

    const event = makeEvent({
      id: eventId,
      at: now,
      actor,
      kind: patch.action === 'annotate' ? 'annotated' : 'acknowledged',
      note: result.note,
      detail: result.detail,
    });
    const updated = await applyPatch(id, patch.updatedAt, result.set, event);
    if (updated) return res.status(200).json(updated);
    return (await getDoc(id))
      ? res.status(409).json({ error: 'stale' })
      : res.status(404).json({ error: 'not_found' });
  } catch (err) {
    console.error(`${req.method} /api/admin/saraban/me/docs/[id] failed`, err);
    return res.status(500).json({ error: 'server_error' });
  }
}
