import crypto from 'node:crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { requireFeature } from '@/lib/auth-server';
import { resolveActor } from '@/lib/saraban-actor';
import { checkAttachment, MAX_FILES_PER_DOC } from '@/lib/saraban-attachment';
import { canAddFile, makeEvent } from '@/lib/saraban-doc';
import { fileRefSchema } from '@/lib/saraban-schema';
import { discardUnattached, headObject, isStorageConfigured } from '@/lib/saraban-storage';
import { addFile, attachedKeys, getDoc } from '@/lib/saraban-store';

const bodySchema = z.object({ file: fileRefSchema });

// POST /api/admin/saraban/docs/[id]/files  body { file: { key, name } } — แนบไฟล์เพิ่มกับเรื่องที่มีอยู่
// (ไฟล์สแกนมักตามมาทีหลัง เพิ่มได้แม้เรื่องเสร็จแล้ว ยกเว้นยกเลิก — canAddFile)
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const admin = await requireFeature(req, res, 'saraban');
  if (!admin) return;

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!id) return res.status(400).json({ error: 'missing_id' });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!isStorageConfigured()) return res.status(503).json({ error: 'storage_not_configured' });

  const parsed = bodySchema.safeParse(req.body);
  const key = parsed.success ? parsed.data.file.key : '';
  const reject = async (status: number, body: object) => {
    if (key) await discardUnattached([key]);
    return res.status(status).json(body);
  };
  if (!parsed.success) {
    return res.status(400).json({ error: 'invalid_input', issues: parsed.error.issues });
  }

  try {
    const doc = await getDoc(id);
    if (!doc) return reject(404, { error: 'not_found' });
    if (!canAddFile(doc)) return reject(409, { error: 'invalid_transition', status: doc.status });
    if (doc.files.length >= MAX_FILES_PER_DOC) return reject(409, { error: 'too_many_files' });
    if ((await attachedKeys([key])).size > 0) return reject(400, { error: 'invalid_file' });
    const head = await headObject(key);
    const check = head ? checkAttachment(head) : null;
    if (!check?.ok) return reject(400, { error: 'invalid_file' });

    const actor = await resolveActor(admin);
    const at = new Date().toISOString();
    const file = {
      id: crypto.randomUUID(),
      name: parsed.data.file.name,
      ...check.file,
      uploadedAt: at,
      uploadedBy: admin.userId,
    };
    const event = makeEvent({ id: crypto.randomUUID(), at, actor, kind: 'file-added', note: file.name });
    const updated = await addFile(id, file, event);
    if (updated) return res.status(201).json(updated);
    // null: ถูกยกเลิกหรือแนบครบเพดานแทรกเข้ามา (addFile ตรวจซ้ำใน update เดียว)
    return reject(409, { error: 'too_many_files' });
  } catch (err) {
    console.error('POST /api/admin/saraban/docs/[id]/files failed', err);
    return reject(500, { error: 'server_error' });
  }
}
